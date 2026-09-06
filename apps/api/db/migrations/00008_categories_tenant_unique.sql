-- +goose Up
-- Category names must be unique per tenant (not globally), mirroring products(sku).
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
ALTER TABLE categories ADD CONSTRAINT categories_tenant_name_key UNIQUE (tenant_id, name);
CREATE INDEX IF NOT EXISTS categories_tenant_active_idx ON categories(tenant_id, is_active);
