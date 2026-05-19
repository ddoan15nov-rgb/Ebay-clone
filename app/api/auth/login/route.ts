import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const ruName = process.env.EBAY_RU_NAME;
  
  if (!clientId || !ruName) {
    return NextResponse.json({ error: 'Missing eBay OAuth credentials' }, { status: 500 });
  }

  // Use the production OAuth endpoint
  const authUrl = new URL('https://auth.ebay.com/oauth2/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', ruName);
  authUrl.searchParams.set('scope', 'https://api.ebay.com/oauth/api_scope');
  
  // Optional: prompt=login forces the user to log in again if we want, but let's keep it simple
  
  return NextResponse.redirect(authUrl.toString());
}
