import { NextRequest, NextResponse } from 'next/server';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { supabase } from '@/lib/supabase';
import { getEbayUsername } from '@/lib/user-identity';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const IS_VERCEL = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

async function getBrowser() {
  if (IS_VERCEL) {
    return puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: (chromium as any).defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: (chromium as any).headless,
    });
  } else {
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

async function syncTrackingToGiaonhan247(
  params: {
    trackingNumber: string;
    tuyen: string;
    gia: number;
    isBlock: boolean;
    reason?: string;
    itemUrl?: string;
    imageUrl?: string;
    note?: string;
  }
): Promise<{ success: boolean; message: string }> {
  const email = process.env.GIAONHAN247_USER || 'doandu151121@gmail.com';
  const password = process.env.GIAONHAN247_PASS || 'hamka1-cibsAg-kizsic';

  const browser = await getBrowser();

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Step 1: Login
    await page.goto('https://v2.giaonhan247.com/auth/memberLogin', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    await page.evaluate((user, pwd) => {
      const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
      const pwdInput = document.querySelector('input[name="password"]') as HTMLInputElement;
      const loginBtn = document.querySelector('.btn-member-login') as HTMLButtonElement;
      
      if (emailInput) emailInput.value = user;
      if (pwdInput) pwdInput.value = pwd;
      if (loginBtn) loginBtn.click();
    }, email, password);

    // Wait for redirect to complete
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

    // Step 2: Go to tracking update page
    await page.goto('https://v2.giaonhan247.com/update-shipping-tracking', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Wait for form to render
    await page.waitForSelector('#formUpdateTracking', { timeout: 15000 });

    // Step 3: Select route / tuyen (e.g. 8 for Oregon)
    await page.evaluate((countryId) => {
      const select = document.querySelector('select[name="country"]') as HTMLSelectElement;
      if (select) {
        select.value = String(countryId);
        select.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof (window as any).$ !== 'undefined') {
          (window as any).$('select[name="country"]').trigger('chosen:updated');
        }
      }
    }, params.tuyen);

    // Step 4: Fill fields
    await page.evaluate((trackingNo, priceVal, noteVal) => {
      const trackingInput = document.querySelector('input[name="trackingNumber"]') as HTMLInputElement;
      const priceInput = document.querySelector('input[name="price"]') as HTMLInputElement;
      const noteInput = document.querySelector('input[name="note"]') as HTMLInputElement;

      if (trackingInput) {
        trackingInput.value = trackingNo;
        trackingInput.dispatchEvent(new Event('input', { bubbles: true }));
        trackingInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (priceInput) {
        priceInput.value = String(priceVal);
        priceInput.dispatchEvent(new Event('input', { bubbles: true }));
        priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (noteInput) {
        noteInput.value = noteVal;
        noteInput.dispatchEvent(new Event('input', { bubbles: true }));
        noteInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, params.trackingNumber, params.gia, params.note || '');

    // Step 5: Check block if true
    if (params.isBlock) {
      await page.evaluate(() => {
        const isBlockCheck = document.querySelector('input[name="isBlock"]') as HTMLInputElement;
        if (isBlockCheck && !isBlockCheck.checked) {
          isBlockCheck.click();
        }
      });

      // Wait for blocking fields to show up
      await page.waitForSelector('input[name="reason"]', { timeout: 5000 });

      // Fill blocking fields
      await page.evaluate((reasonText, itemUrlVal, imgUrlVal) => {
        const reasonInput = document.querySelector('input[name="reason"]') as HTMLInputElement;
        const urlInput = document.querySelector('input[name="item_url_block[]"]') as HTMLInputElement;
        const imgInput = document.querySelector('input[name="item_image_url_block[]"]') as HTMLInputElement;
        const packageSelect = document.querySelector('select[name="item_package_block[]"]') as HTMLSelectElement;

        if (reasonInput) {
          reasonInput.value = reasonText;
          reasonInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (urlInput) {
          urlInput.value = itemUrlVal;
          urlInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (imgInput) {
          imgInput.value = imgUrlVal;
          imgInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (packageSelect) {
          packageSelect.value = "137"; // Hàng Đặc Biệt
          packageSelect.dispatchEvent(new Event('change', { bubbles: true }));
          if (typeof (window as any).$ !== 'undefined') {
            (window as any).$('select[name="item_package_block[]"]').trigger('chosen:updated');
          }
        }
      }, params.reason || 'take a photo', params.itemUrl || '', params.imageUrl || '');
    }

    // Step 6: Submit
    await page.evaluate(() => {
      const form = document.querySelector('#formUpdateTracking') as HTMLFormElement;
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button.btn-submit') as HTMLButtonElement | HTMLInputElement;
        if (submitBtn) {
          submitBtn.click();
        } else {
          form.submit();
        }
      }
    });

    // Wait for AJAX submission response
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Read the text to confirm success
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasSuccess = bodyText.includes('Thành công') || bodyText.includes('thành công') || bodyText.includes('Success');
    const alreadyExists = bodyText.includes('đã tồn tại') || bodyText.includes('Đã tồn tại');

    if (hasSuccess) {
      return { success: true, message: 'Đã cập nhật tracking thành công lên Giaonhan247!' };
    } else if (alreadyExists) {
      return { success: true, message: 'Tracking đã tồn tại trên Giaonhan247 (đã cập nhật trước đó).' };
    } else {
      // Find possible error messages in alert divs or paragraphs
      const errMsg = await page.evaluate(() => {
        const alertEl = document.querySelector('.alert-danger, .alert, .error-message, .text-danger');
        return alertEl ? alertEl.textContent?.trim() : '';
      });
      return { 
        success: false, 
        message: errMsg || 'Giaonhan247 trả về lỗi hoặc không phản hồi thành công.' 
      };
    }
  } finally {
    await browser.close();
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackingNumber, tuyen, gia, isBlock, reason, itemUrl, imageUrl, note } = body;

    if (!trackingNumber) {
      return NextResponse.json({ error: 'Thiếu tracking number' }, { status: 400 });
    }

    const result = await syncTrackingToGiaonhan247({
      trackingNumber,
      tuyen: tuyen || '8', // default Oregon
      gia: Math.round(gia || 0),
      isBlock: !!isBlock,
      reason,
      itemUrl,
      imageUrl,
      note,
    });

    if (result.success) {
      try {
        const userId = await getEbayUsername();
        if (userId) {
          await supabase.from('activity_log').insert({
            user_id: userId,
            action: 'giaonhan_sync',
            target: trackingNumber,
            target_label: note || trackingNumber,
            metadata: {
              success: true,
              tuyen: tuyen || '8',
              gia: gia || 0,
              isBlock: !!isBlock,
            },
          });

          // Auto-assign to current active lot has been removed per plan
        }
      } catch (logErr) {
        console.error('Failed to log tracking sync to database:', logErr);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Giaonhan247 sync error:', msg);
    return NextResponse.json({ error: `Lỗi tự động Giaonhan247: ${msg}` }, { status: 500 });
  }
}
