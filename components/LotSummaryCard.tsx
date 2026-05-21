'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Trash2, Folder, ExternalLink, Lock, CheckCircle2, RefreshCw } from 'lucide-react';
import { Lot, LotItem } from '@/lib/types';

interface LotSummaryCardProps {
  lot: Lot;
  items: LotItem[];
  onCloseLot: (id: string, revenue: number) => Promise<void>;
  onReopenLot: (id: string) => Promise<void>;
  onDeleteLot: (id: string) => Promise<void>;
}

export default function LotSummaryCard({ lot, items, onCloseLot, onReopenLot, onDeleteLot }: LotSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClosingMode, setIsClosingMode] = useState(false);
  const [revenueInput, setRevenueInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const totalCost = lot.totalCost || 0;
  const isClosed = lot.status === 'closed';

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    const rev = parseFloat(revenueInput);
    if (isNaN(rev) || rev < 0) return;

    setActionLoading(true);
    try {
      await onCloseLot(lot.id, rev);
      setIsClosingMode(false);
      setRevenueInput('');
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn mở lại ${lot.name}?`)) return;
    setActionLoading(true);
    try {
      await onReopenLot(lot.id);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${lot.name}? Tất cả liên kết sản phẩm trong lô này sẽ bị gỡ bỏ.`)) return;
    setActionLoading(true);
    try {
      await onDeleteLot(lot.id);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Folder size={16} color="var(--gold)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)' }}>
              {lot.name}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: '0.62rem',
                fontWeight: 600,
                background: isClosed ? 'rgba(231, 76, 60, 0.12)' : 'rgba(46, 204, 113, 0.12)',
                border: isClosed ? '1px solid rgba(231, 76, 60, 0.25)' : '1px solid rgba(46, 204, 113, 0.25)',
                color: isClosed ? '#e74c3c' : '#2ecc71',
              }}
            >
              {isClosed ? <Lock size={10} /> : <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ecc71' }} />}
              {isClosed ? 'Đã xong' : 'Đang mua'}
            </span>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {items.length} sản phẩm • Tổng chi phí: <span style={{ color: 'var(--gold)', fontWeight: 600 }}>${totalCost.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Profit metrics for Closed Lots */}
      {isClosed && (
        <div
          style={{
            padding: '10px 12px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed var(--border)',
            borderRadius: 8,
            fontSize: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)' }}>Doanh thu bán:</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>${(lot.revenue || 0).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-dim)' }}>Lợi nhuận:</span>
            <span
              style={{
                fontWeight: 700,
                color: (lot.profit || 0) >= 0 ? 'var(--success)' : 'var(--danger)',
                fontSize: '0.85rem',
              }}
            >
              {(lot.profit || 0) >= 0 ? `+$${(lot.profit || 0).toFixed(2)}` : `-$${Math.abs(lot.profit || 0).toFixed(2)}`}
              <span style={{ fontSize: '0.7rem', fontWeight: 500, marginLeft: 6 }}>
                ({(lot.factor || 0) >= 0 ? `+${(lot.factor || 0).toFixed(1)}%` : `${(lot.factor || 0).toFixed(1)}%`})
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Expansion area (items listing) */}
      {isExpanded && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {items.length === 0 ? (
            <div style={{ padding: '8px 0', fontSize: '0.7rem', color: 'var(--text-dim)', textAlign: 'center', fontStyle: 'italic' }}>
              Chưa có sản phẩm nào trong lô này.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 8px',
                  background: 'var(--surface)',
                  borderRadius: 6,
                }}
              >
                {item.ebayItemId ? (
                  <Link href={`/item/${item.ebayItemId}`} style={{ display: 'block', flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl || ''}
                      alt=""
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        objectFit: 'cover',
                        background: 'rgba(0,0,0,0.2)',
                      }}
                    />
                  </Link>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.imageUrl || ''}
                    alt=""
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      objectFit: 'cover',
                      background: 'rgba(0,0,0,0.2)',
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {item.ebayItemId ? (
                    <Link href={`/item/${item.ebayItemId}`} style={{ textDecoration: 'none' }}>
                      <p
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--text)',
                        }}
                      >
                        {item.title}
                      </p>
                    </Link>
                  ) : (
                    <p
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'var(--text)',
                      }}
                    >
                      {item.title}
                    </p>
                  )}
                  <p style={{ fontSize: '0.62rem', color: 'var(--text-dim)', margin: '2px 0 0' }}>
                    ${(item.price || 0).toFixed(2)} {item.shipping > 0 ? `+ $${item.shipping.toFixed(2)} ship` : ''}
                  </p>
                </div>
                {item.ebayItemId && (
                  <a
                    href={item.ebayUrl || `https://www.ebay.com/itm/${item.ebayItemId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--text-dim)', flexShrink: 0 }}
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Close Lot Input Drawer */}
      {isClosingMode && (
        <form onSubmit={handleClose} style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Nhập giá bán (USD) để tính lợi nhuận:
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="number"
              step="0.01"
              required
              placeholder="Doanh thu bán lô hàng..."
              value={revenueInput}
              onChange={(e) => setRevenueInput(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: '0.75rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text)',
                outline: 'none',
              }}
              autoFocus
            />
            <button
              type="submit"
              disabled={actionLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '0.7rem',
                fontWeight: 600,
                background: 'var(--gold)',
                color: '#000',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {actionLoading ? <RefreshCw size={12} className="spinner" /> : <CheckCircle2 size={12} />}
              <span>Lưu</span>
            </button>
            <button
              type="button"
              onClick={() => setIsClosingMode(false)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: '0.7rem',
                fontWeight: 500,
                background: 'none',
                color: 'var(--text-dim)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {/* Bottom Footer Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid var(--border)',
          paddingTop: 10,
        }}
      >
        <button
          onClick={handleDelete}
          disabled={actionLoading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            color: 'var(--danger)',
            fontSize: '0.68rem',
            cursor: 'pointer',
            opacity: 0.8,
          }}
        >
          <Trash2 size={12} />
          <span>Xóa lô</span>
        </button>

        {!isClosingMode && (
          <button
            onClick={isClosed ? handleReopen : () => setIsClosingMode(true)}
            disabled={actionLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: '0.68rem',
              fontWeight: 600,
              background: isClosed
                ? 'rgba(52, 152, 219, 0.15)'
                : 'rgba(212, 175, 55, 0.2)',
              color: isClosed ? '#3498db' : 'var(--gold)',
              border: isClosed
                ? '1px solid rgba(52, 152, 219, 0.3)'
                : '1px solid rgba(212, 175, 55, 0.3)',
              cursor: 'pointer',
            }}
          >
            {isClosed ? (
              <>
                <RefreshCw size={11} className={actionLoading ? 'spinner' : ''} />
                <span>Mở lại lô</span>
              </>
            ) : (
              <>
                <Lock size={11} />
                <span>Hoàn thành lô</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
