'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ShoppingCart, PackageCheck, Truck, ExternalLink, Package, CreditCard, Clock, Warehouse, CheckCircle, AlertTriangle, X, RefreshCw, FolderOpen, FolderPlus, Search } from 'lucide-react';
import { PurchaseEntry, Lot } from '@/lib/types';
import GiaonhanSyncWidget from '@/components/GiaonhanSyncWidget';
import LotSelector from '@/components/LotSelector';
import LotSummaryCard from '@/components/LotSummaryCard';

const STATUS_CONFIG = {
  pending: { label: 'Chờ thanh toán', icon: Clock, bg: 'rgba(241,196,15,0.12)', color: '#f1c40f', border: 'rgba(241,196,15,0.25)' },
  paid: { label: 'Đã thanh toán', icon: CreditCard, bg: 'rgba(52,152,219,0.12)', color: '#3498db', border: 'rgba(52,152,219,0.25)' },
  shipped: { label: 'Đã gửi hàng', icon: Truck, bg: 'rgba(46,204,113,0.12)', color: '#2ecc71', border: 'rgba(46,204,113,0.25)' },
  delivered: { label: 'Đã nhận', icon: PackageCheck, bg: 'rgba(46,204,113,0.2)', color: '#27ae60', border: 'rgba(46,204,113,0.35)' },
} as const;

const WAREHOUSE_OPTIONS = [
  { value: '8', label: 'Oregon (Mỹ)', flag: '🇺🇸' },
  { value: '13', label: 'Cali (Mỹ)', flag: '🇺🇸' },
  { value: '11', label: 'Frankfurt (Đức)', flag: '🇩🇪' },
  { value: '18', label: 'Langen (Đức)', flag: '🇩🇪' },
  { value: '7', label: 'Hàn Quốc', flag: '🇰🇷' },
  { value: '5', label: 'Úc', flag: '🇦🇺' },
  { value: '4', label: 'Anh', flag: '🇬🇧' },
  { value: '2', label: 'Nhật', flag: '🇯🇵' },
  { value: '17', label: 'Trung Quốc', flag: '🇨🇳' },
  { value: '19', label: 'Thái Lan', flag: '🇹🇭' },
];

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

