'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, PackageCheck, Truck, ExternalLink, Package, CreditCard, Clock, Warehouse, CheckCircle, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { PurchaseEntry } from '@/lib/types';
import GiaonhanSyncWidget from '@/components/GiaonhanSyncWidget';

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

  useEffect(() => {
    const fetchPurchasesAndWarehouse = async () => {
      try {
        const res = await fetch('/api/ebay/purchases');
        const data = await res.json();

        if (res.status === 401 && data.code === 'AUTH_REQUIRED') {
          window.location.href = '/api/auth/login';
          return;
        }

        if (res.ok && data.items) {
          setItems(data.items);
        } else {
          setError(data.error || 'Failed to load');
        }

        // Fetch warehouse configurations from snipes sync API
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
      } catch (err) {
        console.error('Failed to fetch purchases', err);
        setError('Không thể kết nối');
      } finally {
        setLoading(false);
      }
    };

    fetchPurchasesAndWarehouse();
  }, []);

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
        {items.length > 0 ? `${items.length} sản phẩm đã mua` : 'Đồng bộ từ eBay'}
      </p>

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

      {items.length === 0 && !error ? (
        <div className="empty-state">
          <ShoppingCart size={48} />
          <p>Chưa có sản phẩm nào</p>
          <p style={{ fontSize: '0.75rem', marginTop: 4, color: 'var(--text-dim)' }}>
            Các sản phẩm bạn mua thành công sẽ tự động hiển thị ở đây.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((entry) => {
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

                  {/* Giaonhan247 Sync Widget */}
                  {entry.trackingNumber && (
                    <GiaonhanSyncWidget
                      entry={entry}
                      defaultWarehouse={warehouseSelections[itemId]}
                    />
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
