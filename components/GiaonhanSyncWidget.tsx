'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, ShieldAlert, CheckCircle, AlertTriangle, Send } from 'lucide-react';
import { PurchaseEntry } from '@/lib/types';

interface GiaonhanSyncWidgetProps {
  entry: PurchaseEntry;
  defaultWarehouse?: string;
}

const ROUTE_OPTIONS = [
  { value: '8', label: 'Oregon (Mỹ)' },
  { value: '13', label: 'Cali (Mỹ)' },
  { value: '11', label: 'Frankfurt (Đức)' },
  { value: '18', label: 'Langen (Đức)' },
  { value: '7', label: 'Hàn Quốc' },
  { value: '5', label: 'Úc' },
  { value: '4', label: 'Anh' },
  { value: '2', label: 'Nhật' },
  { value: '17', label: 'Trung Quốc' },
  { value: '19', label: 'Thái Lan' },
];

function getDefaultDeclarationPrice(entry: PurchaseEntry, route: string): number {
  const usdPrice = entry.tong || entry.gia || 0;
  
  if (entry.originalCurrency && entry.originalGia) {
    const origGia = entry.originalGia;
    const origShip = entry.originalShip || 0;
    const origTotal = origGia + origShip;
    
    // Check if original currency matches the route's native currency
    if (entry.originalCurrency === 'JPY' && route === '2') return origTotal;
    if (entry.originalCurrency === 'GBP' && route === '4') return origTotal;
    if (entry.originalCurrency === 'AUD' && route === '5') return origTotal;
    if (entry.originalCurrency === 'EUR' && (route === '11' || route === '18')) return origTotal;
  }
  
  return usdPrice;
}

export default function GiaonhanSyncWidget({ entry, defaultWarehouse }: GiaonhanSyncWidgetProps) {
  const [tuyen, setTuyen] = useState(defaultWarehouse || '8');
  const [gia, setGia] = useState(getDefaultDeclarationPrice(entry, defaultWarehouse || '8').toFixed(2));
  const [isBlock, setIsBlock] = useState((entry.tong || entry.gia || 0) >= 1500);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [isSynced, setIsSynced] = useState(entry.isSynced || false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (defaultWarehouse) {
      setTuyen(defaultWarehouse);
      setGia(getDefaultDeclarationPrice(entry, defaultWarehouse).toFixed(2));
    }
  }, [defaultWarehouse, entry]);

  useEffect(() => {
    if (entry.isSynced) {
      setIsSynced(true);
      return;
    }
    if (typeof window !== 'undefined' && entry.trackingNumber) {
      const synced = localStorage.getItem(`gn247_synced_${entry.trackingNumber}`);
      if (synced) {
        setIsSynced(true);
      }
    }
  }, [entry.trackingNumber, entry.isSynced]);

  // Update block status if user changes price manually
  const handlePriceChange = (val: string) => {
    setGia(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      setIsBlock(parsed >= 1500);
    }
  };

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!entry.trackingNumber) {
      alert('Sản phẩm chưa có Tracking Number');
      return;
    }

    setStatus('syncing');
    setMessage('Đang kết nối & cập nhật Giaonhan247...');

    try {
      const res = await fetch('/api/giaonhan247', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber: entry.trackingNumber,
          tuyen,
          gia: parseFloat(gia) || 0,
          isBlock,
          reason: isBlock ? 'take a photo' : undefined,
          itemUrl: `https://www.ebay.com/itm/${entry.ebayItemId}`,
          imageUrl: entry.imageUrl,
          note: `eBay Item #${entry.ebayItemId}`,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus('success');
        setMessage(data.message);
        setIsSynced(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`gn247_synced_${entry.trackingNumber}`, 'true');
        }
      } else {
        setStatus('error');
        setMessage(data.error || data.message || 'Lỗi cập nhật tracking');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Không thể kết nối đến máy chủ');
    }
  };

  if (!entry.trackingNumber) return null;

  return (
    <div
      style={{
        marginTop: 12,
        padding: 10,
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        width: '100%',
        maxWidth: 420,
      }}
    >
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {isSynced ? (
            <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={12} /> Đã đồng bộ GN247
            </span>
          ) : (
            <span style={{ color: 'var(--gold)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <RefreshCw size={12} className={status === 'syncing' ? 'spinner' : ''} /> Đồng bộ Giaonhan247
            </span>
          )}
        </span>
        <button 
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.65rem',
            cursor: 'pointer',
            padding: '2px 6px',
          }}
        >
          {expanded ? 'Thu gọn ▲' : 'Cài đặt ▼'}
        </button>
      </div>

      {(expanded || status !== 'idle' || isSynced) && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Form fields */}
          {!isSynced && status !== 'syncing' && (
            <>
              {/* Shipping route select */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Tuyến vận chuyển:</label>
                <select
                  value={tuyen}
                  onChange={(e) => {
                    const newRoute = e.target.value;
                    setTuyen(newRoute);
                    setGia(getDefaultDeclarationPrice(entry, newRoute).toFixed(2));
                  }}
                  className="input"
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                  }}
                >
                  {ROUTE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Giá trị USD (Price + Ship):</label>
                <input
                  type="number"
                  value={gia}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  className="input"
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                  }}
                />
              </div>

              {/* Block option */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <input
                  type="checkbox"
                  id={`block-${entry.id}`}
                  checked={isBlock}
                  onChange={(e) => setIsBlock(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label 
                  htmlFor={`block-${entry.id}`} 
                  style={{ fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {isBlock && <ShieldAlert size={12} color="var(--danger)" />}
                  Chặn kiểm tra hàng (giá trị {'>'}= $1500)
                </label>
              </div>
            </>
          )}

          {/* Sync Button */}
          {status !== 'syncing' && (
            <button
              onClick={handleSync}
              className="btn btn-gold"
              style={{
                width: '100%',
                padding: '6px 12px',
                fontSize: '0.75rem',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Send size={12} />
              {isSynced ? 'Đồng bộ lại' : 'Bắt đầu đồng bộ'}
            </button>
          )}

          {/* Status Display */}
          {status !== 'idle' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 6,
                fontSize: '0.7rem',
                background:
                  status === 'syncing' ? 'rgba(212, 175, 55, 0.1)' :
                  status === 'success' ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                border:
                  status === 'syncing' ? '1px solid rgba(212, 175, 55, 0.2)' :
                  status === 'success' ? '1px solid rgba(46, 204, 113, 0.2)' : '1px solid rgba(231, 76, 60, 0.2)',
                color:
                  status === 'syncing' ? 'var(--gold)' :
                  status === 'success' ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {status === 'syncing' && <RefreshCw size={12} className="spinner" style={{ flexShrink: 0, marginTop: 2 }} />}
              {status === 'success' && <CheckCircle size={12} style={{ flexShrink: 0, marginTop: 2 }} />}
              {status === 'error' && <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />}
              <span style={{ lineHeight: 1.3 }}>{message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
