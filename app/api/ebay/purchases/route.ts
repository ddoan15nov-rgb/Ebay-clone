import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { XMLParser } from 'fast-xml-parser';
import { supabase } from '@/lib/supabase';
import { getEbayUsername } from '@/lib/user-identity';

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

/**
 * Fetch item images using the eBay Browse API and cache them locally.
 */
async function fetchItemImages(itemIds: string[]): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  if (itemIds.length === 0) return imageMap;

  const fs = require('fs');
  const path = require('path');
  const cachePath = path.join(process.cwd(), 'scratch/image-cache.json');
  
  let cache: Record<string, string> = {};
  try {
    if (fs.existsSync(cachePath)) {
      cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }
  } catch (e) {
    console.error('[Purchases] Failed to read image cache:', e);
  }

  // Find missing item IDs
  const missingIds = itemIds.filter(id => !cache[id]);
  
  if (missingIds.length > 0) {
    try {
      console.log(`[Purchases] Fetching ${missingIds.length} missing images from Browse API...`);
      const token = await getEbayToken();
      
      // Chunk missing requests to not overload the API (5 at a time)
      const chunkSize = 5;
      for (let i = 0; i < missingIds.length; i += chunkSize) {
        const chunk = missingIds.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (id) => {
          try {
            const legacyItemId = `v1|${id}|0`;
            const url = `https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(legacyItemId)}`;
            const res = await fetch(url, {
              headers: {
                Authorization: `Bearer ${token}`,
                'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
              },
            });
            if (res.ok) {
              const item = await res.json();
              let pic = item.image?.imageUrl;
              if (!pic && item.additionalImages?.[0]?.imageUrl) {
                pic = item.additionalImages[0].imageUrl;
              }
              if (pic) {
                cache[id] = pic;
              }
            } else {
              console.warn(`[Purchases] Browse API returned ${res.status} for item ${id}`);
            }
          } catch (err) {
            console.error(`[Purchases] Error fetching item ${id} from Browse API:`, err);
          }
        }));
      }

      // Write updated cache (wrap in try-catch for read-only systems)
      try {
        const dir = path.dirname(cachePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
      } catch (writeErr) {
        console.warn('[Purchases] Failed to save updated image cache (filesystem might be read-only):', writeErr);
      }
    } catch (e) {
      console.error('[Purchases] Error during Browse API image fetch:', e);
    }
  }

  // Populate image map
  itemIds.forEach(id => {
    if (cache[id]) {
      imageMap.set(id, cache[id]);
    }
  });

  return imageMap;
}


