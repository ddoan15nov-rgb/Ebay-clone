import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  
  // If the user declined or eBay returned an error
  if (error) {
    const errorDesc = searchParams.get('error_description') || error;
    return NextResponse.redirect(new URL(`/?authError=${encodeURIComponent(errorDesc)}`, request.url));
  }

  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const ruName = process.env.EBAY_RU_NAME;

  if (!clientId || !clientSecret || !ruName) {
    return NextResponse.json({ error: 'Missing eBay credentials' }, { status: 500 });
  }

  // Exchange the authorization code for an access token
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: decodeURIComponent(code),
      redirect_uri: ruName,
    });

    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('eBay Token Error:', data);
      return NextResponse.redirect(new URL(`/?authError=${encodeURIComponent(data.error_description || 'Token exchange failed')}`, request.url));
    }

    // Set the user access token in an HTTP-only cookie
    cookies().set({
      name: 'ebay_user_token',
      value: data.access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: data.expires_in, // Usually 7200 seconds (2 hours)
      path: '/',
    });

    // We could also store the refresh_token if we wanted to keep them logged in forever,
    // but for now, forcing a re-login every 2 hours is fine for a personal tool.
    if (data.refresh_token) {
      cookies().set({
        name: 'ebay_refresh_token',
        value: data.refresh_token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
    }

    // Redirect back to the homepage
    return NextResponse.redirect(new URL('/?authSuccess=true', request.url));
  } catch (error) {
    console.error('OAuth Callback Exception:', error);
    return NextResponse.redirect(new URL('/?authError=Server_Exception', request.url));
  }
}
