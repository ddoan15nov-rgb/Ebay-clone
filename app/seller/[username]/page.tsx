'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Star, User, ExternalLink } from 'lucide-react';
import ItemCard from '@/components/ItemCard';
import ItemCardSkeleton from '@/components/ItemCardSkeleton';
import { useFavorites, useBlockedSellers } from '@/hooks/useLocalStorage';
import { EbayItem } from '@/lib/types';

const PAGE_SIZE = 20;

export default function SellerPage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { blockSeller } = useBlockedSellers();

  const [items, setItems] = useState<EbayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sellerInfo, setSellerInfo] = useState<{
    username: string;
    feedbackScore: number;
    feedbackPercentage: string;
  } | null>(null);
  const [total, setTotal] = useState(0);

  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Hide tab bar on detail pages
  useEffect(() => {
    document.body.classList.add('no-tab-bar');
    return () => document.body.classList.remove('no-tab-bar');
  }, []);

  const fetchItems = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      offsetRef.current = 0;
      setHasMore(true);
    }

    try {
      const currentOffset = isLoadMore ? offsetRef.current + PAGE_SIZE : 0;
      const res = await fetch(
        `/api/ebay/seller/${encodeURIComponent(username)}?limit=${PAGE_SIZE}&offset=${currentOffset}`
      );
      const data = await res.json();
      const newItems: EbayItem[] = data.items || [];

      if (isLoadMore) {
        setItems(prev => [...prev, ...newItems]);
        offsetRef.current = currentOffset;
      } else {
        setItems(newItems);
        offsetRef.current = 0;
        if (data.seller) setSellerInfo(data.seller);
        if (data.total) setTotal(data.total);
      }

      if (newItems.length < PAGE_SIZE) setHasMore(false);
    } catch (err) {
      console.error('Failed to fetch seller items', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [username]);

  // Initial fetch
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          fetchItems(true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, fetchItems]);

  const feedbackPct = parseFloat(sellerInfo?.feedbackPercentage || '0');
  const feedbackColor = feedbackPct >= 99 ? 'var(--success)' : feedbackPct >= 95 ? '#f1c40f' : 'var(--danger)';

  return (
    <div className="page-container" style={{ paddingTop: 0 }}>
      {/* Header */}
      <div className="glass-header" style={{
        position: 'sticky', top: 0, zIndex: 20,
        padding: '12px 0 8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: 'none', border: 'none', color: 'var(--text)',
              cursor: 'pointer', padding: 4, display: 'flex',
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--gold-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={18} color="var(--gold)" />
              </div>
              <div>
                <h1 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                  {decodeURIComponent(username)}
                </h1>
                {sellerInfo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Star size={12} color={feedbackColor} fill={feedbackColor} />
                    <span style={{ fontSize: '0.72rem', color: feedbackColor, fontWeight: 600 }}>
                      {sellerInfo.feedbackPercentage}%
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                      ({sellerInfo.feedbackScore} đánh giá)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <a
            href={`https://www.ebay.com/sch/${username}/m.html`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '6px 12px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-muted)',
              fontSize: '0.7rem', fontWeight: 600,
              textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            eBay <ExternalLink size={11} />
          </a>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>
          {total > 0 ? `${total} sản phẩm đang bán` : 'Đang tải...'}
        </p>
      </div>

      {/* Items grid */}
      {loading ? (
        <div className="item-grid" style={{ marginTop: 12 }}>
          <ItemCardSkeleton count={4} />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <User size={48} />
          <p>Không tìm thấy sản phẩm</p>
          <p style={{ fontSize: '0.75rem', marginTop: 4 }}>
            Người bán này hiện chưa có sản phẩm nào
          </p>
        </div>
      ) : (
        <>
          <div className="item-grid" style={{ marginTop: 12 }}>
            {items.map((item, index) => (
              <ItemCard
                key={item.itemId}
                item={item}
                isFavorite={isFavorite(item.itemId)}
                onToggleFavorite={toggleFavorite}
                onBlockSeller={blockSeller}
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
              {loadingMore && <div className="spinner" />}
            </div>
          )}

          {!hasMore && items.length > PAGE_SIZE && (
            <p style={{
              textAlign: 'center', fontSize: '0.7rem',
              color: 'var(--text-dim)', padding: '16px 0',
            }}>
              Đã hiển thị tất cả {items.length} sản phẩm
            </p>
          )}
        </>
      )}
    </div>
  );
}
