import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getEbayUsername } from '@/lib/user-identity';

// GET /api/sync/snipes — Fetch all active snipes for the current user
// Optionally filter by itemId: GET /api/sync/snipes?itemId=123
export async function GET(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated', snipes: [] }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');

    let query = supabase
      .from('snipes')
      .select('item_id, max_bid, item_title, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (itemId) {
      query = query.eq('item_id', itemId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[sync/snipes] GET error:', error);
      return NextResponse.json({ snipes: [] });
    }

    return NextResponse.json({
      snipes: (data || []).map((r) => ({
        itemId: r.item_id,
        maxBid: r.max_bid,
        itemTitle: r.item_title,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error) {
    console.error('[sync/snipes] GET exception:', error);
    return NextResponse.json({ snipes: [] });
  }
}

// POST /api/sync/snipes — Upsert a snipe
export async function POST(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { itemId, maxBid, itemTitle } = await request.json();
    if (!itemId || !maxBid) {
      return NextResponse.json({ error: 'Missing itemId or maxBid' }, { status: 400 });
    }

    const { error } = await supabase
      .from('snipes')
      .upsert(
        {
          user_id: userId,
          item_id: itemId,
          max_bid: maxBid,
          item_title: itemTitle || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,item_id' }
      );

    if (error) {
      console.error('[sync/snipes] POST error:', error);
      return NextResponse.json({ error: 'Failed to save snipe' }, { status: 500 });
    }

    // Log the action
    await supabase.from('activity_log').insert({
      user_id: userId,
      action: 'bid',
      target: itemId,
      target_label: itemTitle || `Item #${itemId}`,
      metadata: { maxBid },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[sync/snipes] POST exception:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/sync/snipes — Remove a snipe
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { itemId } = await request.json();
    if (!itemId) {
      return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
    }

    // Get snipe info before deleting for the log
    const { data: existing } = await supabase
      .from('snipes')
      .select('max_bid, item_title')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .single();

    const { error } = await supabase
      .from('snipes')
      .delete()
      .eq('user_id', userId)
      .eq('item_id', itemId);

    if (error) {
      console.error('[sync/snipes] DELETE error:', error);
      return NextResponse.json({ error: 'Failed to delete snipe' }, { status: 500 });
    }

    // Log the action
    await supabase.from('activity_log').insert({
      user_id: userId,
      action: 'unbid',
      target: itemId,
      target_label: existing?.item_title || `Item #${itemId}`,
      metadata: { previousBid: existing?.max_bid },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[sync/snipes] DELETE exception:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
