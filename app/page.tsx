'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal, RefreshCw, Wifi, WifiOff, Search, X, Link as LinkIcon } from 'lucide-react';
import ItemCard from '@/components/ItemCard';
import FilterDrawer from '@/components/FilterDrawer';
import { useFavorites, useBlockedSellers, useLocalStorage } from '@/hooks/useLocalStorage';
import { EbayItem, FilterState, DEFAULT_FILTERS, KEYWORDS } from '@/lib/types';

// Detect if input is an eBay URL and extract item ID
function extractEbayItemId(input: string): string | null {
  const trimmed = input.trim();

  // Match patterns like:
  // https://www.ebay.com/itm/123456789
  // https://www.ebay.com/itm/Some-Title/123456789
  // https://ebay.com/itm/123456789?...
  // ebay.com/itm/123456789
  const urlMatch = trimmed.match(/ebay\.com\/itm\/(?:[^/]*\/)?(\d+)/i);
  if (urlMatch) return urlMatch[1];

  // Also match just a bare item ID (10-15 digits)
  const idMatch = trimmed.match(/^(\d{10,15})$/);
  if (idMatch) return idMatch[1];

  return null;
}

// ──── Module-level cache — survives across client navigations ────
// This is why back-navigation is instant: the JS module never unloads,
// so items are already in memory when the component re-mounts.
let _cachedItems: EbayItem[] = [];
let _cachedSource: 'ebay' | 'mock' = 'mock';
let _cachedScrollY = 0;
let _cachedKeyword = '';
let _cachedFiltersHash = '';
let _cachedOffset = 0;
let _cachedHasMore = true;
let _cacheFromBack = false; // true when component re-mounts from back-nav

// Build a deterministic hash of the filter state for comparison
function filtersHash(f: FilterState): string {
  return `${f.listingType}|${f.sort}|${f.minPrice}|${f.maxPrice}|${f.condition}|${f.usOnly}|${f.negativeWords}`;
}

