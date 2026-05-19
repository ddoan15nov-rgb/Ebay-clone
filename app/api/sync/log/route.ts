import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getEbayUsername } from '@/lib/user-identity';

// GET /api/sync/log — Fetch recent activity log entries
// Optional query params: ?limit=50&action=block
export async function GET(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ entries: [] });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const action = searchParams.get('action');

    let query = supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 500));

    if (action) {
      query = query.eq('action', action);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[sync/log] GET error:', error);
      return NextResponse.json({ entries: [] });
    }

    return NextResponse.json({
      entries: (data || []).map((r) => ({
        id: r.id,
        action: r.action,
        target: r.target,
        targetLabel: r.target_label,
        metadata: r.metadata,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('[sync/log] GET exception:', error);
    return NextResponse.json({ entries: [] });
  }
}

// POST /api/sync/log — Log a new action (for client-side actions like favoriting)
export async function POST(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { action, target, targetLabel, metadata } = await request.json();
    if (!action || !target) {
      return NextResponse.json({ error: 'Missing action or target' }, { status: 400 });
    }

    const { error } = await supabase.from('activity_log').insert({
      user_id: userId,
      action,
      target,
      target_label: targetLabel || target,
      metadata: metadata || {},
    });

    if (error) {
      console.error('[sync/log] POST error:', error);
      return NextResponse.json({ error: 'Failed to log' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[sync/log] POST exception:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
