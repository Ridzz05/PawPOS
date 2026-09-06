-- +goose Up
-- Promos, vouchers, and redemption ledger per tenant

CREATE TABLE IF NOT EXISTS promos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL CHECK (kind IN ('percent', 'nominal')),
    value BIGINT NOT NULL CHECK (value > 0),
    min_spend BIGINT NOT NULL DEFAULT 0 CHECK (min_spend >= 0),
    max_discount BIGINT NOT NULL DEFAULT 0 CHECK (max_discount >= 0),
    quota INT NOT NULL DEFAULT 0 CHECK (quota >= 0),
    used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT promos_tenant_code_unique UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS promos_tenant_idx ON promos(tenant_id, is_active);

CREATE TABLE IF NOT EXISTS promo_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE,
    promo_id UUID NOT NULL REFERENCES promos(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    discount_applied BIGINT NOT NULL CHECK (discount_applied >= 0),
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT promo_redemptions_order_promo_unique UNIQUE (order_id, promo_id)
);

CREATE INDEX IF NOT EXISTS promo_redemptions_promo_idx ON promo_redemptions(promo_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_id UUID REFERENCES promos(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT NOT NULL DEFAULT '';
