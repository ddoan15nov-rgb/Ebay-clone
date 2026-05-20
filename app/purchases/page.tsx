'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingCart, PackageCheck, Truck, ExternalLink, Package, CreditCard, Clock } from 'lucide-react';
import { PurchaseEntry } from '@/lib/types';
import GiaonhanSyncWidget from '@/components/GiaonhanSyncWidget';

const STATUS_CONFIG = {
  pending: { label: 'Chờ thanh toán', icon: Clock, bg: 'rgba(241,196,15,0.12)', color: '#f1c40f', border: 'rgba(241,196,15,0.25)' },
  paid: { label: 'Đã thanh toán', icon: CreditCard, bg: 'rgba(52,152,219,0.12)', color: '#3498db', border: 'rgba(52,152,219,0.25)' },
  shipped: { label: 'Đã gửi hàng', icon: Truck, bg: 'rgba(46,204,113,0.12)', color: '#2ecc71', border: 'rgba(46,204,113,0.25)' },
  delivered: { label: 'Đã nhận', icon: PackageCheck, bg: 'rgba(46,204,113,0.2)', color: '#27ae60', border: 'rgba(46,204,113,0.35)' },
} as const;

export default function PurchasesPage() {
  const [items, setItems] = useState<PurchaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warehouseSelections, setWarehouseSelections] = useState<Record<string, string>>({});
  const [updatingWh, setUpdatingWh] = useState<Record<string, boolean>>({});

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
      } else {
        alert('Lỗi cập nhật kho lưu trữ đám mây');
      }
    } catch {
      alert('Không thể kết nối đến máy chủ sync');
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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

                    {/* Tracking info if shipped */}
                    {entry.tracked && entry.carrier && (
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Package size={10} /> {entry.carrier}
                      </span>
                    )}
                    {entry.tracked && entry.trackingNumber && (
                      <span style={{
                        fontSize: '0.58rem', fontFamily: 'monospace',
                        color: 'var(--text-muted)', letterSpacing: '0.02em',
                      }}>
                        {entry.trackingNumber}
                      </span>
                    )}
                  </div>

                  {/* Warehouse Selection Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 10,
                      marginBottom: 4,
                      padding: '6px 8px',
                      background: 'rgba(255, 255, 255, 0.01)',
                      border: '1px dashed var(--border)',
                      borderRadius: 6,
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Kho nhận:
                    </span>
                    <select
                      value={warehouseSelections[entry.ebayItemId || ''] || '8'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setWarehouseSelections(prev => ({ ...prev, [entry.ebayItemId || '']: val }));
                      }}
                      style={{
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        color: 'var(--text-muted)',
                      }}
                    >
                      <option value="8">Oregon (Mỹ)</option>
                      <option value="13">Cali (Mỹ)</option>
                      <option value="11">Frankfurt (Đức)</option>
                      <option value="18">Langen (Đức)</option>
                      <option value="7">Hàn Quốc</option>
                      <option value="5">Úc</option>
                      <option value="4">Anh</option>
                      <option value="2">Nhật</option>
                      <option value="17">Trung Quốc</option>
                      <option value="19">Thái Lan</option>
                    </select>

                    <button
                      onClick={() => handleUpdateWarehouse(
                        entry.ebayItemId || '',
                        warehouseSelections[entry.ebayItemId || ''] || '8',
                        entry.title
                      )}
                      disabled={updatingWh[entry.ebayItemId || '']}
                      className="btn"
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.65rem',
                        background: 'rgba(212, 175, 55, 0.15)',
                        color: 'var(--gold)',
                        border: '1px solid rgba(212, 175, 55, 0.3)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        height: 22,
                        minHeight: 22,
                        boxSizing: 'border-box',
                      }}
                    >
                      {updatingWh[entry.ebayItemId || ''] ? (
                        <div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
                      ) : (
                        <span>Cập nhật</span>
                      )}
                    </button>
                  </div>

                  {/* Giaonhan247 Sync Widget */}
                  {entry.trackingNumber && (
                    <GiaonhanSyncWidget 
                      entry={entry} 
                      defaultWarehouse={warehouseSelections[entry.ebayItemId || '']} 
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
    </div>
  );
}
