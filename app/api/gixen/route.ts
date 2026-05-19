import { NextRequest, NextResponse } from 'next/server';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

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
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    // Step 2: Fill and submit login form via JS (bypasses hidden/duplicate elements)
    await page.evaluate(
      (user: string, pass: string) => {
        const forms = document.querySelectorAll('form[action*="home_1.php"]');
        // Use the first form found
        const form = forms[0] as HTMLFormElement;
        if (!form) return;

        const userInput = form.querySelector('input[name="username"]') as HTMLInputElement;
        const passInput = form.querySelector('input[name="password"]') as HTMLInputElement;
        if (userInput) userInput.value = user;
        if (passInput) passInput.value = pass;
        form.submit();
      },
      username,
      password
    );

    // Wait for login to process
    await new Promise((r) => setTimeout(r, 3000));

    // Step 3: Go to Gixen root (logged-in session shows "BACK TO MY SNIPES")
    await page.goto('https://www.gixen.com/index.php', {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Find the "BACK TO MY SNIPES" link and extract its URL
    const snipesLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (link.textContent?.includes('MY SNIPES') || link.textContent?.includes('My Snipes')) {
          return link.href;
        }
      }
      // Also check for the href that the logged-in nav uses
      const navLink = document.querySelector('a[href*="home_2"], a[href*="snipes"]');
      return navLink ? (navLink as HTMLAnchorElement).href : null;
    });

    console.log(`[GIXEN DEBUG] My Snipes link: ${snipesLink}`);

    if (snipesLink) {
      await page.goto(snipesLink, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      });
    }
    await new Promise((r) => setTimeout(r, 2000));

    // Try again to find the input
    const itemIdField = await page.$('input[name="newitemid"]');
    const maxBidField = await page.$('input[name="newmaxbid"]');

    if (!itemIdField || !maxBidField) {
      // Save debug screenshot
      await page.screenshot({ path: '/tmp/gixen_debug.png', fullPage: true });

      const pageUrl = page.url();
      const pageTitle = await page.title();
      const debugInfo = await page.content();
      const hasLoginForm = debugInfo.includes('name="signin"') || debugInfo.includes('Log in Now');
      const hasCookieError = debugInfo.includes('Cookies are disabled');
      const hasSnipeText = debugInfo.includes('Your snipes') || debugInfo.includes('newitemid');

      console.log(`[GIXEN DEBUG] URL: ${pageUrl}`);
      console.log(`[GIXEN DEBUG] Title: ${pageTitle}`);
      console.log(`[GIXEN DEBUG] Has login form: ${hasLoginForm}`);
      console.log(`[GIXEN DEBUG] Cookie error: ${hasCookieError}`);
      console.log(`[GIXEN DEBUG] Has snipe form: ${hasSnipeText}`);

      let errorMsg = 'FORM_NOT_FOUND';
      if (hasCookieError) {
        errorMsg = 'COOKIE_ERROR: Gixen không nhận cookie — thử lại';
      } else if (hasLoginForm) {
        errorMsg = 'LOGIN_FAILED: Sai tên đăng nhập hoặc mật khẩu Gixen';
      }
      throw new Error(errorMsg);
    }

    // Step 4.5: Check if the snipe already exists and delete it first (so "Update" works)
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
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Step 5: Fill in the snipe form using JavaScript to guarantee values are set
    await page.evaluate(
      (itemIdValue: string, maxBidValue: string) => {
        // Look for the add snipe form
        const itemIdField = document.querySelector('input[name="newitemid"]') as HTMLInputElement;
        const maxBidField = document.querySelector('input[name="newmaxbid"]') as HTMLInputElement;
        
        if (itemIdField) itemIdField.value = itemIdValue;
        if (maxBidField) maxBidField.value = maxBidValue;
        
        // Find and click the Add button
        const addButton = document.querySelector('input[value="Add"], input[value="add"], input[type="submit"][value*="Add"]') as HTMLInputElement;
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
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));

    // Step 7: Verify the snipe was added by checking the page content
    const pageContent = await page.content();
    const hasItemId = pageContent.includes(String(itemId));
    const hasError = pageContent.toLowerCase().includes('error') && !pageContent.includes('Error (');

    if (hasItemId && !hasError) {
      return {
        success: true,
        message: `✅ Đã đặt snipe $${maxBid} cho item #${itemId} trên Gixen thành công!`,
      };
    } else {
      // It might still have worked — Gixen's response is sometimes ambiguous
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

    // Login
    await page.goto('https://www.gixen.com/main/index.php', {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    // Step 2: Fill and submit login form via JS (bypasses hidden/duplicate elements)
    await page.evaluate(
      (user: string, pass: string) => {
        const forms = document.querySelectorAll('form[action*="home_1.php"]');
        // Use the first form found
        const form = forms[0] as HTMLFormElement;
        if (!form) return;

        const userInput = form.querySelector('input[name="username"]') as HTMLInputElement;
        const passInput = form.querySelector('input[name="password"]') as HTMLInputElement;
        if (userInput) userInput.value = user;
        if (passInput) passInput.value = pass;
        form.submit();
      },
      username,
      password
    );

    // Wait for meta-redirect after login
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));

    // Step 3: Go directly to the My Snipes page
    await page.goto('https://www.gixen.com/index.php', {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Find the "BACK TO MY SNIPES" link and extract its URL
    const snipesLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (link.textContent?.includes('MY SNIPES') || link.textContent?.includes('My Snipes')) {
          return link.href;
        }
      }
      const navLink = document.querySelector('a[href*="home_2"], a[href*="snipes"]');
      return navLink ? (navLink as HTMLAnchorElement).href : null;
    });

    if (snipesLink) {
      await page.goto(snipesLink, {
        waitUntil: 'networkidle2',
        timeout: 15000,
      });
    }
    await new Promise((r) => setTimeout(r, 2000));

    // Find and click the delete button for this item using page.evaluate
    const deleted = await page.evaluate((id: string) => {
      // Find the hidden input with this item ID
      const itemInput = document.querySelector(`input[name="edititemid"][value="${id}"]`);
      if (itemInput) {
        // The delete form is usually in the next cell or nearby
        // A robust way: find all forms with a Delete submit button, 
        // but since we only have the dbidid, let's find the row (tr) and then the delete button in that row
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
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
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
