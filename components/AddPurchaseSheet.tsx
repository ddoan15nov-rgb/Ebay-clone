'use client';

import React, { useState } from 'react';
import { Plus, Camera, X, Loader2 } from 'lucide-react';

interface AddPurchaseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (entry: {
    imageUrl: string;
    title: string;
    gia: number;
    ship: number;
    tracked: boolean;
    lo: string;
    ebayItemId?: string;
  }) => void;
  prefill?: {
    imageUrl?: string;
    title?: string;
    gia?: number;
    ship?: number;
    ebayItemId?: string;
  };
}

export default function AddPurchaseSheet({
  isOpen,
  onClose,
  onAdd,
  prefill,
}: AddPurchaseSheetProps) {
  const [imageUrl, setImageUrl] = useState(prefill?.imageUrl || '');
  const [title, setTitle] = useState(prefill?.title || '');
  const [gia, setGia] = useState(prefill?.gia?.toString() || '');
  const [ship, setShip] = useState(prefill?.ship?.toString() || '');
  const [lo, setLo] = useState('');
  const [tracked, setTracked] = useState(false);

  if (!isOpen) return null;

  const giaNum = parseFloat(gia) || 0;
  const shipNum = parseFloat(ship) || 0;
  const tong = (giaNum + shipNum).toFixed(2);

  const handleSubmit = () => {
    if (!giaNum) {
      alert('Vui lòng nhập giá');
      return;
    }

    onAdd({
      imageUrl: imageUrl || 'https://placehold.co/100x100/1e1e1e/c9a84c?text=No+Image',
      title: title || 'Sản phẩm không tên',
      gia: giaNum,
      ship: shipNum,
      tracked,
      lo: lo || '1',
      ebayItemId: prefill?.ebayItemId,
    });

    // Reset
    setImageUrl('');
    setTitle('');
    setGia('');
    setShip('');
    setLo('');
    setTracked(false);
    onClose();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImageUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span className="sheet-title" style={{ margin: 0 }}>
            <Plus size={18} style={{ marginRight: 6, verticalAlign: -3 }} />
            Thêm Mua Hàng
          </span>
          <button className="btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Photo */}
        <div className="form-group">
          <label className="form-label">Ảnh</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {imageUrl ? (
              <div style={{ position: 'relative' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Preview"
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 8,
                    objectFit: 'cover',
                  }}
                />
                <button
                  onClick={() => setImageUrl('')}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'var(--danger)',
                    border: 'none',
                    color: 'white',
                    fontSize: '0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>
            ) : null}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <Camera size={16} />
              Chọn ảnh
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        {/* Title */}
        <div className="form-group">
          <label className="form-label">Tên sản phẩm</label>
          <input
            className="input"
            placeholder="VD: Gold chain lot 14K"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Giá + Ship */}
        <div className="form-row" style={{ marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Giá ($)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={gia}
              onChange={(e) => setGia(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Ship ($)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={ship}
              onChange={(e) => setShip(e.target.value)}
            />
          </div>
        </div>

        {/* Tổng */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '12px 14px',
            background: 'var(--gold-glow)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold)' }}>Tổng</span>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gold)' }}>${tong}</span>
        </div>

        {/* Lô + Track */}
        <div className="form-row" style={{ marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Lô</label>
            <input
              className="input"
              placeholder="VD: 2, Cap, A"
              value={lo}
              onChange={(e) => setLo(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Đã có tracking?</label>
            <button
              className={`toggle ${tracked ? 'on' : ''}`}
              onClick={() => setTracked(!tracked)}
              style={{ marginTop: 6 }}
            />
          </div>
        </div>

        <button className="btn btn-gold" onClick={handleSubmit} style={{ width: '100%', padding: '14px' }}>
          Thêm vào Mua Hàng
        </button>
      </div>
    </>
  );
}