export default function HomePage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState(KEYWORDS[0]);
  const [searchInput, setSearchInput] = useState('');
  const [isCustomSearch, setIsCustomSearch] = useState(false);
  const [filters, setFilters, filtersLoaded] = useLocalStorage<FilterState>('gold_filters', DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [items, setItems] = useState<EbayItem[]>(_cachedItems);
  const [loading, setLoading] = useState(_cachedItems.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [source, setSource] = useState<'ebay' | 'mock'>(_cachedSource);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasMore, setHasMore] = useState(_cachedHasMore);
  // Track whether this mount is a back-navigation (cache hit) — skip card animations
  const [isCacheRestore, setIsCacheRestore] = useState(_cachedItems.length > 0);

  const offsetRef = React.useRef(_cachedOffset);
  const isFetchingRef = React.useRef(false);

  const { toggleFavorite, isFavorite } = useFavorites();
  const { blockSeller, isBlocked } = useBlockedSellers();

  // Load snipe bids for badge display on cards
  const [snipes, setSnipes] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch('/api/sync/snipes')
      .then((r) => r.json())
      .then((data) => {
        if (data.snipes) {
          const map: Record<string, string> = {};
          data.snipes.forEach((s: any) => { map[s.itemId] = String(s.maxBid); });
          setSnipes(map);
        }
      })
      .catch(() => {});
  }, []);

  // Restore scroll position on back-navigation
  useEffect(() => {
    if (_cachedScrollY > 0 && _cachedItems.length > 0) {
      window.scrollTo(0, _cachedScrollY);
      _cachedScrollY = 0;
    }
    // Save scroll position when leaving
    return () => {
      _cachedScrollY = window.scrollY;
    };
  }, []);

  // Sync negative keywords from server (persists across browsers)
  useEffect(() => {
    if (!filtersLoaded) return;
    fetch('/api/sync/keywords')
      .then(r => r.json())
      .then(data => {
        if (data.keywords && data.keywords !== filters.negativeWords) {
          setFilters(prev => ({ ...prev, negativeWords: data.keywords }));
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersLoaded]);

  // The active search keyword (either from chips or custom input)
  const activeKeyword = isCustomSearch ? searchInput : keyword;

  // Stable fetch function using refs to avoid dependency loops
  const fetchItems = useCallback(async (isLoadMore = false) => {
    if (!activeKeyword.trim() || !filtersLoaded) return;
    if (isFetchingRef.current) return; // prevent concurrent fetches
    isFetchingRef.current = true;

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      // Only show loading spinner if no cached items
      if (_cachedItems.length === 0) setLoading(true);
      offsetRef.current = 0;
      setHasMore(true);
    }

    try {
      const currentOffset = isLoadMore ? offsetRef.current + 40 : 0;

      const params = new URLSearchParams({
        keyword: activeKeyword,
        sort: filters.sort,
        listingType: filters.listingType,
        condition: filters.condition,
        limit: '40',
        offset: currentOffset.toString(),
      });
      if (filters.minPrice > 0) params.set('minPrice', String(filters.minPrice));
      if (filters.maxPrice < 5000) params.set('maxPrice', String(filters.maxPrice));
      if (filters.negativeWords) params.set('negativeWords', filters.negativeWords);

      const res = await fetch(`/api/ebay?${params}`);
      const data = await res.json();
      const newItems = data.items || [];

      if (isLoadMore) {
        const merged = [..._cachedItems, ...newItems];
        setItems(merged);
        _cachedItems = merged;
        offsetRef.current = currentOffset;
      } else {
        setItems(newItems);
        _cachedItems = newItems;
        offsetRef.current = 0;
      }

      // Only stop pagination if the API explicitly says there's no more data
      // (raw eBay returned fewer than limit — after our ended-item filter, count may be less)
      const rawTotal = data.total ?? -1;
      if (rawTotal >= 0 && currentOffset + 40 >= rawTotal) {
        setHasMore(false);
        _cachedHasMore = false;
      } else if (newItems.length === 0) {
        setHasMore(false);
        _cachedHasMore = false;
      } else {
        _cachedHasMore = true;
      }

      const newSource = data.source || 'mock';
      setSource(newSource);
      _cachedSource = newSource;
      setLastUpdated(new Date());

      // Update cache metadata so future mounts skip re-fetch
      _cachedKeyword = activeKeyword;
      _cachedFiltersHash = filtersHash(filters);
      _cachedOffset = offsetRef.current;
      // This is a fresh fetch, not a cache restore
      setIsCacheRestore(false);
    } catch {
      console.error('Fetch failed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKeyword, filters, filtersLoaded]);

  // Fetch only when needed — NOT on every mount
  // Skip if we already have cached data for the same keyword+filters
  useEffect(() => {
    if (!filtersLoaded) return;

    const currentHash = filtersHash(filters);
    const cacheValid =
      _cachedItems.length > 0 &&
      _cachedKeyword === activeKeyword &&
      _cachedFiltersHash === currentHash;

    if (cacheValid) {
      // Cache hit — show cached data instantly, no API call
      return;
    }

    // Cache miss — keyword or filters changed, fetch fresh data
    fetchItems();

    // No auto-refresh timer — user uses the refresh button manually
    // This conserves the eBay 5000/day API limit
  }, [filtersLoaded, fetchItems, activeKeyword, filters]);

  // Infinite Scroll via ref callback — attaches observer whenever sentinel mounts
  const observerRef = React.useRef<IntersectionObserver | null>(null);

  const sentinelRef = React.useCallback((node: HTMLDivElement | null) => {
    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!node) return;

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !isFetchingRef.current) {
          fetchItems(true);
        }
      },
      { threshold: 0, rootMargin: '400px' }
    );
    observerRef.current.observe(node);
  }, [fetchItems]);

  // Parse negative keywords once for filtering
  const negativeKeywords = React.useMemo(() => {
    if (!filters.negativeWords) return [];
    return filters.negativeWords
      .split(',')
      .map(w => w.trim().toLowerCase())
      .filter(Boolean);
  }, [filters.negativeWords]);

  // Filter out blocked sellers, ended auctions, AND negative keyword matches
  const visibleItems = items.filter((item) => {
    if (isBlocked(item.seller.username)) return false;
    // Only hide ended items if they're auctions — FIXED_PRICE "endTime" is just a renewal date
    if (item.listingType === 'AUCTION' && item.endTime) {
      const endMs = new Date(item.endTime).getTime();
      if (!isNaN(endMs) && endMs < Date.now()) return false;
    }
    // Client-side negative keyword filtering (eBay API doesn't always exclude reliably)
    if (negativeKeywords.length > 0) {
      const titleLower = item.title.toLowerCase();
      for (const word of negativeKeywords) {
        // Whole-word boundary match to avoid false positives
        // e.g. "gold" in negatives shouldn't block "gold scrap" — but "phone" should block "Cell Phones"
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(titleLower)) return false;
      }
    }
    return true;
  });

  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const input = searchInput.trim();
    if (!input) return;

    // Check if it's an eBay URL
    const itemId = extractEbayItemId(input);
    if (itemId) {
      // Navigate directly to item detail
      router.push(`/item/${itemId}`);
      return;
    }

    // Otherwise treat as a keyword search
    setIsCustomSearch(true);
  };

  // Handle chip click — clears custom search
  const handleChipClick = (kw: string) => {
    setKeyword(kw);
    setIsCustomSearch(false);
    setSearchInput('');
  };

  // Clear custom search
  const clearSearch = () => {
    setSearchInput('');
    setIsCustomSearch(false);
  };

  return (
    <div className={`page-container${!isCacheRestore ? ' page-transition' : ''}`}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          🥇 Gold Hunter
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => fetchItems()} disabled={loading}>
            <RefreshCw size={18} style={{ animation: loading ? 'spin 0.6s linear infinite' : 'none' }} />
          </button>
          <button className="btn-ghost" onClick={() => setFilterOpen(true)}>
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            padding: '0 12px',
            transition: 'border-color 0.2s',
          }}
        >
          <Search size={16} color="var(--text-dim)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm kiếm hoặc dán link eBay..."
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                flexShrink: 0,
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
        {/* eBay URL hint */}
        {searchInput && extractEbayItemId(searchInput) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 0 0',
              fontSize: '0.7rem',
              color: 'var(--gold)',
            }}
          >
            <LinkIcon size={11} />
            Link eBay được nhận dạng — nhấn Enter để xem sản phẩm
          </div>
        )}
      </form>

      {/* Data source indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        {source === 'ebay' ? (
          <Wifi size={12} color="var(--success)" />
        ) : (
          <WifiOff size={12} color="var(--text-dim)" />
        )}
        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
          {source === 'ebay' ? 'eBay trực tiếp' : 'Dữ liệu mẫu'}
          {lastUpdated && ` • ${lastUpdated.toLocaleTimeString('vi-VN')}`}
        </span>
      </div>

      {/* Keyword chips */}
      <div className="chip-row">
        {KEYWORDS.map((kw) => (
          <button
            key={kw}
            className={`chip ${!isCustomSearch && keyword === kw ? 'active' : ''}`}
            onClick={() => handleChipClick(kw)}
          >
            {kw}
          </button>
        ))}
      </div>

      {/* Current search indicator */}
      {isCustomSearch && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'var(--gold-glow)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 12,
          }}
        >
          <Search size={14} color="var(--gold)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--gold)', flex: 1 }}>
            Tìm: &quot;{searchInput}&quot;
          </span>
          <button
            onClick={clearSearch}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--gold)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Results count */}
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        {loading ? 'Đang tải...' : `${visibleItems.length} sản phẩm`}
      </p>

      {/* Item grid */}
      {loading && items.length === 0 ? (
        <div className="loading-center">
          <div className="spinner" />
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="empty-state">
          <p>Không tìm thấy sản phẩm nào</p>
        </div>
      ) : (
        <div className="item-grid">
          {visibleItems.map((item, index) => (
            <ItemCard
              key={`${item.itemId}-${index}`}
              item={item}
              isFavorite={isFavorite(item.itemId)}
              onToggleFavorite={toggleFavorite}
              onBlockSeller={blockSeller}
              snipeBid={snipes[item.itemId] || null}
              index={isCacheRestore ? -1 : index}
            />
          ))}
        </div>
      )}

      {/* Infinite Scroll Sentinel — always rendered so observer can attach */}
      {hasMore && items.length > 0 && (
        <div ref={sentinelRef} style={{ height: 1 }} />
      )}
      {loadingMore && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div className="spinner" style={{ display: 'inline-block', width: 20, height: 20 }} />
        </div>
      )}
      {!hasMore && items.length > 0 && (
        <p style={{ textAlign: 'center', padding: '16px 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          Đã hiển thị tất cả kết quả
        </p>
      )}

      <FilterDrawer
        isOpen={filterOpen}
        filters={filters}
        onClose={() => setFilterOpen(false)}
        onChange={setFilters}
      />
    </div>
  );
}
