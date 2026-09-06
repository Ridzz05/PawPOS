-- +goose Up
-- Allow service (non-stock) lines on orders so jasa bookings settle as real struk.

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_kind TEXT NOT NULL DEFAULT 'barang'
    CHECK (item_kind IN ('barang', 'jasa'));
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
