import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { XMLParser } from 'fast-xml-parser';

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const userToken = cookieStore.get('ebay_user_token')?.value;

  if (!userToken) {
    return NextResponse.json({ error: 'Not authenticated', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBayBuyingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <DetailLevel>ReturnAll</DetailLevel>
  <WatchList>
    <Sort>TimeLeft</Sort>
    <Pagination>
      <EntriesPerPage>200</EntriesPerPage>
      <PageNumber>1</PageNumber>
    </Pagination>
    <Include>true</Include>
  </WatchList>
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
      console.error('Trading API Error:', xmlResponse);
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
      const errorMsg = responseData.Errors?.ShortMessage || 'Unknown error fetching watchlist';
      if (errorMsg.includes('Auth token is invalid')) {
        return NextResponse.json({ error: 'Session expired', code: 'AUTH_REQUIRED' }, { status: 401 });
      }
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    // Extract items from WatchList array
    const watchListItems = responseData.WatchList?.ItemArray?.Item || [];
    // If it's a single item, parser might return an object instead of array
    const itemsArray = Array.isArray(watchListItems) ? watchListItems : (watchListItems.ItemID ? [watchListItems] : []);

    const mappedItems = itemsArray.map((item: any) => {
      // eBay Trading API returns prices in SellingStatus.CurrentPrice
      // Use ?? (nullish coalescing) not || to handle $0 prices correctly
      const currentPrice = item.SellingStatus?.CurrentPrice;
      const priceVal = currentPrice?._text ?? currentPrice ?? item.StartPrice?._text ?? item.StartPrice ?? '0';
      const currency = currentPrice?.['@_currencyID'] || 'USD';
      
      const listingTypeRaw = item.ListingType || '';
      const isAuction = ['Chinese', 'Dutch', 'Auction'].includes(listingTypeRaw) 
        || listingTypeRaw.toLowerCase().includes('auction');

      // Extract shipping cost — multiple fallback paths for Trading API
      let shippingCost: string | undefined;
      const shippingDetails = item.ShippingDetails;
      if (shippingDetails) {
        // Path 1a: ShippingServiceOption (singular — some endpoints)
        const option = shippingDetails.ShippingServiceOption;
        // Path 1b: ShippingServiceOptions (plural — watchlist endpoint uses this!)
        const options = option || shippingDetails.ShippingServiceOptions;
        const firstOption = Array.isArray(options) ? options[0] : options;
        if (firstOption?.ShippingServiceCost) {
          const cost = firstOption.ShippingServiceCost?._text ?? firstOption.ShippingServiceCost;
          if (cost !== undefined && cost !== null) {
            shippingCost = String(cost);
          }
        }
        // Path 2: ShippingServiceCost directly at ShippingDetails level
        if (!shippingCost && shippingDetails.ShippingServiceCost) {
          const cost = shippingDetails.ShippingServiceCost?._text ?? shippingDetails.ShippingServiceCost;
          if (cost !== undefined && cost !== null) shippingCost = String(cost);
        }
      }
      // Path 3: Item.ShippingCost (sometimes returned directly)
      if (!shippingCost && item.ShippingCost) {
        const cost = item.ShippingCost?._text ?? item.ShippingCost;
        if (cost !== undefined && cost !== null) shippingCost = String(cost);
      }
      // Path 4: SellingStatus.FinalValueFee implies free shipping if not set
      // Path 5: Check for FreeShipping flag
      if (!shippingCost && shippingDetails?.ShippingType === 'Free') {
        shippingCost = '0.00';
      }
      // Format price as a string with 2 decimals for display consistency
      const priceFormatted = Number(priceVal) ? Number(priceVal).toFixed(2) : String(priceVal);

      return {
        itemId: item.ItemID,
        title: item.Title,
        price: priceFormatted,
        currency: currency,
        imageUrl: item.PictureDetails?.GalleryURL || '',
        itemWebUrl: item.ListingDetails?.ViewItemURL || `https://www.ebay.com/itm/${item.ItemID}`,
        endTime: item.ListingDetails?.EndTime || '',
        seller: {
          username: item.Seller?.UserID || 'unknown',
          feedbackScore: item.Seller?.FeedbackScore || 0,
          feedbackPercentage: item.Seller?.PositiveFeedbackPercent || '0',
        },
        condition: item.ConditionDisplayName || 'Not Specified',
        listingType: isAuction ? 'AUCTION' : 'FIXED_PRICE',
        bidCount: item.SellingStatus?.BidCount || 0,
        shippingCost,
      };
    });

    return NextResponse.json({ items: mappedItems });
  } catch (error) {
    console.error('Watchlist exception:', error);
    return NextResponse.json({ error: 'Server exception' }, { status: 500 });
  }
}
