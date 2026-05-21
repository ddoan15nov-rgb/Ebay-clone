'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Tag, Plus, Folder, Check, X, RefreshCw } from 'lucide-react';
import { PurchaseEntry, Lot } from '@/lib/types';

interface LotSelectorProps {
  entry: PurchaseEntry;
  activeLots: Lot[];
  onAssign: (trackingNumber: string, lotId: string | null, lotName: string | null) => Promise<void>;
  onCreateLot: (name: string) => Promise<Lot | null>;
}

export default function LotSelector({ entry, activeLots, onAssign, onCreateLot }: LotSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLot = async (lotId: string | null, lotName: string | null) => {
    setLoading(true);
    setIsOpen(false);
    try {
      await onAssign(entry.trackingNumber || '', lotId, lotName);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndAssign = async () => {
    if (!inputValue.trim()) return;
    setLoading(true);
    setIsOpen(false);
    const newName = inputValue.trim();
    setInputValue('');
    try {
      // 1. Create the new lot
      const newLot = await onCreateLot(newName);
      if (newLot) {
        // 2. Assign item to this new lot
        await onAssign(entry.trackingNumber || '', newLot.id, newLot.name);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateAndAssign();
    }
  };

  const filteredLots = activeLots.filter(lot =>
    lot.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  const hasAssignment = !!entry.lotId;

  return (
    <div className="lot-selector-container" ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger Button */}
      <button
        onClick={() => !loading && setIsOpen(!isOpen)}
        disabled={loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 8,
          fontSize: '0.7rem',
          fontWeight: 600,
          background: hasAssignment
            ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.12), rgba(212, 175, 55, 0.05))'
            : 'var(--surface)',
          border: hasAssignment
            ? '1px solid rgba(212, 175, 55, 0.35)'
            : '1px solid var(--border)',
          color: hasAssignment ? 'var(--gold)' : 'var(--text-muted)',
          cursor: loading ? 'wait' : 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: hasAssignment ? '0 1px 4px rgba(212,175,55,0.08)' : 'none',
        }}
      >
        {loading ? (
          <RefreshCw size={11} className="spinner" />
        ) : (
          <Tag size={11} style={{ opacity: 0.8 }} />
        )}
        <span>{hasAssignment ? `Lô: ${entry.lotName}` : 'Chưa phân lô'}</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 1000,
            width: 250,
            padding: 8,
            borderRadius: 12,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            animation: 'fadeInUp 0.15s ease-out',
          }}
        >
          {/* Header/Input */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Nhập lô mới hoặc tìm..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
                padding: '5px 8px',
                fontSize: '0.72rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text)',
                outline: 'none',
              }}
              autoFocus
            />
            {inputValue.trim() && (
              <button
                onClick={handleCreateAndAssign}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 8px',
                  borderRadius: 6,
                  background: 'rgba(212, 175, 55, 0.2)',
                  color: 'var(--gold)',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  cursor: 'pointer',
                }}
                title="Tạo lô mới"
              >
                <Plus size={13} />
              </button>
            )}
          </div>

          {/* List Scroll Area */}
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 150 }}>
            {/* Unassign option if assigned */}
            {hasAssignment && (
              <button
                onClick={() => handleSelectLot(null, null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'none',
                  color: 'var(--danger)',
                  fontSize: '0.7rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <X size={12} />
                <span>Không phân lô</span>
              </button>
            )}

            {/* Active Lots */}
            {filteredLots.map((lot) => {
              const isSelected = entry.lotId === lot.id;
              return (
                <button
                  key={lot.id}
                  onClick={() => handleSelectLot(lot.id, lot.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: 'none',
                    background: isSelected ? 'rgba(212, 175, 55, 0.12)' : 'none',
                    color: isSelected ? 'var(--gold)' : 'var(--text-muted)',
                    fontSize: '0.72rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--surface)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'none';
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <Folder size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lot.name}
                    </span>
                  </span>
                  {isSelected && <Check size={12} style={{ flexShrink: 0 }} />}
                </button>
              );
            })}

            {filteredLots.length === 0 && !inputValue.trim() && (
              <div style={{ padding: '12px 8px', fontSize: '0.68rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                Chưa có lô nào hoạt động.
              </div>
            )}
            
            {filteredLots.length === 0 && inputValue.trim() && (
              <div style={{ padding: '8px', fontSize: '0.68rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                Bấm nút + hoặc Enter để tạo lô &quot;{inputValue}&quot;
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fade-in Animation keyframes helper */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
