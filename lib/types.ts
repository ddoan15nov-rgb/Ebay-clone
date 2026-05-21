// eBay item from search results
export interface EbayItem {
  itemId: string;
  title: string;
  price: string;
  currency: string;
  imageUrl: string;
  itemWebUrl: string;
  endTime: string;
  seller: {
    username: string;
    feedbackScore: number;
    feedbackPercentage: string;
  };
  condition: string;
  listingType: string; // 'AUCTION' | 'FIXED_PRICE'
  bidCount?: number;
  shippingCost?: string;
}

// eBay item full detail
export interface EbayItemDetail extends EbayItem {
  description: string;
  images: string[];
  shippingOptions: {
    type: string;
    cost: string;
  }[];
  itemLocation: string;
  buyingOptions?: string[];
  isSold?: boolean;
  winner?: string;
}

// Gixen snipe
export interface GixenSnipe {
  itemId: string;
  maxBid: number;
  status: 'active' | 'pending' | 'error';
}

// Purchase entry (Mua Hàng)
export interface PurchaseEntry {
  id: string;
  imageUrl: string;
  title: string;
  gia: number;      // Purchase price
  ship: number;     // Shipping cost
  tong: number;     // Auto: gia + ship
  tracked: boolean; // Has tracking?
  trackingNumber?: string; // eBay tracking
  carrier?: string; // eBay shipping carrier
  status: 'pending' | 'paid' | 'shipped' | 'delivered';
  paidTime?: string;
  shippedTime?: string;
  lo: string;       // Batch label
  ebayItemId?: string; // Link to original eBay item
  createdAt: string;
  isSynced?: boolean; // Giaonhan247 sync status
  lotId?: string;     // ID of assigned lot
  lotName?: string;   // Name of assigned lot
  intlShippingVnd?: number; // International shipping in VND
}

export interface Lot {
  id: string;
  name: string;
  status: 'active' | 'closed';
  revenue: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Computed properties
  itemCount?: number;
  totalCost?: number;
  profit?: number;
  factor?: number; // Tỷ suất lợi nhuận (%)
  items?: LotItem[];
}

export interface LotItem {
  id: string;
  lotId: string;
  trackingNumber: string;
  ebayItemId?: string;
  ebayUrl?: string;
  title?: string;
  price: number;
  shipping: number;
  intlShippingVnd: number; // Phí vận chuyển quốc tế (VND), quy đổi USD = VND / 27
  imageUrl?: string;
  synced: boolean;
  createdAt: string;
}

// Filter state
export interface FilterState {
  listingType: 'ALL' | 'AUCTION' | 'FIXED_PRICE';
  sort: 'endingSoonest' | 'price' | 'newlyListed';
  minPrice: number;
  maxPrice: number;
  condition: 'ALL' | 'USED' | 'NOT_SPECIFIED';
  usOnly: boolean;
  negativeWords: string;
}

export const DEFAULT_FILTERS: FilterState = {
  listingType: 'ALL',
  sort: 'endingSoonest',
  minPrice: 0,
  maxPrice: 5000,
  condition: 'ALL',
  usOnly: false,
  negativeWords: '',
};

export const KEYWORDS = [
  'gold scrap lot',
  'gold filled lot',
  '1/20 12k lot',
  '1/10 10k lot',
  'gold bullion scrap',
  'recovery gold',
];
