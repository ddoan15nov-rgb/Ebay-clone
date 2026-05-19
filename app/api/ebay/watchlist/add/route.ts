import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { XMLParser } from 'fast-xml-parser';

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const userToken = cookieStore.get('ebay_user_token')?.value;

  if (!userToken) {
    return NextResponse.json({ error: 'Not authenticated', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const { itemId } = await request.json();
  if (!itemId) {
    return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
  }

  const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<AddToWatchListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ItemID>${itemId}</ItemID>
</AddToWatchListRequest>`;

  try {
    const res = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'AddToWatchList',
        'X-EBAY-API-IAF-TOKEN': userToken,
      },
      body: xmlRequest,
    });

    const xmlResponse = await res.text();

    const parser = new XMLParser();
    const result = parser.parse(xmlResponse);
    const responseData = result.AddToWatchListResponse;

    if (responseData.Ack !== 'Success' && responseData.Ack !== 'Warning') {
      const errorMsg = responseData.Errors?.ShortMessage || 'Failed to add to watchlist';
      if (errorMsg.includes('Auth token is invalid')) {
        return NextResponse.json({ error: 'Session expired', code: 'AUTH_REQUIRED' }, { status: 401 });
      }
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AddToWatchList Exception:', error);
    return NextResponse.json({ error: 'Server exception' }, { status: 500 });
  }
}
