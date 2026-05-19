import { EbayItem, EbayItemDetail } from './types';

// Mock data for development while waiting for eBay API approval
export const MOCK_ITEMS: EbayItem[] = [
  {
    itemId: 'mock-001',
    title: '14K Gold Scrap Lot - Broken Chains, Rings, Earrings 15.3g',
    price: '425.00',
    currency: 'USD',
    imageUrl: 'https://placehold.co/400x400/1e1e1e/c9a84c?text=Gold+Scrap+1',
    itemWebUrl: 'https://ebay.com/itm/mock-001',
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
    seller: { username: 'golddealer99', feedbackScore: 2451, feedbackPercentage: '99.8' },
    condition: 'Used',
    listingType: 'AUCTION',
    bidCount: 12,
    shippingCost: '8.50',
  },
  {
    itemId: 'mock-002',
    title: 'Gold Filled Lot 1/20 12K GF Chains Bracelets Recovery 82g',
    price: '145.00',
    currency: 'USD',
    imageUrl: 'https://placehold.co/400x400/1e1e1e/c9a84c?text=GF+Lot',
    itemWebUrl: 'https://ebay.com/itm/mock-002',
    endTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 min
    seller: { username: 'recyclegold_us', feedbackScore: 890, feedbackPercentage: '99.2' },
    condition: 'Used',
    listingType: 'AUCTION',
    bidCount: 8,
    shippingCost: '6.70',
  },
  {
    itemId: 'mock-003',
    title: '10K 14K 18K Gold Scrap Lot Mixed Jewelry 28.7 Grams',
    price: '890.00',
    currency: 'USD',
    imageUrl: 'https://placehold.co/400x400/1e1e1e/c9a84c?text=Mixed+Gold',
    itemWebUrl: 'https://ebay.com/itm/mock-003',
    endTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours
    seller: { username: 'precious_metals_inc', feedbackScore: 5632, feedbackPercentage: '99.9' },
    condition: 'Used',
    listingType: 'AUCTION',
    bidCount: 24,
    shippingCost: '12.00',
  },
  {
    itemId: 'mock-004',
    title: 'Gold Recovery CPU Lot - Pentium Pro Ceramic Processors x20',
    price: '560.00',
    currency: 'USD',
    imageUrl: 'https://placehold.co/400x400/1e1e1e/c9a84c?text=CPU+Gold',
    itemWebUrl: 'https://ebay.com/itm/mock-004',
    endTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day
    seller: { username: 'techscrap2024', feedbackScore: 342, feedbackPercentage: '98.5' },
    condition: 'Used',
    listingType: 'FIXED_PRICE',
    shippingCost: '20.00',
  },
  {
    itemId: 'mock-005',
    title: '1/10 10K Gold Filled Chains Lot Vintage Necklaces 45g',
    price: '95.50',
    currency: 'USD',
    imageUrl: 'https://placehold.co/400x400/1e1e1e/c9a84c?text=10K+GF',
    itemWebUrl: 'https://ebay.com/itm/mock-005',
    endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours
    seller: { username: 'vintage_jewels_shop', feedbackScore: 1205, feedbackPercentage: '99.5' },
    condition: 'Used',
    listingType: 'AUCTION',
    bidCount: 5,
    shippingCost: '5.50',
  },
  {
    itemId: 'mock-006',
    title: 'Gold Bullion Scrap - Broken Bars and Fragments 8.2g .999',
    price: '480.00',
    currency: 'USD',
    imageUrl: 'https://placehold.co/400x400/1e1e1e/c9a84c?text=Bullion',
    itemWebUrl: 'https://ebay.com/itm/mock-006',
    endTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
    seller: { username: 'golddealer99', feedbackScore: 2451, feedbackPercentage: '99.8' },
    condition: 'Used',
    listingType: 'AUCTION',
    bidCount: 18,
    shippingCost: '15.00',
  },
  {
    itemId: 'mock-007',
    title: '12K Gold Filled Watch Cases Lot Scrap Recovery 120g',
    price: '210.00',
    currency: 'USD',
    imageUrl: 'https://placehold.co/400x400/1e1e1e/c9a84c?text=Watch+Cases',
    itemWebUrl: 'https://ebay.com/itm/mock-007',
    endTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
    seller: { username: 'watchpart_king', feedbackScore: 4780, feedbackPercentage: '99.7' },
    condition: 'Used',
    listingType: 'AUCTION',
    bidCount: 9,
    shippingCost: '10.00',
  },
  {
    itemId: 'mock-008',
    title: 'Gold Plated Connector Pins Lot - 5 lbs Recovery Grade',
    price: '175.00',
    currency: 'USD',
    imageUrl: 'https://placehold.co/400x400/1e1e1e/c9a84c?text=Pins+Gold',
    itemWebUrl: 'https://ebay.com/itm/mock-008',
    endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours
    seller: { username: 'e_waste_pros', feedbackScore: 678, feedbackPercentage: '98.9' },
    condition: 'Not Specified',
    listingType: 'FIXED_PRICE',
    shippingCost: '18.85',
  },
];

export function getMockItemDetail(itemId: string): EbayItemDetail | null {
  const item = MOCK_ITEMS.find((i) => i.itemId === itemId);
  if (!item) return null;
  return {
    ...item,
    description: `<p>This is a <strong>genuine gold scrap lot</strong> perfect for recovery and refining.</p>
    <p>All items shown in photos are included in this lot. Weight verified on calibrated scale.</p>
    <ul>
      <li>Weight: as stated in title</li>
      <li>Tested with XRF analyzer</li>
      <li>Ships within 1 business day</li>
      <li>Insurance included</li>
    </ul>
    <p>Please check my other auctions for more gold scrap lots! Combined shipping available.</p>`,
    images: [
      item.imageUrl,
      'https://placehold.co/400x400/1e1e1e/c9a84c?text=Detail+2',
      'https://placehold.co/400x400/1e1e1e/c9a84c?text=Detail+3',
    ],
    shippingOptions: [
      { type: 'USPS Priority Mail', cost: item.shippingCost || '0.00' },
    ],
    itemLocation: 'New York, NY, United States',
  };
}