export default function PurchasesPage() {
  const [items, setItems] = useState<PurchaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warehouseSelections, setWarehouseSelections] = useState<Record<string, string>>({});
  const [updatingWh, setUpdatingWh] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastId, setToastId] = useState(0);

  const [activeTab, setActiveTab] = useState<'all' | 'lots'>('all');
  const [lots, setLots] = useState<Lot[]>([]);
  const [showClosedLots, setShowClosedLots] = useState(false);
  const [createLotInput, setCreateLotInput] = useState('');
  const [createLotLoading, setCreateLotLoading] = useState(false);

  // Search & pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = toastId + 1;
    setToastId(id);
    setToasts(prev => [...prev, { id, type, message }]);
    // Auto-dismiss after 4s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, [toastId]);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const fetchLots = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/lots');
      if (res.ok) {
        const data = await res.json();
        setLots(data.lots || []);
      }
    } catch (err) {
      console.error('Failed to fetch lots', err);
    }
  }, []);

  const getLotItemDetails = async (trackingNumber: string) => {
    const item = items.find(i => i.trackingNumber === trackingNumber);
    if (!item) return {};
    return {
      ebayItemId: item.ebayItemId || '',
      ebayUrl: `https://www.ebay.com/itm/${item.ebayItemId}`,
      title: item.title,
      price: item.gia,
      shipping: item.ship,
      imageUrl: item.imageUrl,
      synced: item.isSynced || false
    };
  };

  const handleAssignLot = async (trackingNumber: string, lotId: string | null, lotName: string | null) => {
    try {
      const details = lotId ? await getLotItemDetails(trackingNumber) : {};
      const res = await fetch('/api/sync/lot-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: lotId || 'none',
          trackingNumber,
          ...details,
        }),
      });

      if (res.ok) {
        setItems(prevItems =>
          prevItems.map(item => {
            if (item.trackingNumber === trackingNumber) {
              return { ...item, lotId: lotId || undefined, lotName: lotName || undefined };
            }
            return item;
          })
        );
        addToast('success', lotId ? '✅ Đã phân lô sản phẩm thành công' : '✅ Đã gỡ sản phẩm khỏi lô');
        await fetchLots();
      } else {
        addToast('error', '❌ Lỗi gán sản phẩm vào lô');
      }
    } catch {
      addToast('error', '❌ Không thể kết nối đến máy chủ sync');
    }
  };

  const handleCreateLot = async (name: string): Promise<Lot | null> => {
    setCreateLotLoading(true);
    try {
      const res = await fetch('/api/sync/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok && data.lot) {
        addToast('success', `✅ Đã tạo lô mới: ${data.lot.name}`);
        await fetchLots();
        return data.lot;
      } else {
        addToast('error', data.error || '❌ Lỗi tạo lô mới');
        return null;
      }
    } catch {
      addToast('error', '❌ Không thể kết nối đến máy chủ sync');
      return null;
    } finally {
      setCreateLotLoading(false);
    }
  };

  const handleCloseLot = async (id: string, revenue: number) => {
    try {
      const res = await fetch('/api/sync/lots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'closed', revenue }),
      });
      if (res.ok) {
        addToast('success', '✅ Đã hoàn thành lô hàng và tính toán lợi nhuận');
        await fetchLots();
      } else {
        addToast('error', '❌ Lỗi hoàn thành lô hàng');
      }
    } catch {
      addToast('error', '❌ Không thể kết nối đến máy chủ sync');
    }
  };

  const handleReopenLot = async (id: string) => {
    try {
      const res = await fetch('/api/sync/lots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'active', revenue: 0 }),
      });
      if (res.ok) {
        addToast('success', '✅ Đã mở lại lô hàng');
        await fetchLots();
      } else {
        addToast('error', '❌ Lỗi mở lại lô hàng');
      }
    } catch {
      addToast('error', '❌ Không thể kết nối đến máy chủ sync');
    }
  };

  const handleDeleteLot = async (id: string) => {
    try {
      const res = await fetch('/api/sync/lots', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        addToast('success', '✅ Đã xóa lô hàng thành công');
        setItems(prevItems =>
          prevItems.map(item => {
            if (item.lotId === id) {
              return { ...item, lotId: undefined, lotName: undefined };
            }
            return item;
          })
        );
        await fetchLots();
      } else {
        addToast('error', '❌ Lỗi xóa lô hàng');
      }
    } catch {
      addToast('error', '❌ Không thể kết nối đến máy chủ sync');
    }
  };

  const fetchPurchasesPage = useCallback(async (page: number, append: boolean = false) => {
    if (append) setLoadingMore(true);
    try {
      const res = await fetch(`/api/ebay/purchases?page=${page}`);
      const data = await res.json();

      if (res.status === 401 && data.code === 'AUTH_REQUIRED') {
        window.location.href = '/api/auth/login';
        return;
      }

      if (res.ok && data.items) {
        if (append) {
          // Deduplicate by id when appending pages
          setItems(prev => {
            const existingIds = new Set(prev.map(i => i.id));
            const newItems = data.items.filter((i: PurchaseEntry) => !existingIds.has(i.id));
            return [...prev, ...newItems];
          });
        } else {
          setItems(data.items);
        }
        setCurrentPage(data.page || page);
        setHasMore(!!data.hasMore);
      } else if (!append) {
        setError(data.error || 'Failed to load');
      }
    } catch (err) {
      console.error('Failed to fetch purchases', err);
      if (!append) setError('Không thể kết nối');
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  const loadNextPage = useCallback(() => {
    if (loadingMore || !hasMore) return;
    fetchPurchasesPage(currentPage + 1, true);
  }, [loadingMore, hasMore, currentPage, fetchPurchasesPage]);

  useEffect(() => {
    const fetchInitial = async () => {
      await fetchPurchasesPage(1, false);

      // Fetch warehouse configurations from snipes sync API
      try {
        const syncRes = await fetch('/api/sync/snipes');
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          if (syncData.snipes) {
            const whMap: Record<string, string> = {};
            syncData.snipes.forEach((s: any) => {
              if (s.itemId.startsWith('wh_')) {
                const ebayId = s.itemId.replace('wh_', '');
                whMap[ebayId] = String(s.maxBid);
              }
            });
            setWarehouseSelections(whMap);
          }
        }
      } catch { /* ignore */ }
    };

    fetchInitial();
    fetchLots();
  }, [fetchLots, fetchPurchasesPage]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && activeTab === 'all') {
          loadNextPage();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadNextPage, activeTab]);

  // Client-side search filtering
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.trim().toLowerCase();
    return items.filter(item => {
      // Match by title
      if (item.title.toLowerCase().includes(q)) return true;
      // Match by full tracking number
      if (item.trackingNumber && item.trackingNumber.toLowerCase().includes(q)) return true;
      // Match by last 4 digits of tracking
      if (item.trackingNumber && item.trackingNumber.slice(-4).toLowerCase() === q) return true;
      // Match by ebay item id
      if (item.ebayItemId && item.ebayItemId.includes(q)) return true;
      // Match by lot name
      if (item.lotName && item.lotName.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [items, searchQuery]);

  const getWarehouseLabel = (id: string) => {
    const wh = WAREHOUSE_OPTIONS.find(w => w.value === id);
    return wh ? `${wh.flag} ${wh.label}` : `Kho #${id}`;
  };

  const handleUpdateWarehouse = async (ebayItemId: string, warehouseId: string, itemTitle: string) => {
    setUpdatingWh(prev => ({ ...prev, [ebayItemId]: true }));
    try {
      const res = await fetch('/api/sync/snipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: `wh_${ebayItemId}`,
          maxBid: parseInt(warehouseId),
          itemTitle: `Warehouse setting for ${itemTitle}`,
        }),
      });
      if (res.ok) {
        setWarehouseSelections(prev => ({ ...prev, [ebayItemId]: warehouseId }));
        addToast('success', `✅ Đã cập nhật kho → ${getWarehouseLabel(warehouseId)}`);
      } else {
        addToast('error', '❌ Lỗi cập nhật kho nhận — vui lòng thử lại');
      }
    } catch {
      addToast('error', '❌ Không thể kết nối đến máy chủ sync');
    } finally {
      setUpdatingWh(prev => ({ ...prev, [ebayItemId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: '80dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-container page-transition">
      {/* Toast notifications */}
      <div style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 360,
        pointerEvents: 'none',
      }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 10,
              background: toast.type === 'success'
                ? 'linear-gradient(135deg, rgba(46,204,113,0.15), rgba(46,204,113,0.08))'
                : 'linear-gradient(135deg, rgba(231,76,60,0.15), rgba(231,76,60,0.08))',
              border: toast.type === 'success'
                ? '1px solid rgba(46,204,113,0.3)'
                : '1px solid rgba(231,76,60,0.3)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              animation: 'slideInRight 0.3s ease-out',
              color: toast.type === 'success' ? '#2ecc71' : '#e74c3c',
              fontSize: '0.78rem',
              fontWeight: 500,
            }}
          >
            {toast.type === 'success'
              ? <CheckCircle size={16} style={{ flexShrink: 0 }} />
              : <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            }
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: 2,
                flexShrink: 0,
                opacity: 0.6,
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <h1 className="page-title" style={{ marginBottom: 4 }}>
        <ShoppingCart
          size={22}
          color="var(--gold)"
          style={{ verticalAlign: -3, marginRight: 8 }}
        />
        Mua Hàng
      </h1>
      <p className="page-subtitle">
        {items.length > 0 ? `${items.length} sản phẩm đã mua${searchQuery ? ` • ${filteredItems.length} kết quả` : ''}${hasMore ? ' (cuộn xuống để tải thêm)' : ''}` : 'Đồng bộ từ eBay'}
      </p>

      {/* Tab Selector */}
      <div style={{
        display: 'flex',
        gap: 8,
        margin: '16px 0',
        padding: 4,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        width: 'fit-content'
      }}>
        <button
          onClick={() => setActiveTab('all')}
          style={{
            padding: '6px 16px',
            fontSize: '0.78rem',
            fontWeight: 600,
            borderRadius: 7,
            border: 'none',
            background: activeTab === 'all' ? 'var(--card)' : 'none',
            color: activeTab === 'all' ? 'var(--gold)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'all' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          Tất cả sản phẩm
        </button>
        <button
          onClick={() => setActiveTab('lots')}
          style={{
            padding: '6px 16px',
            fontSize: '0.78rem',
            fontWeight: 600,
            borderRadius: 7,
            border: 'none',
            background: activeTab === 'lots' ? 'var(--card)' : 'none',
            color: activeTab === 'lots' ? 'var(--gold)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'lots' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          Theo Lô Hàng
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(231,76,60,0.1)',
          border: '1px solid rgba(231,76,60,0.2)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 16,
          fontSize: '0.8rem',
          color: 'var(--danger)',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Search Bar */}
      {activeTab === 'all' && items.length > 0 && (
        <div style={{
          position: 'relative',
          marginBottom: 12,
        }}>
          <Search size={14} style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-dim)',
            pointerEvents: 'none',
          }} />
          <input
            type="text"
            placeholder="Tìm theo tên, tracking, 4 số cuối, lô hàng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 34px',
              fontSize: '0.8rem',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text)',
              outline: 'none',
              transition: 'border-color 0.2s ease',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.4)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: 2,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Tab: Tất cả sản phẩm */}
      {activeTab === 'all' && (
        <>
          {filteredItems.length === 0 && !error ? (
            <div className="empty-state">
              <ShoppingCart size={48} />
              <p>{searchQuery ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm nào'}</p>
              <p style={{ fontSize: '0.75rem', marginTop: 4, color: 'var(--text-dim)' }}>
                {searchQuery ? `Thử tìm với từ khóa khác.` : 'Các sản phẩm bạn mua thành công sẽ tự động hiển thị ở đây.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredItems.map((entry) => {
                const statusConf = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConf.icon;
                const itemId = entry.ebayItemId || '';

                return (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: 12,
                      background: 'var(--card)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {/* Thumbnail */}
                    <a
                      href={`https://www.ebay.com/itm/${entry.ebayItemId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ flexShrink: 0 }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.imageUrl}
                        alt=""
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 8,
                          objectFit: 'cover',
                          background: 'var(--surface)',
                        }}
                      />
                    </a>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        lineHeight: 1.3,
                        margin: '0 0 6px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {entry.title}
                      </p>

                      {/* Price row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--gold)' }}>
                          ${entry.gia.toFixed(2)}
                        </span>
                        {entry.ship > 0 && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                            + ${entry.ship.toFixed(2)} ship
                          </span>
                        )}
                        {entry.ship === 0 && entry.gia > 0 && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: 600 }}>
                            Free ship
                          </span>
                        )}
                      </div>

                      {/* Status badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 10px',
                            borderRadius: 6,
                            background: statusConf.bg,
                            border: `1px solid ${statusConf.border}`,
                            color: statusConf.color,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                          }}
                        >
                          <StatusIcon size={11} /> {statusConf.label}
                        </span>

                        {/* Carrier badge */}
                        {entry.tracked && entry.carrier && (
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Package size={10} /> {entry.carrier}
                          </span>
                        )}
                      </div>

                      {/* Tracking Number Row — always visible */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 8px',
                        borderRadius: 6,
                        background: entry.trackingNumber
                          ? 'rgba(46, 204, 113, 0.06)'
                          : 'rgba(241, 196, 15, 0.06)',
                        border: entry.trackingNumber
                          ? '1px solid rgba(46, 204, 113, 0.15)'
                          : '1px solid rgba(241, 196, 15, 0.15)',
                        marginBottom: 8,
                      }}>
                        <Package size={12} style={{
                          flexShrink: 0,
                          color: entry.trackingNumber ? 'var(--success)' : 'var(--gold)',
                          opacity: 0.7,
                        }} />
                        {entry.trackingNumber ? (
                          <span style={{
                            fontSize: '0.68rem',
                            fontFamily: 'monospace',
                            color: 'var(--text-muted)',
                            letterSpacing: '0.03em',
                            wordBreak: 'break-all',
                          }}>
                            {entry.trackingNumber}
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '0.68rem',
                            color: 'var(--text-dim)',
                            fontStyle: 'italic',
                          }}>
                            Chưa có tracking number
                          </span>
                        )}
                      </div>

                      {/* Warehouse Selection Row */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 4,
                          padding: '6px 8px',
                          background: 'rgba(212, 175, 55, 0.03)',
                          border: '1px solid rgba(212, 175, 55, 0.1)',
                          borderRadius: 8,
                        }}
                      >
                        <Warehouse size={13} style={{ color: 'var(--gold)', opacity: 0.7, flexShrink: 0 }} />
                        <select
                          value={warehouseSelections[itemId] || '8'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWarehouseSelections(prev => ({ ...prev, [itemId]: val }));
                          }}
                          style={{
                            flex: 1,
                            padding: '3px 6px',
                            fontSize: '0.7rem',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          {WAREHOUSE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.flag} {opt.label}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleUpdateWarehouse(
                            itemId,
                            warehouseSelections[itemId] || '8',
                            entry.title
                          )}
                          disabled={updatingWh[itemId]}
                          style={{
                            padding: '4px 12px',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            background: updatingWh[itemId]
                              ? 'rgba(212, 175, 55, 0.08)'
                              : 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.1))',
                            color: 'var(--gold)',
                            border: '1px solid rgba(212, 175, 55, 0.3)',
                            borderRadius: 6,
                            cursor: updatingWh[itemId] ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                            minWidth: 75,
                            height: 26,
                            transition: 'all 0.2s ease',
                            boxShadow: updatingWh[itemId]
                              ? 'none'
                              : '0 1px 4px rgba(212, 175, 55, 0.15)',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={(e) => {
                            if (!updatingWh[itemId]) {
                              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(212, 175, 55, 0.35), rgba(212, 175, 55, 0.2))';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(212, 175, 55, 0.25)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!updatingWh[itemId]) {
                              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.1))';
                              e.currentTarget.style.boxShadow = '0 1px 4px rgba(212, 175, 55, 0.15)';
                            }
                          }}
                        >
                          {updatingWh[itemId] ? (
                            <RefreshCw size={12} className="spinner" />
                          ) : (
                            <>
                              <RefreshCw size={11} />
                              Cập nhật
                            </>
                          )}
                        </button>
                      </div>

                      {/* Giaonhan247 Sync Widget & Lot Selector */}
                      {entry.trackingNumber && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                          <GiaonhanSyncWidget
                            entry={entry}
                            defaultWarehouse={warehouseSelections[itemId]}
                          />
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Gán vào Lô:</span>
                            <LotSelector
                              entry={entry}
                              activeLots={lots.filter(l => l.status === 'active')}
                              onAssign={handleAssignLot}
                              onCreateLot={handleCreateLot}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* External link */}
                    <a
                      href={`https://www.ebay.com/itm/${entry.ebayItemId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'flex-start',
                        paddingTop: 2,
                        color: 'var(--text-dim)',
                      }}
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          <div ref={loadMoreRef} style={{ minHeight: 1 }} />
          {loadingMore && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              padding: '16px 0',
              color: 'var(--text-dim)',
              fontSize: '0.75rem',
            }}>
              <RefreshCw size={14} className="spinner" />
              <span>Đang tải thêm sản phẩm...</span>
            </div>
          )}
          {!hasMore && items.length > 0 && !searchQuery && (
            <div style={{
              textAlign: 'center',
              padding: '12px 0',
              fontSize: '0.7rem',
              color: 'var(--text-dim)',
              fontStyle: 'italic',
            }}>
              — Đã hiển thị tất cả {items.length} sản phẩm —
            </div>
          )}
        </>
      )}

      {/* Tab: Theo Lô Hàng */}
      {activeTab === 'lots' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Create Lot Form */}
          <div
            style={{
              padding: 14,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Tạo Lô Hàng mới
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Tên lô hàng (ví dụ: Lô 6, lô cậu, lô tháng 5...)"
                value={createLotInput}
                onChange={(e) => setCreateLotInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '0.78rem',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text)',
                  outline: 'none',
                }}
              />
              <button
                onClick={async () => {
                  if (!createLotInput.trim()) return;
                  await handleCreateLot(createLotInput);
                  setCreateLotInput('');
                }}
                disabled={createLotLoading || !createLotInput.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  background: createLotInput.trim() ? 'var(--gold)' : 'rgba(212, 175, 55, 0.08)',
                  color: createLotInput.trim() ? '#000' : 'var(--text-dim)',
                  border: 'none',
                  cursor: createLotInput.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                {createLotLoading ? (
                  <RefreshCw size={12} className="spinner" />
                ) : (
                  <FolderPlus size={12} />
                )}
                <span>Tạo Lô</span>
              </button>
            </div>
          </div>

          {/* Active Lots */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FolderOpen size={14} color="var(--gold)" />
              <span>Các lô hàng đang hoạt động</span>
            </div>
            {lots.filter(l => l.status === 'active').length === 0 ? (
              <div style={{ padding: '24px 12px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border)', borderRadius: 8, textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Không có lô hàng nào đang hoạt động. Hãy tạo lô mới ở trên.
              </div>
            ) : (
              lots.filter(l => l.status === 'active').map(lot => (
                <LotSummaryCard
                  key={lot.id}
                  lot={lot}
                  items={lot.items || []}
                  onCloseLot={handleCloseLot}
                  onReopenLot={handleReopenLot}
                  onDeleteLot={handleDeleteLot}
                />
              ))
            )}
          </div>

          {/* Closed Lots Toggle & List */}
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => setShowClosedLots(!showClosedLots)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <span>{showClosedLots ? 'Ẩn các lô đã đóng' : 'Hiện lô đã đóng'}</span>
              <span>({lots.filter(l => l.status === 'closed').length})</span>
            </button>

            {showClosedLots && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeInUp 0.15s ease-out' }}>
                {lots.filter(l => l.status === 'closed').length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                    Chưa có lô hàng nào hoàn thành.
                  </div>
                ) : (
                  lots.filter(l => l.status === 'closed').map(lot => (
                    <LotSummaryCard
                      key={lot.id}
                      lot={lot}
                      items={lot.items || []}
                      onCloseLot={handleCloseLot}
                      onReopenLot={handleReopenLot}
                      onDeleteLot={handleDeleteLot}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(80px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
