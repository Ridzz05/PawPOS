-- +goose Up
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check 
    CHECK (payment_method IN ('cash', 'qris', 'debit_card', 'credit_card', 'split'));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_amount_idr BIGINT NOT NULL DEFAULT 0 CHECK (cash_amount_idr >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS non_cash_amount_idr BIGINT NOT NULL DEFAULT 0 CHECK (non_cash_amount_idr >= 0);
