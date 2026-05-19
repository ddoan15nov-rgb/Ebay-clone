import { cookies } from 'next/headers';

/**
 * Get the user's eBay OAuth token.
 * Attempts to use the existing user token cookie.
 * If expired/missing, tries to refresh using the refresh_token.
 * Returns null if the user is not authenticated at all.
 */
export async function getUserToken(): Promise<string | null> {
  const cookieStore = cookies();
  const userToken = cookieStore.get('ebay_user_token')?.value;
  
  if (userToken) return userToken;
  
  // Try refreshing with the refresh token
  const refreshToken = cookieStore.get('ebay_refresh_token')?.value;
  if (!refreshToken) return null;
  
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: 'https://api.ebay.com/oauth/api_scope',
    });
    
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: params.toString(),
    });
    
    if (!res.ok) {
      console.error('Token refresh failed:', await res.text());
      return null;
    }
    
    const data = await res.json();
    
    // Update the cookie with the fresh token
    cookieStore.set({
      name: 'ebay_user_token',
      value: data.access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: data.expires_in,
      path: '/',
    });
    
    return data.access_token;
  } catch (error) {
    console.error('Token refresh exception:', error);
    return null;
  }
}
