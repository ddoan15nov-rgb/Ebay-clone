-- Migration v2: Thêm cột phí vận chuyển quốc tế (VND) vào lot_items
-- Chạy migration này trong Supabase SQL Editor sau khi đã chạy supabase-migration.sql

ALTER TABLE public.lot_items
ADD COLUMN IF NOT EXISTS intl_shipping_vnd NUMERIC(12, 0) DEFAULT 0;

-- Thêm comment mô tả
COMMENT ON COLUMN public.lot_items.intl_shipping_vnd IS 'Phí vận chuyển quốc tế (VND). Quy đổi sang USD: intl_shipping_vnd / 27';
