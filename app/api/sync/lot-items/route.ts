import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getEbayUsername } from '@/lib/user-identity';

// GET /api/sync/lot-items — Fetch all items assigned to a specific lot
export async function GET(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');

    if (!lotId) {
      return NextResponse.json({ error: 'Thiếu lotId' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lot_items')
      .select('*')
      .eq('user_id', userId)
      .eq('lot_id', lotId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[sync/lot-items] GET error:', error);
      return NextResponse.json({ items: [] });
    }

    return NextResponse.json({
      items: (data || []).map((r) => ({
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
    });
  } catch (error) {
    console.error('[sync/lot-items] GET exception:', error);
    return NextResponse.json({ items: [] });
  }
}

// POST /api/sync/lot-items — Assign (or reassign) a tracking number to a lot
export async function POST(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const {
      lotId,
      trackingNumber,
      ebayItemId,
      ebayUrl,
      title,
      price,
      shipping,
      imageUrl,
      synced,
      intlShippingVnd,
    } = body;

    if (!trackingNumber) {
      return NextResponse.json({ error: 'Thiếu số tracking' }, { status: 400 });
    }

    // If lotId is 'none', undefined or null, we remove any lot assignment for this tracking number
    if (!lotId || lotId === 'none') {
      const { error } = await supabase
        .from('lot_items')
        .delete()
        .eq('user_id', userId)
        .eq('tracking_number', trackingNumber);

      if (error) {
        console.error('[sync/lot-items] Unassign error:', error);
        return NextResponse.json({ error: 'Không thể gỡ sản phẩm khỏi lô' }, { status: 500 });
      }

      return NextResponse.json({ ok: true, message: 'Đã gỡ sản phẩm khỏi lô' });
    }

    // Validate that the lot exists and belongs to the user
    const { data: lotExists, error: lotCheckError } = await supabase
      .from('lots')
      .select('id, name')
      .eq('user_id', userId)
      .eq('id', lotId)
      .single();

    if (lotCheckError || !lotExists) {
      return NextResponse.json({ error: 'Lô hàng không tồn tại hoặc không hợp lệ' }, { status: 400 });
    }

    // Upsert the lot assignment. Conflict on user_id + tracking_number changes the lot ID.
    const { error } = await supabase
      .from('lot_items')
      .upsert(
        {
          user_id: userId,
          lot_id: lotId,
          tracking_number: trackingNumber.trim(),
          ebay_item_id: ebayItemId || null,
          ebay_url: ebayUrl || null,
          title: title || null,
          price: price !== undefined ? Number(price) : 0,
          shipping: shipping !== undefined ? Number(shipping) : 0,
          intl_shipping_vnd: intlShippingVnd !== undefined ? Number(intlShippingVnd) : 0,
          image_url: imageUrl || null,
          synced: !!synced,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,tracking_number' }
      );

    if (error) {
      console.error('[sync/lot-items] POST error:', error);
      return NextResponse.json({ error: 'Không thể phân lô sản phẩm' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, lotName: lotExists.name });
  } catch (error) {
    console.error('[sync/lot-items] POST exception:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/sync/lot-items — Remove an item from a lot
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { trackingNumber } = body;

    if (!trackingNumber) {
      return NextResponse.json({ error: 'Thiếu số tracking' }, { status: 400 });
    }

    const { error } = await supabase
      .from('lot_items')
      .delete()
      .eq('user_id', userId)
      .eq('tracking_number', trackingNumber);

    if (error) {
      console.error('[sync/lot-items] DELETE error:', error);
      return NextResponse.json({ error: 'Không thể gỡ sản phẩm khỏi lô' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[sync/lot-items] DELETE exception:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/sync/lot-items — Update international shipping cost (VND) for a lot item
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getEbayUsername();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { trackingNumber, intlShippingVnd } = body;

    if (!trackingNumber) {
      return NextResponse.json({ error: 'Thiếu số tracking' }, { status: 400 });
    }

    const { error } = await supabase
      .from('lot_items')
      .update({ intl_shipping_vnd: Number(intlShippingVnd || 0) })
      .eq('user_id', userId)
      .eq('tracking_number', trackingNumber.trim());

    if (error) {
      console.error('[sync/lot-items] PATCH error:', error);
      return NextResponse.json({ error: 'Không thể cập nhật phí vận chuyển' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[sync/lot-items] PATCH exception:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

