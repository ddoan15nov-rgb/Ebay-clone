'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Heart, Search, Clock } from 'lucide-react';
import ItemCard from '@/components/ItemCard';
import ItemCardSkeleton from '@/components/ItemCardSkeleton';
import { useFavorites, useBlockedSellers } from '@/hooks/useLocalStorage';
import { EbayItem } from '@/lib/types';

const PAGE_SIZE = 20;

export default function FavoritesPage() {
  const { favorites, toggleFavorite, isFavorite, syncFavorites } = useFavorites();
  const { blockSeller } = useBlockedSellers();
  const [allItems, setAllItems] = useState<EbayItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = sessionStorage.getItem('gold_watchlist_cache');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !sessionStorage.getItem('gold_watchlist_cache');
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'ended'>('active');

  // Load snipe bids for badge display
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

  // Load favorite items from the eBay Watchlist API
  useEffect(() => {
    const fetchWatchlist = async () => {
      // Only show spinner if no cache
      if (allItems.length === 0) setLoading(true);
      try {
        const res = await fetch('/api/ebay/watchlist');
        const data = await res.json();

        if (res.status === 401 && data.code === 'AUTH_REQUIRED') {
          window.location.href = '/api/auth/login';
          return;
        }

        if (res.ok && data.items) {
          setAllItems(data.items);
          try { sessionStorage.setItem('gold_watchlist_cache', JSON.stringify(data.items)); } catch {}
          const remoteIds = data.items.map((i: EbayItem) => i.itemId);
          syncFavorites(remoteIds);
        }
      } catch (error) {
        console.error('Failed to fetch watchlist', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter(item =>
      item.title.toLowerCase().includes(q)
    );
  }, [allItems, searchQuery]);

  // Split items by active vs ended
  const now = Date.now();
  const { activeItems, endedItems } = useMemo(() => {
    const active: EbayItem[] = [];
    const ended: EbayItem[] = [];
    filteredItems.forEach(item => {
      const isAuction = item.listingType === 'AUCTION';
      const endTime = item.endTime ? new Date(item.endTime).getTime() : 0;
      if (isAuction && endTime && endTime < now) {
        ended.push(item);
      } else {
        active.push(item);
      }
    });
    return { activeItems: active, endedItems: ended };
  }, [filteredItems, now]);

  const currentItems = activeTab === 'active' ? activeItems : endedItems;

  // Items to display (paginated)
  const displayedItems = useMemo(() => {
    return currentItems.slice(0, visibleCount);
  }, [currentItems, visibleCount]);

  const hasMore = visibleCount < currentItems.length;

  // Reset visible count when search or tab changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, activeTab]);

  // Infinite scroll observer
  const loadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount(prev => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="page-container page-transition">
      <h1 className="page-title">
        <Heart
          size={22}
          color="var(--gold)"
          fill="var(--gold)"
          style={{ verticalAlign: -3, marginRight: 8 }}
        />
        Yêu Thích
      </h1>
      <p className="page-subtitle">
        {currentItems.length} sản phẩm
        {searchQuery && ` (tìm: "${searchQuery}")`}
      </p>

      {/* Active / Ended tabs */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 4,
        borderBottom: '1px solid var(--border)',
      }}>
        <button
          onClick={() => setActiveTab('active')}
          style={{
            flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
            background: 'none', fontSize: '0.82rem', fontWeight: 600,
            color: activeTab === 'active' ? 'var(--gold)' : 'var(--text-muted)',
            borderBottom: activeTab === 'active' ? '2px solid var(--gold)' : '2px solid transparent',
            transition: 'all 0.2s',
          }}
        >
          Đang hoạt động ({activeItems.length})
        </button>
        <button
          onClick={() => setActiveTab('ended')}
          style={{
            flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
            background: 'none', fontSize: '0.82rem', fontWeight: 600,
            color: activeTab === 'ended' ? 'var(--gold)' : 'var(--text-muted)',
            borderBottom: activeTab === 'ended' ? '2px solid var(--gold)' : '2px solid transparent',
            transition: 'all 0.2s',
          }}
        >
          <Clock size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          Đã kết thúc ({endedItems.length})
        </button>
      </div>

      {/* Search bar */}
      <div className="glass-header" style={{
        position: 'sticky', top: 0, zIndex: 10,
        padding: '8px 0 12px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 12,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}>
          <Search size={16} color="var(--text-dim)" />
          <input
            type="text"
            placeholder="Tìm trong yêu thích..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1, background: 'none', border: 'none',
              color: 'var(--text)', fontSize: '0.85rem',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none', border: 'none',
                color: 'var(--text-dim)', cursor: 'pointer',
                fontSize: '0.75rem', fontWeight: 600,
              }}
            >
              Xóa
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="item-grid">
          <ItemCardSkeleton count={4} />
        </div>
      ) : currentItems.length === 0 ? (
        <div className="empty-state">
          <Heart size={48} />
          <p>{searchQuery ? 'Không tìm thấy kết quả' : activeTab === 'ended' ? 'Không có sản phẩm đã kết thúc' : 'Chưa có sản phẩm yêu thích'}</p>
          <p style={{ fontSize: '0.75rem', marginTop: 4 }}>
            {searchQuery ? 'Thử từ khóa khác' : activeTab === 'ended' ? 'Sản phẩm đấu giá đã kết thúc sẽ xuất hiện ở đây' : 'Nhấn ❤️ trên sản phẩm để lưu vào đây'}
          </p>
        </div>
      ) : (
        <>
          <div className="item-grid">
            {displayedItems.map((item, index) => (
              <ItemCard
                key={item.itemId}
                item={item}
                isFavorite={isFavorite(item.itemId)}
                onToggleFavorite={toggleFavorite}
                onBlockSeller={blockSeller}
                snipeBid={snipes[item.itemId] || null}
                index={index}
              />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div
              ref={sentinelRef}
              style={{
                display: 'flex', justifyContent: 'center',
                padding: '20px 0',
              }}
            >
              <div className="spinner" />
            </div>
          )}

          {!hasMore && filteredItems.length > PAGE_SIZE && (
            <p style={{
              textAlign: 'center', fontSize: '0.7rem',
              color: 'var(--text-dim)', padding: '16px 0',
            }}>
              Đã hiển thị tất cả {filteredItems.length} sản phẩm
            </p>
          )}
        </>
      )}
    </div>
  );
}
