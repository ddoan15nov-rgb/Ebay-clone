import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMockItemDetail } from '@/lib/mock-data';
import { getUserToken } from '@/lib/ebay-auth';

// Cache the eBay OAuth token (same as search route)
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getEbayToken(): Promise<string> {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('EBAY_CREDENTIALS_MISSING');
  }

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

// eBay Browse API — modern REST API for item details
async function fetchItemWithBrowseAPI(itemId: string) {
  const userToken = await getUserToken();
  const token = userToken || await getEbayToken();
  const legacyItemId = `v1|${itemId}|0`;

  const url = `https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(legacyItemId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Browse API HTTP ${res.status}: ${err}`);
  }

  const item = await res.json();

  // Extract images
  const images: string[] = [];
  if (item.image?.imageUrl) images.push(item.image.imageUrl);
  if (item.additionalImages) {
    item.additionalImages.forEach((img: any) => {
      if (img.imageUrl) images.push(img.imageUrl);
    });
  }

  const primaryImage = images[0] || `https://placehold.co/400x400/1e1e1e/c9a84c?text=Item+${itemId}`;

  return {
    itemId: String(item.itemId).replace('v1|', '').replace('|0', ''),
    title: item.title || `eBay Item #${itemId}`,
    price: item.price?.value || item.estimatedAvailabilities?.[0]?.estimatedSoldPrice?.value || '0',
    currency: item.price?.currency || 'USD',
    imageUrl: primaryImage,
    images: images.length > 0 ? images : [primaryImage],
    itemWebUrl: item.itemWebUrl || `https://www.ebay.com/itm/${itemId}`,
    endTime: item.itemEndDate || '',
    seller: {
      username: item.seller?.username || 'unknown',
      feedbackScore: parseInt(String(item.seller?.feedbackScore || '0'), 10),
      feedbackPercentage: String(item.seller?.feedbackPercentage || '0'),
    },
    condition: item.condition || 'Not Specified',
    listingType: item.buyingOptions?.includes('AUCTION') ? 'AUCTION' : 'FIXED_PRICE',
    bidCount: parseInt(String(item.estimatedAvailabilities?.[0]?.estimatedSoldQuantity || '0'), 10),
    description: item.shortDescription || item.description || '',
    shippingCost: item.shippingOptions?.[0]?.shippingCost?.value || undefined,
    itemLocation: [item.itemLocation?.city, item.itemLocation?.country].filter(Boolean).join(', '),
    source: 'ebay',
    buyingOptions: item.buyingOptions || [],
    isSold: parseInt(String(item.estimatedAvailabilities?.[0]?.estimatedSoldQuantity || '0'), 10) > 0,
    itemEndDate: item.itemEndDate,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  const { itemId } = params;

  try {
    const item = await fetchItemWithBrowseAPI(itemId);
    return NextResponse.json(item);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`eBay Browse API failed for ${itemId} (${errorMessage})`);

    // Try mock data
    const mockItem = getMockItemDetail(itemId);
    if (mockItem) {
      return NextResponse.json({ ...mockItem, source: 'mock' });
    }

    // Real item ID not in mock — return a navigable stub
    return NextResponse.json({
      itemId,
      title: `eBay Item #${itemId}`,
      price: '0',
      currency: 'USD',
      imageUrl: `https://placehold.co/400x400/1e1e1e/c9a84c?text=eBay+%23${itemId}`,
      images: [`https://placehold.co/400x400/1e1e1e/c9a84c?text=eBay+%23${itemId}`],
      itemWebUrl: `https://www.ebay.com/itm/${itemId}`,
      endTime: '',
      seller: { username: 'unknown', feedbackScore: 0, feedbackPercentage: '0' },
      condition: 'Unknown',
      listingType: 'AUCTION',
      bidCount: 0,
      description: '',
      shippingCost: undefined,
      shippingOptions: [],
      itemLocation: '',
      source: 'stub',
      stubError: errorMessage,
    });
  }
}
