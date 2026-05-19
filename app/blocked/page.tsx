'use client';

import React from 'react';
import { Ban, UserX, Undo2 } from 'lucide-react';
import { useBlockedSellers } from '@/hooks/useLocalStorage';

export default function BlockedPage() {
  const { blocked, unblockSeller, isLoaded } = useBlockedSellers();

  return (
    <div className="page-container page-transition">
      <h1 className="page-title">
        <Ban
          size={22}
          color="var(--gold)"
          style={{ verticalAlign: -3, marginRight: 8 }}
        />
        Người Bán Bị Chặn
      </h1>
      
      {!isLoaded ? (
        <div className="loading-center" style={{ minHeight: '40vh' }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          <p className="page-subtitle">
            {blocked.length} người bán bị chặn. Sản phẩm của họ sẽ bị ẩn.
          </p>

          {blocked.length === 0 ? (
            <div className="empty-state">
          <UserX size={48} />
          <p>Chưa chặn người bán nào</p>
          <p style={{ fontSize: '0.75rem', marginTop: 4 }}>
            Nhấn 🚫 trên sản phẩm để chặn người bán
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {blocked.map((seller) => (
            <div
              key={seller}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                background: 'var(--card)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Ban size={16} color="var(--danger)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{seller}</span>
              </div>
              <button
                className="btn btn-outline"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                onClick={() => {
                  if (confirm(`Bỏ chặn "${seller}"?`)) {
                    unblockSeller(seller);
                  }
                }}
              >
                <Undo2 size={12} />
                Bỏ chặn
              </button>
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}
