// scripts/seed-demo-data.mjs
const API_BASE = 'http://localhost:8080'
const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const LOCATION_ID = 'loc-main'

const products = [
  {
    sku: 'WSK-TUNA-85G',
    name: 'Whiskas Pouch Wet Tuna Adult 85g',
    purchase_price_idr: 6500,
    selling_price_idr: 8500,
    base_unit: 'sachet',
    minimum_stock: 20,
    stock: 72,
  },
  {
    sku: 'PROP-SALM-25KG',
    name: 'Pro Plan Sensitive Skin & Stomach Salmon 2.5kg',
    purchase_price_idr: 260000,
    selling_price_idr: 320000,
    base_unit: 'bag',
    minimum_stock: 4,
    stock: 12,
  },
  {
    sku: 'BENT-LAV-10L',
    name: 'Pasir Kucing Bentonite Gumpal Wangi Lavender 10L',
    purchase_price_idr: 42000,
    selling_price_idr: 55000,
    base_unit: 'bag',
    minimum_stock: 10,
    stock: 45,
  },
  {
    sku: 'BIO-SHAMP-250ML',
    name: 'Bioline Flea & Tick Anti-Parasite Shampoo 250ml',
    purchase_price_idr: 50000,
    selling_price_idr: 68000,
    base_unit: 'bottle',
    minimum_stock: 5,
    stock: 18,
  },
  {
    sku: 'VIR-NUTRI-120G',
    name: 'Virbac Nutri-Plus Gel High Calorie Supplement 120g',
    purchase_price_idr: 118000,
    selling_price_idr: 145000,
    base_unit: 'tube',
    minimum_stock: 3,
    stock: 15,
  },
  {
    sku: 'CATIT-SCRATCH-01',
    name: 'Catit Scratching Post Board Lounger',
    purchase_price_idr: 85000,
    selling_price_idr: 125000,
    base_unit: 'pcs',
    minimum_stock: 2,
    stock: 8,
  },
]

async function seed() {
  console.log('Seeding demo products and inventory...')
  for (const item of products) {
    const resProd = await fetch(`${API_BASE}/api/v1/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
      },
      body: JSON.stringify({
        sku: item.sku,
        name: item.name,
        purchase_price_idr: item.purchase_price_idr,
        selling_price_idr: item.selling_price_idr,
        base_unit: item.base_unit,
        minimum_stock: item.minimum_stock,
      }),
    })

    if (!resProd.ok) {
      console.warn(`Failed to create ${item.sku}:`, await resProd.text())
      continue
    }

    const prodJson = await resProd.json()
    const prodId = prodJson.data.id
    console.log(`Created product: ${item.name} (${prodId})`)

    const resStock = await fetch(`${API_BASE}/api/v1/inventory/movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
      },
      body: JSON.stringify({
        product_id: prodId,
        location_id: LOCATION_ID,
        quantity_delta: item.stock,
        movement_type: 'opening',
        reason: 'Initial stock intake',
      }),
    })

    if (resStock.ok) {
      console.log(`  Initialized ${item.stock} ${item.base_unit} in ${LOCATION_ID}`)
    }
  }
  console.log('Seeding finished!')
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})
