-- 1. Tạo bảng lots (Lô hàng)
CREATE TABLE IF NOT EXISTS public.lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    revenue NUMERIC(12, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_lot_name UNIQUE (user_id, name)
);

-- Bật Row Level Security (RLS) cho lots
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;

-- Tạo Policy cho lots (cho phép truy cập tự do với service role hoặc chỉnh theo yêu cầu)
CREATE POLICY "Allow all operations for authenticated user lots" 
ON public.lots FOR ALL 
USING (true) 
WITH CHECK (true);


-- 2. Tạo bảng lot_items (Sản phẩm trong lô)
CREATE TABLE IF NOT EXISTS public.lot_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
    tracking_number TEXT NOT NULL,
    ebay_item_id TEXT,
    ebay_url TEXT,
    title TEXT,
    price NUMERIC(12, 2) DEFAULT 0.00,
    shipping NUMERIC(12, 2) DEFAULT 0.00,
    image_url TEXT,
    synced BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_tracking UNIQUE (user_id, tracking_number)
);

-- Bật RLS cho lot_items
ALTER TABLE public.lot_items ENABLE ROW LEVEL SECURITY;

-- Tạo Policy cho lot_items
CREATE POLICY "Allow all operations for authenticated user lot items" 
ON public.lot_items FOR ALL 
USING (true) 
WITH CHECK (true);


-- 3. Tạo index để tối ưu hóa truy vấn
CREATE INDEX IF NOT EXISTS idx_lots_user_status ON public.lots(user_id, status);
CREATE INDEX IF NOT EXISTS idx_lot_items_lot_id ON public.lot_items(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_items_user_tracking ON public.lot_items(user_id, tracking_number);
