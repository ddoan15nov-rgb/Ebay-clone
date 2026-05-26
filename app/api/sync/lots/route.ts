import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getEbayUsername } from '@/lib/user-identity';

// GET /api/sync/lots — Fetch all lots for the current user with computed aggregates
export async function GET(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // Optional filter: active | closed

    let query = supabase
      .from('lots')
      .select('*, lot_items(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[sync/lots] GET error:', error);
      return NextResponse.json({ lots: [] });
    }

    const lots = (data || []).map((lot: any) => {
      const items = lot.lot_items || [];
      const itemCount = items.length;
      const totalCost = Number(
        items.reduce((sum: number, item: any) => {
          const itemPrice = Number(item.price || 0);
          const ebayShipping = Number(item.shipping || 0);
          const intlShippingUsd = Number(item.intl_shipping_vnd || 0) / 27;
          return sum + itemPrice + ebayShipping + intlShippingUsd;
        }, 0).toFixed(2)
      );
      const revenue = Number(lot.revenue || 0);
      const profit = lot.status === 'closed' ? Number((revenue - totalCost).toFixed(2)) : 0;
      const factor = (lot.status === 'closed' && totalCost > 0)
        ? Number(((profit / totalCost) * 100).toFixed(1))
        : 0;

      return {
        id: lot.id,
        name: lot.name,
        status: lot.status,
        revenue: lot.revenue,
        notes: lot.notes,
        createdAt: lot.created_at,
        updatedAt: lot.updated_at,
        itemCount,
        totalCost,
        profit,
        factor,
        items: items.map((r: any) => ({
          id: r.id,
          lotId: r.lot_id,
          trackingNumber: r.tracking_number,
          ebayItemId: r.ebay_item_id,
          ebayUrl: r.ebay_url,
          title: r.title,
          price: r.price,
          shipping: r.shipping,
          intlShippingVnd: Number(r.intl_shipping_vnd || 0),
          imageUrl: r.image_url,
          synced: r.synced,
          createdAt: r.created_at,
        })),
      };
    });

    return NextResponse.json({ lots });
  } catch (error) {
    console.error('[sync/lots] GET exception:', error);
    return NextResponse.json({ lots: [] });
  }
}

// POST /api/sync/lots — Create or upsert a lot
export async function POST(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { name, status, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Tên lô không được để trống' }, { status: 400 });
    }

    const trimmedName = name.trim();

    const { data, error } = await supabase
      .from('lots')
      .upsert(
        {
          user_id: userId,
          name: trimmedName,
          status: status || 'active',
          notes: notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,name' }
      )
      .select()
      .single();

    if (error) {
      console.error('[sync/lots] POST error:', error);
      return NextResponse.json({ error: 'Không thể lưu lô hàng' }, { status: 500 });
    }

    // Log action to activity_log
    await supabase.from('activity_log').insert({
      user_id: userId,
      action: 'create_lot',
      target: data.id,
      target_label: trimmedName,
      metadata: { status: data.status },
    });

    return NextResponse.json({ ok: true, lot: data });
  } catch (error) {
    console.error('[sync/lots] POST exception:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/sync/lots — Update lot details (e.g., mark as closed/done with revenue)
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, status, revenue, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID lô hàng' }, { status: 400 });
    }

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name.trim();
    if (status !== undefined) updates.status = status;
    if (revenue !== undefined) updates.revenue = Number(revenue);
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabase
      .from('lots')
      .update(updates)
      .eq('user_id', userId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[sync/lots] PATCH error:', error);
      return NextResponse.json({ error: 'Không thể cập nhật lô hàng' }, { status: 500 });
    }

    // Log action to activity_log
    await supabase.from('activity_log').insert({
      user_id: userId,
      action: status === 'closed' ? 'close_lot' : 'update_lot',
      target: id,
      target_label: data.name,
      metadata: { status: data.status, revenue: data.revenue },
    });

    return NextResponse.json({ ok: true, lot: data });
  } catch (error) {
    console.error('[sync/lots] PATCH exception:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/sync/lots — Remove a lot
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID lô hàng' }, { status: 400 });
    }

    // Get lot info first for logging
    const { data: existing } = await supabase
      .from('lots')
      .select('name')
      .eq('user_id', userId)
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('lots')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) {
      console.error('[sync/lots] DELETE error:', error);
      return NextResponse.json({ error: 'Không thể xóa lô hàng' }, { status: 500 });
    }

    // Log action to activity_log
    await supabase.from('activity_log').insert({
      user_id: userId,
      action: 'delete_lot',
      target: id,
      target_label: existing?.name || `Lot #${id}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[sync/lots] DELETE exception:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
