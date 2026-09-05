-- +goose Up
-- 1. Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    plan_type TEXT NOT NULL DEFAULT 'starter',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Insert Default Tenant for backward compatibility
INSERT INTO tenants (id, name, slug, plan_type, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Store', 'default-store', 'starter', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. Add tenant_id to tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE categories ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE;

-- Drop global unique constraint on products(sku) and add composite unique (tenant_id, sku)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE products ADD CONSTRAINT products_tenant_sku_key UNIQUE (tenant_id, sku);

ALTER TABLE inventory_locations ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE inventory_locations DROP CONSTRAINT IF EXISTS inventory_locations_code_key;
ALTER TABLE inventory_locations ADD CONSTRAINT inventory_locations_tenant_code_key UNIQUE (tenant_id, code);

ALTER TABLE product_stocks ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_number_key;
ALTER TABLE orders ADD CONSTRAINT orders_tenant_order_number_key UNIQUE (tenant_id, order_number);

-- 4. Create composite performance indexes
CREATE INDEX IF NOT EXISTS products_tenant_active_idx ON products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS inventory_locations_tenant_idx ON inventory_locations(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS product_stocks_tenant_idx ON product_stocks(tenant_id, location_id);
CREATE INDEX IF NOT EXISTS orders_tenant_created_idx ON orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_tenant_idx ON stock_movements(tenant_id, created_at DESC);

-- +goose Down
DROP INDEX IF EXISTS stock_movements_tenant_idx;
DROP INDEX IF EXISTS orders_tenant_created_idx;
DROP INDEX IF EXISTS product_stocks_tenant_idx;
DROP INDEX IF EXISTS inventory_locations_tenant_idx;
DROP INDEX IF EXISTS products_tenant_active_idx;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_tenant_order_number_key;
ALTER TABLE orders DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE stock_movements DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE product_stocks DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE inventory_locations DROP CONSTRAINT IF EXISTS inventory_locations_tenant_code_key;
ALTER TABLE inventory_locations DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_tenant_sku_key;
ALTER TABLE products DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE categories DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE users DROP COLUMN IF EXISTS tenant_id;

DROP TABLE IF EXISTS tenants;
