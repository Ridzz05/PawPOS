-- +goose Up
-- Customer & pet directory (multi-operational foundation: booking, medical, promos).

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_tenant_active_idx ON customers(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS customers_tenant_name_idx ON customers(tenant_id, name);
CREATE INDEX IF NOT EXISTS customers_tenant_phone_idx ON customers(tenant_id, phone);

CREATE TABLE IF NOT EXISTS pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    species TEXT NOT NULL DEFAULT '',
    breed TEXT NOT NULL DEFAULT '',
    birth_date DATE,
    gender TEXT NOT NULL DEFAULT '',
    weight_kg NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (weight_kg >= 0),
    color TEXT NOT NULL DEFAULT '',
    allergies TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pets_tenant_active_idx ON pets(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS pets_customer_idx ON pets(customer_id);
CREATE INDEX IF NOT EXISTS pets_tenant_name_idx ON pets(tenant_id, name);
