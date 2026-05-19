import { NextRequest, NextResponse } from 'next/server';
import { getUserToken } from '@/lib/ebay-auth';

// Cache the eBay OAuth token (anonymous fallback)
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getEbayToken(): Promise<string> {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Missing eBay credentials');

  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  });

  if (!res.ok) throw new Error('Failed to get eBay token');
  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };
  return data.access_token;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  const { username } = params;
  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get('limit') || '20';
  const offset = searchParams.get('offset') || '0';

  try {
    const userToken = await getUserToken();
    const token = userToken || await getEbayToken();

    // Search for items by this seller
    // Note: Browse API requires at least one of: q, category_ids, epid, gtin
    // We use the seller's name as the query since eBay requires a non-empty q
    const ebayUrl = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
    const searchQ = searchParams.get('q') || '';
    if (searchQ) {
      ebayUrl.searchParams.set('q', searchQ);
    }
    ebayUrl.searchParams.set('filter', `sellers:{${username}}`);
    ebayUrl.searchParams.set('limit', limit);
    ebayUrl.searchParams.set('offset', offset);
    ebayUrl.searchParams.set('sort', 'newlyListed');
    // Use the root category to get all items when no search query is provided
    if (!searchQ) {
      ebayUrl.searchParams.set('category_ids', '0');  // Root = All Categories
    }

    const res = await fetch(ebayUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Seller API] Error for ${username}:`, err);
      return NextResponse.json({ items: [], error: `eBay API ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const items = (data.itemSummaries || []).map((item: any) => ({
      itemId: String(item.itemId).replace('v1|', '').replace('|0', ''),
      title: item.title,
      price: item.price?.value || '0',
      currency: item.price?.currency || 'USD',
      imageUrl: item.thumbnailImages?.[0]?.imageUrl || item.image?.imageUrl || '',
      itemWebUrl: item.itemWebUrl || '',
      endTime: item.itemEndDate || '',
      seller: {
        username: item.seller?.username || username,
        feedbackScore: (item.seller as Record<string, unknown>)?.feedbackScore || 0,
        feedbackPercentage: (item.seller as Record<string, unknown>)?.feedbackPercentage || '0',
      },
      condition: item.condition || 'Not Specified',
      listingType: ((item.buyingOptions as string[]) || []).includes('AUCTION') ? 'AUCTION' : 'FIXED_PRICE',
      bidCount: item.bidCount || 0,
      shippingCost: (item.shippingOptions as Record<string, unknown>[])?.[0]?.shippingCost
        ? ((item.shippingOptions as Record<string, Record<string, string>>[])[0].shippingCost.value)
        : undefined,
    }));

    // Extract seller info from first item if available
    const sellerInfo = data.itemSummaries?.[0]?.seller || {};

    return NextResponse.json({
      items,
      total: data.total || items.length,
      seller: {
        username,
        feedbackScore: sellerInfo.feedbackScore || 0,
        feedbackPercentage: sellerInfo.feedbackPercentage || '0',
      },
    });
  } catch (error) {
    console.error('[Seller API] Exception:', error);
    return NextResponse.json({ items: [], error: 'Server exception' }, { status: 500 });
  }
}
