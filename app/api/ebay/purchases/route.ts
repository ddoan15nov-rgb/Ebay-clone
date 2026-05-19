import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { XMLParser } from 'fast-xml-parser';

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const userToken = cookieStore.get('ebay_user_token')?.value;

  if (!userToken) {
    return NextResponse.json({ error: 'Not authenticated', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  // Request WonList with detailed output selectors for price/shipping/tracking
  const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBayBuyingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <DetailLevel>ReturnAll</DetailLevel>
  <WonList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>100</EntriesPerPage>
      <PageNumber>1</PageNumber>
    </Pagination>
  </WonList>
</GetMyeBayBuyingRequest>`;

  try {
    const res = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'GetMyeBayBuying',
        'X-EBAY-API-IAF-TOKEN': userToken,
      },
      body: xmlRequest,
    });

    const xmlResponse = await res.text();

    if (!res.ok) {
      return NextResponse.json({ error: 'eBay API error' }, { status: res.status });
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      textNodeName: '_text',
    });

    const result = parser.parse(xmlResponse);
    const responseData = result.GetMyeBayBuyingResponse;

    if (responseData.Ack !== 'Success' && responseData.Ack !== 'Warning') {
      const errorMsg = responseData.Errors?.ShortMessage || 'Unknown error fetching purchases';
      if (errorMsg.includes('Auth token is invalid')) {
        return NextResponse.json({ error: 'Session expired', code: 'AUTH_REQUIRED' }, { status: 401 });
      }
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    // Extract OrderTransactions from WonList
    const wonList = responseData.WonList;
    if (!wonList || !wonList.OrderTransactionArray) {
      return NextResponse.json({ items: [] });
    }

    let orderTransactions = wonList.OrderTransactionArray?.OrderTransaction || [];
    if (!Array.isArray(orderTransactions)) {
      orderTransactions = [orderTransactions];
    }

    // Debug: log the full structure of the first transaction
    if (orderTransactions.length > 0) {
      const first = orderTransactions[0];
      console.log('[Purchases] First OT keys:', Object.keys(first));
      if (first.Transaction) {
        console.log('[Purchases]   Transaction keys:', Object.keys(first.Transaction));
        if (first.Transaction.Item) {
          console.log('[Purchases]   Item keys:', Object.keys(first.Transaction.Item));
        }
        if (first.Transaction.Status) {
          console.log('[Purchases]   Status:', JSON.stringify(first.Transaction.Status));
        }
        if (first.Transaction.ShippingDetails) {
          console.log('[Purchases]   ShippingDetails:', JSON.stringify(first.Transaction.ShippingDetails));
        }
        // Log price-related fields
        console.log('[Purchases]   TransactionPrice:', first.Transaction.TransactionPrice);
        console.log('[Purchases]   TotalTransactionPrice:', first.Transaction.TotalTransactionPrice);
        console.log('[Purchases]   ActualShippingCost:', first.Transaction.ActualShippingCost);
      }
      if (first.Order) {
        console.log('[Purchases]   Order keys:', Object.keys(first.Order));
        if (first.Order.ShippingServiceSelected) {
          console.log('[Purchases]   Order.ShippingServiceSelected:', JSON.stringify(first.Order.ShippingServiceSelected));
        }
        if (first.Order.ShippingDetails) {
          console.log('[Purchases]   Order.ShippingDetails:', JSON.stringify(first.Order.ShippingDetails));
        }
      }
    }

    const allTransactions: any[] = [];

    orderTransactions.forEach((ot: any) => {
      if (ot.Transaction) {
        allTransactions.push({ t: ot.Transaction, o: null });
      }
      if (ot.Order && ot.Order.TransactionArray && ot.Order.TransactionArray.Transaction) {
        let txs = ot.Order.TransactionArray.Transaction;
        if (!Array.isArray(txs)) txs = [txs];
        txs.forEach((t: any) => allTransactions.push({ t, o: ot.Order }));
      }
    });

    const mappedPurchases = allTransactions.map(({ t, o }) => {
      if (!t || !t.Item) return null;

      const item = t.Item;

      // === Price extraction — try multiple locations ===
      const rawPrice = t.TransactionPrice?._text
        ?? t.TransactionPrice
        ?? t.TotalTransactionPrice?._text
        ?? t.TotalTransactionPrice
        ?? t.Item?.SellingStatus?.CurrentPrice?._text
        ?? t.Item?.SellingStatus?.CurrentPrice
        ?? '0';
      const price = parseFloat(String(rawPrice));

      // === Shipping cost extraction ===
      let shipCost = 0;
      // 1. Transaction.ActualShippingCost (most reliable for completed purchases)
      if (t.ActualShippingCost) {
        shipCost = parseFloat(t.ActualShippingCost?._text ?? String(t.ActualShippingCost) ?? '0');
      }
      // 2. Order-level shipping
      else if (o?.ShippingServiceSelected?.ShippingServiceCost) {
        shipCost = parseFloat(o.ShippingServiceSelected.ShippingServiceCost?._text ?? String(o.ShippingServiceSelected.ShippingServiceCost) ?? '0');
      }
      // 3. Transaction-level shipping selection
      else if (t.ShippingServiceSelected?.ShippingServiceCost) {
        shipCost = parseFloat(t.ShippingServiceSelected.ShippingServiceCost?._text ?? String(t.ShippingServiceSelected.ShippingServiceCost) ?? '0');
      }

      // === Tracking extraction ===
      let trackingDetails = t.ShippingDetails?.ShipmentTrackingDetails;
      if (!trackingDetails && o?.ShippingDetails?.ShipmentTrackingDetails) {
        trackingDetails = o.ShippingDetails.ShipmentTrackingDetails;
      }
      const trackingInfo = Array.isArray(trackingDetails) ? trackingDetails[0] : trackingDetails;

      // === Status extraction ===
      const paidTime = t.PaidTime || o?.PaidTime || '';
      const shippedTime = t.ShippedTime || o?.ShippedTime || '';
      const checkoutStatus = t.Status?.CheckoutStatus || '';
      const buyerPaidStatus = t.BuyerPaidStatus || '';

      let status: 'pending' | 'paid' | 'shipped' | 'delivered' = 'pending';
      if (shippedTime || trackingInfo) {
        status = 'shipped';
      } else if (paidTime || buyerPaidStatus === 'PaidWithPayPal' || buyerPaidStatus === 'Paid' || checkoutStatus === 'CheckoutComplete') {
        status = 'paid';
      }

      return {
        id: t.TransactionID || t.OrderLineItemID || `p_${item.ItemID}`,
        ebayItemId: item.ItemID,
        title: item.Title,
        imageUrl: item.PictureDetails?.GalleryURL || '',
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
        createdAt: t.CreatedDate || o?.CreatedTime || new Date().toISOString(),
      };
    }).filter(Boolean);

    return NextResponse.json({ items: mappedPurchases });
  } catch (error) {
    console.error('Purchases API Exception:', error);
    return NextResponse.json({ error: 'Server exception' }, { status: 500 });
  }
}
