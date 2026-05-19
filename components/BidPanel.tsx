'use client';

import React, { useState } from 'react';
import { Crosshair, Trash2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface BidPanelProps {
  itemId: string;
  currentPrice: string;
  title?: string;
  endTime?: string;
}

export default function BidPanel({ itemId, currentPrice, title }: BidPanelProps) {
  const [maxBid, setMaxBid] = useState('');
  const [activeSnipePrice, setActiveSnipePrice] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [hasSnipe, setHasSnipe] = useState(false);

  // Load snipe from localStorage immediately, then always reconcile with Supabase
  React.useEffect(() => {
    // Show local state instantly (optimistic)
    const savedSnipe = localStorage.getItem(`gixen_snipe_${itemId}`);
    if (savedSnipe) {
      setHasSnipe(true);
      setActiveSnipePrice(savedSnipe);
    }

    // Always check Supabase to reconcile (handles cross-device deletes/updates)
    fetch(`/api/sync/snipes?itemId=${itemId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.snipes && data.snipes.length > 0) {
          // Remote has a snipe — update local if different
          const remoteSnipe = data.snipes[0];
          const remoteBid = String(remoteSnipe.maxBid);
          if (remoteBid !== savedSnipe) {
            setHasSnipe(true);
            setActiveSnipePrice(remoteBid);
            localStorage.setItem(`gixen_snipe_${itemId}`, remoteBid);
          }
        } else if (savedSnipe) {
          // Remote has NO snipe but local does — it was deleted on another device
          setHasSnipe(false);
          setActiveSnipePrice(null);
          localStorage.removeItem(`gixen_snipe_${itemId}`);
        }
      })
      .catch(() => {}); // silent fail — local state still shown
  }, [itemId]);

  const handleSnipe = () => {
    const bid = parseFloat(maxBid);
    if (!bid || bid <= 0) {
      setStatus('error');
      setMessage('Vui lòng nhập giá hợp lệ');
      return;
    }

    // Optimistically update UI immediately
    setHasSnipe(true);
    setActiveSnipePrice(bid.toString());
    localStorage.setItem(`gixen_snipe_${itemId}`, bid.toString());

    // Background sync to Supabase
    fetch('/api/sync/snipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, maxBid: bid, itemTitle: title }),
    }).catch(() => {});
    
    setStatus('loading');
    setMessage('Đang xử lý ngầm Gixen...');

    // Fire API call in background without blocking
    fetch('/api/gixen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', itemId, maxBid: bid }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus('success');
          setMessage(`✅ Đã đặt snipe $${bid.toFixed(2)}`);
          // Show popup alert later when done
          alert(`✅ Thành công: Snipe $${bid.toFixed(2)} cho sản phẩm #${itemId} đã được đặt trên Gixen!`);
        } else {
          setStatus('error');
          setMessage(data.error || 'Lỗi đặt snipe');
          alert(`❌ Lỗi đặt snipe: ${data.error || 'Vui lòng thử lại'}`);
          // Rollback local storage if it failed
          localStorage.removeItem(`gixen_snipe_${itemId}`);
          setHasSnipe(false);
          setActiveSnipePrice(null);
        }
      })
      .catch((err) => {
        setStatus('error');
        setMessage('Lỗi kết nối server');
        alert('❌ Lỗi kết nối khi đặt snipe trên Gixen.');
      });
  };

  const handleDelete = () => {
    if (!confirm('Xóa snipe cho sản phẩm này?')) return;

    // Optimistically update UI
    setHasSnipe(false);
    setActiveSnipePrice(null);
    setMaxBid('');
    const savedBid = localStorage.getItem(`gixen_snipe_${itemId}`);
    localStorage.removeItem(`gixen_snipe_${itemId}`);

    // Background sync to Supabase
    fetch('/api/sync/snipes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId }),
    }).catch(() => {});
    
    setStatus('loading');
    setMessage('Đang xóa snipe ngầm...');

    // Fire API call in background
    fetch('/api/gixen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', itemId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus('idle');
          setMessage('');
          alert(`✅ Đã xóa snipe thành công cho sản phẩm #${itemId}`);
        } else {
          setStatus('error');
          setMessage(data.error || 'Lỗi xóa snipe');
          alert(`❌ Lỗi xóa snipe: ${data.error || 'Vui lòng thử lại'}`);
          // Rollback if failed
          if (savedBid) {
            setHasSnipe(true);
            setActiveSnipePrice(savedBid);
            localStorage.setItem(`gixen_snipe_${itemId}`, savedBid);
          }
        }
      })
      .catch((err) => {
        setStatus('error');
        setMessage('Lỗi kết nối');
        alert('❌ Lỗi kết nối khi xóa snipe.');
        // Rollback if failed
        if (savedBid) {
          setHasSnipe(true);
          setActiveSnipePrice(savedBid);
          localStorage.setItem(`gixen_snipe_${itemId}`, savedBid);
        }
      });
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        padding: 16,
        marginTop: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Crosshair size={18} color="var(--gold)" />
        <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '0.95rem' }}>
          Gixen Snipe
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          Tự động 🤖
        </span>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
        Giá hiện tại: <strong style={{ color: 'var(--text)' }}>${currentPrice}</strong>
      </p>

      {hasSnipe && activeSnipePrice && (
        <div style={{ 
          marginBottom: 12, 
          padding: '8px 12px', 
          background: 'rgba(46, 204, 113, 0.1)', 
          borderRadius: 6,
          border: '1px solid rgba(46, 204, 113, 0.2)'
        }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--success)', margin: 0, fontWeight: 500 }}>
            ✨ Bạn đã đặt snipe: <strong>${parseFloat(activeSnipePrice).toFixed(2)}</strong>
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            $
          </span>
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder={hasSnipe ? "Đổi giá khác" : "Giá tối đa"}
            value={maxBid}
            onChange={(e) => {
              setMaxBid(e.target.value);
              setStatus('idle');
            }}
            style={{ paddingLeft: 28 }}
          />
        </div>
        <button className="btn btn-gold" onClick={handleSnipe} disabled={status === 'loading'}>
          {status === 'loading' ? <Loader2 size={16} className="spinner" /> : (hasSnipe ? 'Cập nhật' : '🎯 Đặt Snipe')}
        </button>
      </div>

      {hasSnipe && (
        <button
          className="btn btn-danger"
          onClick={handleDelete}
          style={{ width: '100%', marginBottom: 8 }}
          disabled={status === 'loading'}
        >
          <Trash2 size={14} />
          Xóa Snipe
        </button>
      )}

      {status !== 'idle' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            background:
              status === 'loading'
                ? 'rgba(201, 168, 76, 0.1)'
                : status === 'success'
                  ? 'rgba(46, 204, 113, 0.1)'
                  : 'rgba(231, 76, 60, 0.1)',
            color:
              status === 'loading'
                ? 'var(--gold)'
                : status === 'success'
                  ? 'var(--success)'
                  : 'var(--danger)',
            fontSize: '0.8rem',
          }}
        >
          {status === 'loading' ? (
            <Loader2 size={14} className="spinner" />
          ) : status === 'success' ? (
            <CheckCircle size={14} />
          ) : (
            <AlertCircle size={14} />
          )}
          {message}
        </div>
      )}
    </div>
  );
}
