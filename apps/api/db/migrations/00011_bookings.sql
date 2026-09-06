-- +goose Up
-- Service bookings (grooming/klinik/penitipan queue) linked to customers, pets, and orders.

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
    service_id UUID REFERENCES services(id) ON DELETE RESTRICT,
    package_id UUID REFERENCES service_packages(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'antre' CHECK (status IN ('antre', 'proses', 'selesai', 'batal')),
    staff_name TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (service_id IS NOT NULL OR package_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS bookings_tenant_status_idx ON bookings(tenant_id, status);
CREATE INDEX IF NOT EXISTS bookings_tenant_scheduled_idx ON bookings(tenant_id, scheduled_at);
CREATE INDEX IF NOT EXISTS bookings_pet_idx ON bookings(pet_id);
