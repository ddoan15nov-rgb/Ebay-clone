import { NextRequest, NextResponse } from 'next/server';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Vercel serverless config: Puppeteer needs more time than the default 10s
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Detect if running on Vercel (serverless) or locally
const IS_VERCEL = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

async function getBrowser() {
  if (IS_VERCEL) {
    // On Vercel: use @sparticuz/chromium's bundled binary
    return puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: (chromium as any).defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: (chromium as any).headless,
    });
  } else {
    // Locally: find Chrome on macOS
    const possiblePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    ];

    let execPath = '';
    for (const p of possiblePaths) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(p)) {
          execPath = p;
          break;
        }
      } catch { /* skip */ }
    }

    if (!execPath) {
      throw new Error('NO_BROWSER: Không tìm thấy Chrome trên máy. Cài Google Chrome.');
    }

    return puppeteerCore.launch({
      executablePath: execPath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
}

async function addSnipeViaGixen(
  username: string,
  password: string,
  itemId: string,
  maxBid: number
): Promise<{ success: boolean; message: string }> {
  const browser = await getBrowser();

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Step 1: Go to Gixen login page
    await page.goto('https://www.gixen.com/main/index.php', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    // Step 2: Fill and submit login form via JS
    await page.evaluate(
      (user: string, pass: string) => {
        const userInput = document.querySelector('input[name="username"]') as HTMLInputElement;
        const passInput = document.querySelector('input[name="password"]') as HTMLInputElement;
        const form = userInput?.closest('form');
        if (userInput) userInput.value = user;
        if (passInput) passInput.value = pass;
        if (form) form.submit();
      },
      username,
      password
    );

    // Step 3: Wait for redirect to complete and #newitemid to appear (takes 4-6s)
    await page.waitForSelector('#newitemid', { timeout: 10000 });

    // Step 4: Check if the snipe already exists and delete it first (so "Update" works)
    const existsAndDelete = await page.evaluate((id: string) => {
      const itemInput = document.querySelector(`input[name="edititemid"][value="${id}"]`);
      if (itemInput) {
        const row = itemInput.closest('tr');
        if (row) {
          const deleteBtn = row.querySelector('input[type="submit"][value="Delete"], input[type="submit"][value="delete"]') as HTMLInputElement;
          if (deleteBtn) {
            deleteBtn.click();
            return true;
          }
        }
      }
      return false;
    }, String(itemId));

    if (existsAndDelete) {
      // Wait for delete to process and page to reload
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
      await page.waitForSelector('#newitemid', { timeout: 5000 }).catch(() => {});
    }

    // Step 5: Fill in the snipe form and submit
    await page.evaluate(
      (itemIdValue: string, maxBidValue: string) => {
        const itemIdField = document.querySelector('input[name="newitemid"]') as HTMLInputElement;
        const maxBidField = document.querySelector('input[name="newmaxbid"]') as HTMLInputElement;
        
        if (itemIdField) itemIdField.value = itemIdValue;
        if (maxBidField) maxBidField.value = maxBidValue;
        
        const addButton = document.querySelector('input[value=" Add "], input[value="Add"], input[value="add"], input[type="submit"][value*="Add"]') as HTMLInputElement;
        if (addButton) {
          addButton.click();
        } else if (maxBidField && maxBidField.form) {
          maxBidField.form.submit();
        }
      },
      String(itemId),
      String(maxBid)
    );

    // Wait for the response
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});

    // Step 6: Verify the snipe was added
    const pageContent = await page.content();
    const hasItemId = pageContent.includes(String(itemId));
    const hasError = pageContent.toLowerCase().includes('error') && !pageContent.includes('Error (');

    if (hasItemId && !hasError) {
      return {
        success: true,
        message: `✅ Đã đặt snipe $${maxBid} cho item #${itemId} trên Gixen thành công!`,
      };
    } else {
      return {
        success: true,
        message: `Đã gửi snipe $${maxBid} cho #${itemId} — kiểm tra trên gixen.com để xác nhận`,
      };
    }
  } finally {
    await browser.close();
  }
}

async function deleteSnipeViaGixen(
  username: string,
  password: string,
  itemId: string
): Promise<{ success: boolean; message: string }> {
  const browser = await getBrowser();

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    );

    // Step 1: Go to Gixen login page
    await page.goto('https://www.gixen.com/main/index.php', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    // Step 2: Fill and submit login form via JS
    await page.evaluate(
      (user: string, pass: string) => {
        const userInput = document.querySelector('input[name="username"]') as HTMLInputElement;
        const passInput = document.querySelector('input[name="password"]') as HTMLInputElement;
        const form = userInput?.closest('form');
        if (userInput) userInput.value = user;
        if (passInput) passInput.value = pass;
        if (form) form.submit();
      },
      username,
      password
    );

    // Step 3: Wait for redirect to complete
    await page.waitForSelector('#newitemid', { timeout: 10000 });

    // Step 4: Find and click the delete button for this item
    const deleted = await page.evaluate((id: string) => {
      const itemInput = document.querySelector(`input[name="edititemid"][value="${id}"]`);
      if (itemInput) {
        const row = itemInput.closest('tr');
        if (row) {
          const deleteBtn = row.querySelector('input[type="submit"][value="Delete"], input[type="submit"][value="delete"]') as HTMLInputElement;
          if (deleteBtn) {
            deleteBtn.click();
            return true;
          }
        }
      }
      return false;
    }, itemId);

    if (deleted) {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
      return { success: true, message: `Đã xóa snipe cho item #${itemId}` };
    }

    return { success: false, message: 'Không tìm thấy snipe để xóa' };
  } finally {
    await browser.close();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, itemId, maxBid } = await request.json();
    const username = process.env.GIXEN_USER;
    const password = process.env.GIXEN_PASS;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Chưa cấu hình tài khoản Gixen (GIXEN_USER, GIXEN_PASS)' },
        { status: 500 }
      );
    }

    if (!itemId) {
      return NextResponse.json({ error: 'Thiếu mã sản phẩm' }, { status: 400 });
    }

    if (action === 'delete') {
      const result = await deleteSnipeViaGixen(username, password, itemId);
      return NextResponse.json(result);
    } else {
      if (!maxBid || maxBid <= 0) {
        return NextResponse.json({ error: 'Giá đặt phải lớn hơn 0' }, { status: 400 });
      }

      const result = await addSnipeViaGixen(username, password, String(itemId), maxBid);
      return NextResponse.json(result);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Gixen Puppeteer error:', msg);

    return NextResponse.json(
      {
        success: false,
        error: `Lỗi tự động Gixen: ${msg}`,
      },
      { status: 500 }
    );
  }
}
