import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getEbayUsername } from '@/lib/user-identity';

// GET /api/sync/blocked — Fetch all blocked sellers for the current user
export async function GET() {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ sellers: [], anonymous: true });
    }

    const { data, error } = await supabase
      .from('blocked_sellers')
      .select('seller_username, blocked_at')
      .eq('user_id', userId)
      .order('blocked_at', { ascending: false });

    if (error) {
      console.error('[sync/blocked] GET error:', error);
      return NextResponse.json({ sellers: [] });
    }

    return NextResponse.json({
      sellers: (data || []).map((r) => r.seller_username),
    });
  } catch (error) {
    console.error('[sync/blocked] GET exception:', error);
    return NextResponse.json({ sellers: [] });
  }
}

// POST /api/sync/blocked — Block a seller
export async function POST(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { seller } = await request.json();
    if (!seller) {
      return NextResponse.json({ error: 'Missing seller' }, { status: 400 });
    }

    // Upsert blocked seller (ignore conflicts)
    const { error } = await supabase
      .from('blocked_sellers')
      .upsert(
        { user_id: userId, seller_username: seller, blocked_at: new Date().toISOString() },
        { onConflict: 'user_id,seller_username' }
      );

    if (error) {
      console.error('[sync/blocked] POST error:', error);
      return NextResponse.json({ error: 'Failed to block' }, { status: 500 });
    }

    // Log the action
    await supabase.from('activity_log').insert({
      user_id: userId,
      action: 'block',
      target: seller,
      target_label: seller,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[sync/blocked] POST exception:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/sync/blocked — Unblock a seller
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { seller } = await request.json();
    if (!seller) {
      return NextResponse.json({ error: 'Missing seller' }, { status: 400 });
    }

    const { error } = await supabase
      .from('blocked_sellers')
      .delete()
      .eq('user_id', userId)
      .eq('seller_username', seller);

    if (error) {
      console.error('[sync/blocked] DELETE error:', error);
      return NextResponse.json({ error: 'Failed to unblock' }, { status: 500 });
    }

    // Log the action
    await supabase.from('activity_log').insert({
      user_id: userId,
      action: 'unblock',
      target: seller,
      target_label: seller,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[sync/blocked] DELETE exception:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
