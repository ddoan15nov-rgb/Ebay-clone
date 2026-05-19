import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getEbayUsername } from '@/lib/user-identity';

// GET /api/sync/keywords — Fetch negative keywords for the current user
export async function GET() {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      // Fall back to empty keywords for unauthenticated users
      return NextResponse.json({ keywords: '' });
    }

    const { data, error } = await supabase
      .from('negative_keywords')
      .select('keywords')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = "no rows returned" — that's fine, just means no keywords set yet
      console.error('[sync/keywords] GET error:', error);
    }

    return NextResponse.json({ keywords: data?.keywords || '' });
  } catch (error) {
    console.error('[sync/keywords] GET exception:', error);
    return NextResponse.json({ keywords: '' });
  }
}

// POST /api/sync/keywords — Save negative keywords
export async function POST(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { keywords } = await request.json();
    const keywordsStr = keywords || '';

    // Upsert keywords (one row per user)
    const { error } = await supabase
      .from('negative_keywords')
      .upsert(
        {
          user_id: userId,
          keywords: keywordsStr,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('[sync/keywords] POST error:', error);
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }

    // Log the action
    await supabase.from('activity_log').insert({
      user_id: userId,
      action: 'update_keywords',
      target: 'negative_keywords',
      target_label: keywordsStr,
    });

    return NextResponse.json({ ok: true, keywords: keywordsStr });
  } catch (error) {
    console.error('[sync/keywords] POST exception:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
