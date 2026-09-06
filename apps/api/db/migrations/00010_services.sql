-- +goose Up
-- Service catalog & bundles (grooming, klinik, penitipan) for multi-operational sales.

CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'lainnya' CHECK (category IN ('grooming', 'klinik', 'penitipan', 'lainnya')),
    price_idr BIGINT NOT NULL DEFAULT 0 CHECK (price_idr >= 0),
    duration_minutes INT NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
    description TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS services_tenant_active_idx ON services(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS services_tenant_category_idx ON services(tenant_id, category);

CREATE TABLE IF NOT EXISTS service_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_idr BIGINT NOT NULL DEFAULT 0 CHECK (price_idr >= 0),
    description TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS service_packages_tenant_active_idx ON service_packages(tenant_id, is_active);

CREATE TABLE IF NOT EXISTS service_package_items (
    package_id UUID NOT NULL REFERENCES service_packages(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    sessions_included INT NOT NULL DEFAULT 1 CHECK (sessions_included > 0),
    PRIMARY KEY (package_id, service_id)
);
