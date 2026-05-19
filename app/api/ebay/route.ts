import { NextRequest, NextResponse } from 'next/server';
import { MOCK_ITEMS } from '@/lib/mock-data';
import { getUserToken } from '@/lib/ebay-auth';

// Cache the eBay OAuth token (anonymous fallback) — cleared on server restart
let tokenCache: { token: string; expiresAt: number } | null = null;

// Rate limit cooldown — when 429'd, stop hitting eBay for 5 minutes
let rateLimitUntil = 0;
let lastSuccessfulItems: any[] | null = null;

async function getEbayToken(): Promise<string> {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('EBAY_CREDENTIALS_MISSING');
  }

  // Return cached token if still valid
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Auth failed: ${data.error_description || data.error || 'Unknown error'}`);
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return tokenCache.token;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword') || 'gold scrap lot';
  const sort = searchParams.get('sort') || 'endingSoonest';
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');
  const listingType = searchParams.get('listingType');
  const condition = searchParams.get('condition');
  const limit = searchParams.get('limit') || '40';
  const offset = searchParams.get('offset') || '0';
  const negativeWords = searchParams.get('negativeWords') || '';

  // If we're in a rate-limit cooldown, skip the API and return cached/mock data
  if (Date.now() < rateLimitUntil) {
    const remaining = Math.ceil((rateLimitUntil - Date.now()) / 1000);
    console.log(`[eBay Search] Rate-limited, cooldown ${remaining}s remaining`);
    if (lastSuccessfulItems) {
      return NextResponse.json({ items: lastSuccessfulItems, source: 'ebay', total: lastSuccessfulItems.length, rateLimited: true });
    }
    const filtered = MOCK_ITEMS.filter((item) =>
      item.title.toLowerCase().includes(keyword.toLowerCase().split(' ')[0])
      || keyword.toLowerCase().includes('gold')
    );
    return NextResponse.json({ items: filtered, source: 'mock', rateLimited: true });
  }

  try {
    // Use user token if logged in (personalized), otherwise anonymous app token
    const userToken = await getUserToken();
    const token = userToken || await getEbayToken();

    // Build keyword query with exclusion
    let keywordQuery = keyword;
    const negatives = negativeWords.split(',').map(w => w.trim()).filter(Boolean);
    if (negatives.length > 0) {
      // eBay Browse API: each excluded word gets its own minus prefix
      // Multi-word phrases are quoted: -"Gold tone"
      const exclusions = negatives.map(w => w.includes(' ') ? `-"${w}"` : `-${w}`);
      keywordQuery += ' ' + exclusions.join(' ');
    }

    // Build filter string
    const filters: string[] = [];
    if (minPrice) filters.push(`price:[${minPrice}]`);
    if (maxPrice) filters.push(`price:[..${maxPrice}]`);
    if (listingType && listingType !== 'ALL') {
      filters.push(`buyingOptions:{${listingType === 'AUCTION' ? 'AUCTION' : 'FIXED_PRICE'}}`);
    }
    if (condition && condition !== 'ALL') {
      filters.push(`conditions:{${condition}}`);
    }

    // Map sort param to eBay sort
    const sortMap: Record<string, string> = {
      endingSoonest: 'endingSoonest',
      price: 'price',
      newlyListed: 'newlyListed',
    };

    const ebayUrl = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
    ebayUrl.searchParams.set('q', keywordQuery);
    ebayUrl.searchParams.set('limit', limit);
    ebayUrl.searchParams.set('offset', offset);
    ebayUrl.searchParams.set('sort', sortMap[sort] || 'endingSoonest');
    if (filters.length > 0) {
      ebayUrl.searchParams.set('filter', filters.join(','));
    }

    const res = await fetch(ebayUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`eBay API ${res.status}: ${err}`);
    }

    const data = await res.json();
    const now = new Date().getTime();
    const items = (data.itemSummaries || [])
      .filter((item: any) => {
        if (!item.itemEndDate) return true;
        return new Date(item.itemEndDate).getTime() > now;
      })
      .map((item: Record<string, unknown>) => ({
        itemId: String(item.itemId).replace('v1|', '').replace('|0', ''),
        title: item.title,
        price: (item.price as Record<string, string>)?.value || '0',
        currency: (item.price as Record<string, string>)?.currency || 'USD',
        imageUrl: ((item.thumbnailImages as Record<string, string>[]) || [])[0]?.imageUrl
          || (item.image as Record<string, string>)?.imageUrl
          || '',
        itemWebUrl: item.itemWebUrl,
        endTime: (item.itemEndDate as string) || '',
        seller: {
          username: (item.seller as Record<string, unknown>)?.username || 'unknown',
          feedbackScore: (item.seller as Record<string, unknown>)?.feedbackScore || 0,
          feedbackPercentage: (item.seller as Record<string, unknown>)?.feedbackPercentage || '0',
        },
        condition: item.condition || 'Not Specified',
        listingType: ((item.buyingOptions as string[]) || []).includes('AUCTION') ? 'AUCTION' : 'FIXED_PRICE',
        bidCount: item.bidCount || 0,
        shippingCost: (item.shippingOptions as Record<string, unknown>[])
          ?.[0]?.shippingCost
          ? ((item.shippingOptions as Record<string, Record<string, string>>[])[0].shippingCost.value)
          : undefined,
      }));
    // Cache the successful result
    lastSuccessfulItems = items;

    return NextResponse.json({ items, source: 'ebay', total: data.total || items.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown';
    console.log(`eBay Browse API unavailable (${errorMessage}), using mock data`);

    // If it's a 429, set a 5-minute cooldown to stop hammering eBay
    if (errorMessage.includes('429')) {
      rateLimitUntil = Date.now() + 5 * 60 * 1000;
      console.log('[eBay Search] Rate limited! Cooldown set for 5 minutes.');
    }

    // Return cached data if we have it, otherwise mock
    if (lastSuccessfulItems) {
      return NextResponse.json({ items: lastSuccessfulItems, source: 'ebay', total: lastSuccessfulItems.length, rateLimited: true });
    }

    const filtered = MOCK_ITEMS.filter((item) =>
      item.title.toLowerCase().includes(keyword.toLowerCase().split(' ')[0])
      || keyword.toLowerCase().includes('gold')
    );

    return NextResponse.json({ items: filtered, source: 'mock', error: errorMessage });
  }
}
