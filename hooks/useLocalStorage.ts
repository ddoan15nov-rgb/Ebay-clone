'use client';

import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

// ──── Cross-component sync for localStorage ────
// When one component writes to localStorage, ALL components using the same key
// get notified and re-render with the new value. This fixes the "stale heart" bug
// where favoriting an item in the detail page doesn't update the homepage.

const listeners = new Map<string, Set<() => void>>();

function subscribe(key: string, callback: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(callback);
  return () => { listeners.get(key)?.delete(callback); };
}

function notifyKey(key: string) {
  listeners.get(key)?.forEach((cb) => cb());
}

function getSnapshot(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key) notifyKey(e.key);
  });
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Subscribe to changes from other components
  const raw = useSyncExternalStore(
    (cb) => subscribe(key, cb),
    () => getSnapshot(key),
    () => null // server snapshot
  );

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Ensure referential stability of the parsed object
  const value: T = useMemo(() => {
    if (raw === null) return initialValue;
    try {
      return JSON.parse(raw);
    } catch {
      return initialValue;
    }
  }, [raw, initialValue]);

  const set = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const current = (() => {
        try {
          const stored = localStorage.getItem(key);
          return stored !== null ? JSON.parse(stored) : initialValue;
        } catch { return initialValue; }
      })();
      const resolved = typeof newValue === 'function'
        ? (newValue as (prev: T) => T)(current)
        : newValue;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // storage full
      }
      // Notify all components using this key
      notifyKey(key);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  return [value, set, isLoaded] as const;
}

// Favorites helper (Syncs with eBay Watchlist)
export function useFavorites() {
  const [favorites, setFavorites, isLoaded] = useLocalStorage<string[]>('gold_favorites', []);

  // Normalize ID (remove 'v1|' prefix and '|0' suffix) to match correctly
  const normalizeId = (id: any) => String(id || '').replace('v1|', '').replace('|0', '');

  const toggleFavorite = useCallback(
    async (itemId: string) => {
      const normalizedId = normalizeId(itemId);
      const isCurrentlyFavorite = favorites.some(id => normalizeId(id) === normalizedId);
      
      // Optimistic UI update
      setFavorites((prev) =>
        isCurrentlyFavorite ? prev.filter((id) => normalizeId(id) !== normalizedId) : [...prev, normalizedId]
      );

      // Background sync with eBay
      try {
        const endpoint = isCurrentlyFavorite ? '/api/ebay/watchlist/remove' : '/api/ebay/watchlist/add';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: normalizedId }),
        });

        const data = await res.json();
        
        if (res.status === 401 && data.code === 'AUTH_REQUIRED') {
          // Revert optimistic update and redirect to login
          setFavorites((prev) =>
            isCurrentlyFavorite ? [...prev, normalizedId] : prev.filter((id) => normalizeId(id) !== normalizedId)
          );
          window.location.href = '/api/auth/login';
        } else if (!res.ok) {
          console.error('Failed to sync favorite to eBay', data);
          // Revert optimistic update
          setFavorites((prev) =>
            isCurrentlyFavorite ? [...prev, normalizedId] : prev.filter((id) => normalizeId(id) !== normalizedId)
          );
        }
      } catch (error) {
        console.error('Network error syncing favorite', error);
      }
    },
    [favorites, setFavorites]
  );

  const isFavorite = useCallback(
    (itemId: string) => {
      const normalizedId = normalizeId(itemId);
      return favorites.some(id => normalizeId(id) === normalizedId);
    },
    [favorites]
  );

  // Helper to merge remote eBay watchlist IDs with local ones (union, not replace)
  const syncFavorites = useCallback(
    (remoteItemIds: string[]) => {
      setFavorites((prev) => {
        const merged = new Set([...prev, ...remoteItemIds]);
        return Array.from(merged);
      });
    },
    [setFavorites]
  );

  return { favorites, toggleFavorite, isFavorite, syncFavorites, isLoaded };
}

// Blocked sellers helper — syncs with Supabase
export function useBlockedSellers() {
  const [blocked, setBlocked, isLoaded] = useLocalStorage<string[]>('gold_blocked_sellers', []);
  const hasSynced = useRef(false);

  // On mount: fetch remote blocked list and merge with local
  useEffect(() => {
    if (!isLoaded || hasSynced.current) return;
    hasSynced.current = true;

    fetch('/api/sync/blocked')
      .then((r) => r.json())
      .then((data) => {
        if (data.sellers && data.sellers.length > 0) {
          setBlocked((prev) => {
            const merged = new Set([...prev, ...data.sellers]);
            return Array.from(merged);
          });
        }
      })
      .catch(() => {}); // silent fail — local data still works
  }, [isLoaded, setBlocked]);

  const blockSeller = useCallback(
    (seller: string) => {
      setBlocked((prev) => (prev.includes(seller) ? prev : [...prev, seller]));
      // Background sync to Supabase
      fetch('/api/sync/blocked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller }),
      }).catch(() => {});
    },
    [setBlocked]
  );

  const unblockSeller = useCallback(
    (seller: string) => {
      setBlocked((prev) => prev.filter((s) => s !== seller));
      // Background sync to Supabase
      fetch('/api/sync/blocked', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller }),
      }).catch(() => {});
    },
    [setBlocked]
  );

  const isBlocked = useCallback(
    (seller: string) => blocked.includes(seller),
    [blocked]
  );

  return { blocked, blockSeller, unblockSeller, isBlocked, isLoaded };
}

