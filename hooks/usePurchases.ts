'use client';

import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { PurchaseEntry } from '@/lib/types';

export function usePurchases() {
  const [purchases, setPurchases, isLoaded] = useLocalStorage<PurchaseEntry[]>(
    'gold_purchases',
    []
  );

  const addEntry = useCallback(
    (entry: Omit<PurchaseEntry, 'id' | 'tong' | 'createdAt'>) => {
      const newEntry: PurchaseEntry = {
        ...entry,
        id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        tong: Number((entry.gia + entry.ship).toFixed(2)),
        createdAt: new Date().toISOString(),
      };
      setPurchases((prev) => [newEntry, ...prev]);
      return newEntry;
    },
    [setPurchases]
  );

  const updateEntry = useCallback(
    (id: string, updates: Partial<Omit<PurchaseEntry, 'id' | 'tong' | 'createdAt'>>) => {
      setPurchases((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const updated = { ...p, ...updates };
          updated.tong = Number((updated.gia + updated.ship).toFixed(2));
          return updated;
        })
      );
    },
    [setPurchases]
  );

  const deleteEntry = useCallback(
    (id: string) => {
      setPurchases((prev) => prev.filter((p) => p.id !== id));
    },
    [setPurchases]
  );

  const toggleTracked = useCallback(
    (id: string) => {
      setPurchases((prev) =>
        prev.map((p) => (p.id === id ? { ...p, tracked: !p.tracked } : p))
      );
    },
    [setPurchases]
  );

  // Group by Lô
  const purchasesByBatch = purchases.reduce<Record<string, PurchaseEntry[]>>(
    (acc, p) => {
      const key = p.lo || 'Không phân lô';
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    },
    {}
  );

  const totalSpent = purchases.reduce((sum, p) => sum + p.tong, 0);
  const totalItems = purchases.length;

  return {
    purchases,
    purchasesByBatch,
    totalSpent,
    totalItems,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleTracked,
    isLoaded,
  };
}
