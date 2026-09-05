-- name: GetActiveProducts :many
SELECT id, sku, name, purchase_price_idr, selling_price_idr, base_unit, minimum_stock
FROM products
WHERE is_active = TRUE
ORDER BY name;

-- name: GetProductBySKU :one
SELECT id, sku, name, purchase_price_idr, selling_price_idr, base_unit, minimum_stock
FROM products
WHERE sku = $1;
