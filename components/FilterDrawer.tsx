'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SlidersHorizontal, X, Plus, Ban, Loader2 } from 'lucide-react';
import { FilterState } from '@/lib/types';

interface FilterDrawerProps {
  isOpen: boolean;
  filters: FilterState;
  onClose: () => void;
  onChange: (filters: FilterState) => void;
}

export default function FilterDrawer({ isOpen, filters, onClose, onChange }: FilterDrawerProps) {
  const [newWord, setNewWord] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasLoadedServer = useRef(false);

  // Load negative keywords from server on first open
  useEffect(() => {
    if (isOpen && !hasLoadedServer.current) {
      hasLoadedServer.current = true;
      fetch('/api/sync/keywords')
        .then(r => r.json())
        .then(data => {
          if (data.keywords && data.keywords !== filters.negativeWords) {
            onChange({ ...filters, negativeWords: data.keywords });
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const update = (partial: Partial<FilterState>) => {
    onChange({ ...filters, ...partial });
  };

  // Parse keywords into tags
  const tags = (filters.negativeWords || '')
    .split(',')
    .map(w => w.trim())
    .filter(Boolean);

  const addWord = () => {
    const word = newWord.trim();
    if (!word || tags.includes(word)) {
      setNewWord('');
      return;
    }
    const updated = [...tags, word].join(', ');
    update({ negativeWords: updated });
    setNewWord('');
    saveToServer(updated);
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    const updated = tags.filter(t => t !== tag).join(', ');
    update({ negativeWords: updated });
    saveToServer(updated);
  };

  const saveToServer = async (keywords: string) => {
    setSaving(true);
    try {
      await fetch('/api/sync/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });
    } catch {}
    setTimeout(() => setSaving(false), 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addWord();
    }
  };

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 24, paddingBottom: 16,
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--gold-glow)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <SlidersHorizontal size={16} color="var(--gold)" />
            </div>
            <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>Bộ Lọc</span>
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* === FILTER SECTIONS === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Loại đấu giá */}
          <Section label="Loại đấu giá">
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                ['ALL', 'Tất cả'],
                ['AUCTION', 'Đấu giá'],
                ['FIXED_PRICE', 'Mua ngay'],
              ] as const).map(([value, label]) => (
                <FilterChip
                  key={value}
                  active={filters.listingType === value}
                  onClick={() => update({ listingType: value })}
                >
                  {label}
                </FilterChip>
              ))}
            </div>
          </Section>

          {/* Sắp xếp */}
          <Section label="Sắp xếp">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([
                ['endingSoonest', 'Sắp kết thúc'],
                ['price', 'Giá thấp nhất'],
                ['newlyListed', 'Mới đăng'],
              ] as const).map(([value, label]) => (
                <FilterChip
                  key={value}
                  active={filters.sort === value}
                  onClick={() => update({ sort: value, listingType: 'ALL' })}
                >
                  {label}
                </FilterChip>
              ))}
            </div>
          </Section>

          {/* Khoảng giá */}
          <Section label="Khoảng giá (USD)">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                className="input"
                type="number"
                placeholder="Min"
                value={filters.minPrice || ''}
                onChange={(e) => update({ minPrice: Number(e.target.value) || 0 })}
                style={{ flex: 1, textAlign: 'center' }}
              />
              <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>—</span>
              <input
                className="input"
                type="number"
                placeholder="Max"
                value={filters.maxPrice || ''}
                onChange={(e) => update({ maxPrice: Number(e.target.value) || 5000 })}
                style={{ flex: 1, textAlign: 'center' }}
              />
            </div>
          </Section>

          {/* Tình trạng */}
          <Section label="Tình trạng">
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                ['ALL', 'Tất cả'],
                ['USED', 'Đã dùng'],
                ['NOT_SPECIFIED', 'Không rõ'],
              ] as const).map(([value, label]) => (
                <FilterChip
                  key={value}
                  active={filters.condition === value}
                  onClick={() => update({ condition: value })}
                >
                  {label}
                </FilterChip>
              ))}
            </div>
          </Section>

          {/* Negative Keywords — TAG-BASED UI */}
          <Section label={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ban size={13} color="var(--danger)" />
              <span>Từ khóa loại trừ</span>
              {saving && <Loader2 size={12} color="var(--gold)" style={{ animation: 'spin 0.6s linear infinite' }} />}
            </div>
          }>
            {/* Tag cloud */}
            {tags.length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10,
              }}>
                {tags.map(tag => (
                  <span
                    key={tag}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 20,
                      background: 'rgba(231, 76, 60, 0.12)',
                      border: '1px solid rgba(231, 76, 60, 0.25)',
                      color: '#e67e73',
                      fontSize: '0.7rem', fontWeight: 600,
                    }}
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      style={{
                        background: 'none', border: 'none', color: 'inherit',
                        cursor: 'pointer', padding: 0, display: 'flex',
                        marginLeft: 2,
                      }}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add new word input */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                className="input"
                type="text"
                placeholder="Thêm từ khóa..."
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ flex: 1 }}
              />
              <button
                onClick={addWord}
                disabled={!newWord.trim()}
                style={{
                  flexShrink: 0, width: 40, height: 40, borderRadius: 10,
                  background: newWord.trim() ? 'var(--gold)' : 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: newWord.trim() ? '#000' : 'var(--text-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: newWord.trim() ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
              >
                <Plus size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: 6 }}>
              Ẩn sản phẩm có chứa từ này • Đồng bộ mọi thiết bị
            </p>
          </Section>

          {/* US only toggle */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 14px', borderRadius: 10,
            background: 'var(--surface)',
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>🇺🇸 Chỉ người bán Mỹ</span>
            <button
              onClick={() => update({ usOnly: !filters.usOnly })}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none',
                background: filters.usOnly
                  ? 'var(--gold)'
                  : 'var(--border)',
                position: 'relative', cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff', position: 'absolute',
                top: 3,
                left: filters.usOnly ? 23 : 3,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// === Sub-Components ===

function Section({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: '0.72rem', fontWeight: 600,
        color: 'var(--text-muted)', marginBottom: 8,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function FilterChip({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: 20,
        border: active ? '1.5px solid var(--gold)' : '1px solid var(--border)',
        background: active ? 'var(--gold-glow)' : 'transparent',
        color: active ? 'var(--gold)' : 'var(--text-muted)',
        fontSize: '0.75rem',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
