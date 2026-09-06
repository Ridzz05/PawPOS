-- +goose Up
-- Staff PIN login + seed demo roles/users (mirrors frontend demo personas).

ALTER TABLE users ADD COLUMN IF NOT EXISTS pin TEXT;

-- Seed roles
INSERT INTO roles (name, description) VALUES
    ('owner', 'Owner / Pemilik Toko'),
    ('manager', 'Manajer / Supervisor Toko'),
    ('cashier', 'Kasir Operasional'),
    ('warehouse', 'Staf Gudang & Logistik')
ON CONFLICT (name) DO NOTHING;

-- Seed permissions (mirrors frontend ROLE_PERMISSIONS)
INSERT INTO permissions (code, description) VALUES
    ('access_dashboard', 'Akses dashboard operasional'),
    ('access_pos', 'Akses terminal kasir POS'),
    ('access_orders', 'Akses riwayat transaksi'),
    ('access_products', 'Akses katalog produk'),
    ('create_edit_products', 'Buat dan ubah produk'),
    ('delete_products', 'Hapus produk'),
    ('access_inventory', 'Akses stok inventori'),
    ('record_stock_movement', 'Catat mutasi stok'),
    ('access_shifts', 'Akses sesi shift kasir'),
    ('reconcile_shifts', 'Rekonsiliasi shift kasir'),
    ('access_settings', 'Akses pengaturan workspace'),
    ('register_store', 'Daftarkan toko baru')
ON CONFLICT (code) DO NOTHING;

-- Owner: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'owner'
ON CONFLICT DO NOTHING;

-- Manager: all except delete_products, register_store
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'manager' AND p.code NOT IN ('delete_products', 'register_store')
ON CONFLICT DO NOTHING;

-- Cashier: POS-focused
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'cashier' AND p.code IN ('access_pos', 'access_orders', 'access_shifts', 'reconcile_shifts')
ON CONFLICT DO NOTHING;

-- Warehouse: inventory-focused
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'warehouse' AND p.code IN ('access_dashboard', 'access_products', 'access_inventory', 'record_stock_movement')
ON CONFLICT DO NOTHING;

-- Seed demo staff users (passwords match public demo credentials)
INSERT INTO users (email, display_name, password_hash, pin, tenant_id, is_active) VALUES
    ('owner@pawpos.id', 'Budi Santoso', '$2a$10$9WH.9UQOFMB9RxRZELjfh.wvRItZRaQ1bPhXsL3EwW2I8/lu4sILy', '9999', '00000000-0000-0000-0000-000000000001', TRUE),
    ('kasir@pawpos.id', 'Siti Rahma', '$2a$10$QRQAbjEkkVv.pK4LKUaiE.w/0djIPSiBxD6KE0WOMGnzeJaoddOtq', '1234', '00000000-0000-0000-0000-000000000001', TRUE),
    ('gudang@pawpos.id', 'Agus Pratama', '$2a$10$Hy0zQ/cwFJMUzZqAUUeS1uFgSx1HIVS/4Uh9MwulRNNe4LU1hADCO', '5678', '00000000-0000-0000-0000-000000000001', TRUE),
    ('manager@pawpos.id', 'Dewi Lestari', '$2a$10$K91VY.gzE1i0y9tvbFJcu.3BKuhzO8njSntz3tl4QAwwV.9dGWLaS', '2026', '00000000-0000-0000-0000-000000000001', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Link demo users to roles
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON
    (u.email = 'owner@pawpos.id' AND r.name = 'owner') OR
    (u.email = 'manager@pawpos.id' AND r.name = 'manager') OR
    (u.email = 'kasir@pawpos.id' AND r.name = 'cashier') OR
    (u.email = 'gudang@pawpos.id' AND r.name = 'warehouse')
ON CONFLICT DO NOTHING;
