-- +goose Up
CREATE TABLE IF NOT EXISTS cashier_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cashier_id UUID REFERENCES users(id) ON DELETE SET NULL,
    cashier_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    starting_cash_idr BIGINT NOT NULL DEFAULT 0,
    expected_cash_idr BIGINT NOT NULL DEFAULT 0,
    actual_cash_idr BIGINT NOT NULL DEFAULT 0,
    cash_difference_idr BIGINT NOT NULL DEFAULT 0,
    total_cash_sales_idr BIGINT NOT NULL DEFAULT 0,
    total_non_cash_sales_idr BIGINT NOT NULL DEFAULT 0,
    transaction_count INT NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS cashier_shifts_tenant_status_idx ON cashier_shifts(tenant_id, status);
CREATE INDEX IF NOT EXISTS cashier_shifts_tenant_opened_idx ON cashier_shifts(tenant_id, opened_at DESC);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES cashier_shifts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_shift_id_idx ON orders(shift_id);

-- +goose Down
DROP INDEX IF EXISTS orders_shift_id_idx;
ALTER TABLE orders DROP COLUMN IF EXISTS shift_id;
DROP INDEX IF EXISTS cashier_shifts_tenant_opened_idx;
DROP INDEX IF EXISTS cashier_shifts_tenant_status_idx;
DROP TABLE IF EXISTS cashier_shifts;
