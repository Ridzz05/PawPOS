-- +goose Up
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'draft')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'qris', 'debit_card', 'credit_card')),
    subtotal_idr BIGINT NOT NULL CHECK (subtotal_idr >= 0),
    tax_idr BIGINT NOT NULL DEFAULT 0 CHECK (tax_idr >= 0),
    discount_idr BIGINT NOT NULL DEFAULT 0 CHECK (discount_idr >= 0),
    total_idr BIGINT NOT NULL CHECK (total_idr >= 0),
    paid_amount_idr BIGINT NOT NULL CHECK (paid_amount_idr >= 0),
    change_amount_idr BIGINT NOT NULL DEFAULT 0 CHECK (change_amount_idr >= 0),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX orders_location_created_idx ON orders(location_id, created_at DESC);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    unit_price_idr BIGINT NOT NULL CHECK (unit_price_idr >= 0),
    quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
    subtotal_idr BIGINT NOT NULL CHECK (subtotal_idr >= 0)
);

CREATE INDEX order_items_order_idx ON order_items(order_id);
CREATE INDEX order_items_product_idx ON order_items(product_id);