export async function GET(request: NextRequest) {
  console.log(`[${new Date().toISOString()}] GET purchases endpoint hit`);
  console.log(`[${new Date().toISOString()}] EBAY_CLIENT_ID: ${process.env.EBAY_CLIENT_ID ? 'Exists (len: ' + process.env.EBAY_CLIENT_ID.length + ')' : 'MISSING'}`);

  const cookieStore = cookies();
  const userToken = cookieStore.get('ebay_user_token')?.value;

  if (!userToken) {
    console.log(`[${new Date().toISOString()}] Auth required: no userToken`);
    return NextResponse.json({ error: 'Not authenticated', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  // Use GetOrders with OrderRole=Buyer to get full order details including tracking
  const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <DetailLevel>ReturnAll</DetailLevel>
  <OrderRole>Buyer</OrderRole>
  <NumberOfDays>30</NumberOfDays>
  <Pagination>
    <EntriesPerPage>100</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
</GetOrdersRequest>`;

  try {
    const res = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'GetOrders',
        'X-EBAY-API-IAF-TOKEN': userToken,
      },
      body: xmlRequest,
    });

    const xmlResponse = await res.text();

    // Write raw response to file for debugging (only in local dev)
    if (process.env.NODE_ENV === 'development') {
      try {
        const fs = require('fs');
        const path = require('path');
        fs.writeFileSync(path.join(process.cwd(), 'ebay-orders-response.xml'), xmlResponse);
      } catch (e) { /* ignore */ }
    }

    if (!res.ok) {
      return NextResponse.json({ error: 'eBay API error' }, { status: res.status });
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      textNodeName: '_text',
      parseTagValue: false,
    });

    const result = parser.parse(xmlResponse);
    const responseData = result.GetOrdersResponse;

    if (responseData.Ack !== 'Success' && responseData.Ack !== 'Warning') {
      const errorMsg = responseData.Errors?.ShortMessage || 'Unknown error fetching orders';
      if (String(errorMsg).includes('Auth token') || String(errorMsg).includes('token')) {
        return NextResponse.json({ error: 'Session expired', code: 'AUTH_REQUIRED' }, { status: 401 });
      }
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    // Extract Orders from GetOrdersResponse
    const orderArray = responseData.OrderArray;
    if (!orderArray || !orderArray.Order) {
      return NextResponse.json({ items: [] });
    }

    let orders = orderArray.Order;
    if (!Array.isArray(orders)) {
      orders = [orders];
    }

    // Collect all unique ItemIDs for batch image fetch
    const allItemIds = new Set<string>();
    const mappedPurchases: any[] = [];

    // First pass: extract all items and collect ItemIDs
    orders.forEach((order: any) => {
      let transactions = order.TransactionArray?.Transaction;
      if (!transactions) return;
      if (!Array.isArray(transactions)) transactions = [transactions];

      // Extract tracking at the order level (ShippingDetails.ShipmentTrackingDetails)
      let orderTrackingDetails = order.ShippingDetails?.ShipmentTrackingDetails;
      if (orderTrackingDetails && !Array.isArray(orderTrackingDetails)) {
        orderTrackingDetails = [orderTrackingDetails];
      }

      // Order-level shipping cost
      const orderShipCostRaw = order.ShippingServiceSelected?.ShippingServiceCost?._text
        ?? order.ShippingServiceSelected?.ShippingServiceCost
        ?? order.ShippingDetails?.ShippingServiceOptions?.ShippingServiceCost?._text
        ?? order.ShippingDetails?.ShippingServiceOptions?.ShippingServiceCost
        ?? '0';
      const orderShipCost = parseFloat(String(orderShipCostRaw));
      const perItemShip = transactions.length > 0 ? orderShipCost / transactions.length : 0;

      transactions.forEach((t: any) => {
        const item = t.Item;
        if (!item) return;

        const itemId = String(item.ItemID);
        allItemIds.add(itemId);

        // === Price extraction ===
        const rawPrice = t.TransactionPrice?._text
          ?? t.TransactionPrice
          ?? t.TotalTransactionPrice?._text
          ?? t.TotalTransactionPrice
          ?? '0';
        const price = parseFloat(String(rawPrice));

        // === Shipping cost ===
        let shipCost = perItemShip;
        if (t.ActualShippingCost) {
          shipCost = parseFloat(t.ActualShippingCost?._text ?? String(t.ActualShippingCost) ?? '0');
        } else if (t.ShippingServiceSelected?.ShippingServiceCost) {
          shipCost = parseFloat(
            t.ShippingServiceSelected.ShippingServiceCost?._text
            ?? String(t.ShippingServiceSelected.ShippingServiceCost) ?? '0'
          );
        }

        // === Tracking extraction ===
        let trackingDetails = t.ShippingDetails?.ShipmentTrackingDetails;
        if (!trackingDetails && orderTrackingDetails) {
          trackingDetails = orderTrackingDetails[0];
        }
        const trackingInfo = Array.isArray(trackingDetails) ? trackingDetails[0] : trackingDetails;

        // === Status extraction ===
        const paidTime = t.PaidTime || order.PaidTime || '';
        const shippedTime = t.ShippedTime || order.ShippedTime || '';
        const orderStatus = order.OrderStatus || '';

        let status: 'pending' | 'paid' | 'shipped' | 'delivered' = 'pending';
        if (shippedTime || trackingInfo) {
          status = 'shipped';
        } else if (paidTime || orderStatus === 'Completed') {
          status = 'paid';
        }

        mappedPurchases.push({
          id: t.TransactionID || t.OrderLineItemID || `p_${itemId}`,
          ebayItemId: itemId,
          title: item.Title,
          imageUrl: '', // will be filled after batch image fetch
          gia: isNaN(price) ? 0 : price,
          ship: isNaN(shipCost) ? 0 : shipCost,
          tong: (isNaN(price) ? 0 : price) + (isNaN(shipCost) ? 0 : shipCost),
          tracked: !!trackingInfo,
          trackingNumber: trackingInfo?.ShipmentTrackingNumber || '',
          carrier: trackingInfo?.ShippingCarrierUsed || '',
          status,
          paidTime: paidTime || undefined,
          shippedTime: shippedTime || undefined,
          lo: '1',
          createdAt: t.CreatedDate || order.CreatedTime || new Date().toISOString(),
        });
      });
    });

    // Batch-fetch images from eBay Shopping API
    const imageMap = await fetchItemImages(Array.from(allItemIds));

    // Apply images to mapped purchases
    for (const purchase of mappedPurchases) {
      purchase.imageUrl = imageMap.get(purchase.ebayItemId) || '';
    }

    // Sort by createdAt descending (newest first)
    mappedPurchases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Merge items that share the same tracking number into a single combined entry
    const mergedMap = new Map<string, any>();
    const noTrackingItems: any[] = [];

    for (const item of mappedPurchases) {
      if (!item.trackingNumber) {
        noTrackingItems.push(item);
        continue;
      }

      const existing = mergedMap.get(item.trackingNumber);
      if (existing) {
        // Merge: sum prices, concatenate titles
        existing.gia += item.gia;
        existing.ship = Math.max(existing.ship, item.ship); // shipping is shared
        existing.tong = existing.gia + existing.ship;
        existing.mergedTitles = existing.mergedTitles || [existing.originalTitle || existing.title];
        existing.mergedTitles.push(item.title);
        existing.title = existing.mergedTitles
          .map((t: string, i: number) => `[${i + 1}] ${t}`)
          .join(' ⊕ ');
        existing.mergedCount = (existing.mergedCount || 1) + 1;
        // Keep the first item's image, collect additional images
        if (item.imageUrl) {
          existing.mergedImages = existing.mergedImages || [existing.imageUrl];
          existing.mergedImages.push(item.imageUrl);
        }
        // Keep the earliest createdAt
        if (new Date(item.createdAt) < new Date(existing.createdAt)) {
          existing.createdAt = item.createdAt;
        }
      } else {
        mergedMap.set(item.trackingNumber, { ...item, originalTitle: item.title });
      }
    }

    // Fetch giaonhan_sync activity logs for this user to check sync status
    const syncedTrackings = new Set<string>();
    try {
      const userId = await getEbayUsername();
      if (userId) {
        const { data, error } = await supabase
          .from('activity_log')
          .select('target')
          .eq('user_id', userId)
          .eq('action', 'giaonhan_sync');
        if (data && !error) {
          data.forEach(row => {
            if (row.target) {
              syncedTrackings.add(String(row.target).trim());
            }
          });
        }
      }
    } catch (e) {
      console.error('[Purchases] Failed to fetch activity logs:', e);
    }

    // Fetch lot assignments for lotName and lotId
    const lotMap = new Map<string, { lotId: string; lotName: string }>();
    try {
      const userId = await getEbayUsername();
      if (userId) {
        const { data, error } = await supabase
          .from('lot_items')
          .select('tracking_number, lot_id, lots(name)')
          .eq('user_id', userId);
        
        if (data && !error) {
          data.forEach((row: any) => {
            if (row.tracking_number && row.lot_id) {
              lotMap.set(String(row.tracking_number).trim(), {
                lotId: row.lot_id,
                lotName: row.lots?.name || 'Lô không tên',
              });
            }
          });
        }
      }
    } catch (e) {
      console.error('[Purchases] Failed to fetch lot assignments:', e);
    }

    const finalItems = Array.from(mergedMap.values()).concat(noTrackingItems);
    // Clean up internal fields and assign isSynced and lot details
    finalItems.forEach(item => {
      const trackingClean = item.trackingNumber ? String(item.trackingNumber).trim() : '';
      if (trackingClean && syncedTrackings.has(trackingClean)) {
        item.isSynced = true;
      } else {
        item.isSynced = false;
      }

      if (trackingClean && lotMap.has(trackingClean)) {
        const lotInfo = lotMap.get(trackingClean);
        item.lotId = lotInfo?.lotId;
        item.lotName = lotInfo?.lotName;
      }

      delete item.mergedTitles;
      delete item.originalTitle;
    });
    // Re-sort after merging
    finalItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ items: finalItems });
  } catch (error) {
    console.error('Purchases API Exception:', error);
    return NextResponse.json({ error: 'Server exception' }, { status: 500 });
  }
}
