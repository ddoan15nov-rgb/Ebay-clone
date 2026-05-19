import { cookies } from 'next/headers';
import { getUserToken } from './ebay-auth';

/**
 * Get the current user's identity for Supabase.
 * 
 * Strategy (in order):
 * 1. Cached ebay_username cookie (fastest)
 * 2. eBay identity API call (if user has an active eBay token)
 * 3. GIXEN_USER env var (fallback for personal tool — always available)
 * 
 * This ensures sync always works, even without eBay OAuth login.
 */
export async function getEbayUsername(): Promise<string | null> {
  const cookieStore = cookies();

  // 1. Check cached username cookie first
  const cached = cookieStore.get('ebay_username')?.value;
  if (cached) return cached;

  // 2. Try eBay identity API if user has a token
  const token = await getUserToken();
  if (token) {
    try {
      const res = await fetch('https://apiz.ebay.com/commerce/identity/v1/user/', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        const username = data.username;

        if (username) {
          // Cache for 24 hours
          cookieStore.set({
            name: 'ebay_username',
            value: username,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24,
            path: '/',
          });
          return username;
        }
      }
    } catch {
      // Fall through to env var fallback
    }
  }

  // 3. Fallback: use GIXEN_USER as the user identity
  // This is a personal tool, so having a single known user ID is fine.
  const gixenUser = process.env.GIXEN_USER;
  if (gixenUser) {
    // Cache it so we don't re-check every time
    try {
      cookieStore.set({
        name: 'ebay_username',
        value: gixenUser,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24,
        path: '/',
      });
    } catch {
      // Cookie setting can fail in certain contexts, that's ok
    }
    return gixenUser;
  }

  return null;
}

/**
 * Require the user identity or throw.
 */
export async function requireUser(): Promise<string> {
  const username = await getEbayUsername();
  if (!username) {
    throw new Error('AUTH_REQUIRED');
  }
  return username;
}
