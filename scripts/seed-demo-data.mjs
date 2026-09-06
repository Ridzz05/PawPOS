const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080'
const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const LOCATION_ID = 'loc-main'

const categories = [
  'Pakan Kucing',
  'Pakan Anjing',
  'Aksesoris & Mainan',
  'Grooming & Perawatan',
  'Obat & Vitamin',
]

const products = [
  {
    sku: 'WSK-TUNA-85G',
    name: 'Whiskas Pouch Wet Tuna Adult 85g',
    category: 'Pakan Kucing',
    purchase_price_idr: 6500,
    selling_price_idr: 8500,
    base_unit: 'sachet',
    minimum_stock: 20,
    stock: 72,
  },
  {
    sku: 'PROP-SALM-25KG',
    name: 'Pro Plan Sensitive Skin & Stomach Salmon 2.5kg',
    category: 'Pakan Anjing',
    purchase_price_idr: 260000,
    selling_price_idr: 320000,
    base_unit: 'bag',
    minimum_stock: 4,
    stock: 12,
  },
  {
    sku: 'BENT-LAV-10L',
    name: 'Pasir Kucing Bentonite Gumpal Wangi Lavender 10L',
    category: 'Aksesoris & Mainan',
    purchase_price_idr: 42000,
    selling_price_idr: 55000,
    base_unit: 'bag',
    minimum_stock: 10,
    stock: 45,
  },
  {
    sku: 'BIO-SHAMP-250ML',
    name: 'Bioline Flea & Tick Anti-Parasite Shampoo 250ml',
    category: 'Grooming & Perawatan',
    purchase_price_idr: 50000,
    selling_price_idr: 68000,
    base_unit: 'bottle',
    minimum_stock: 5,
    stock: 18,
  },
  {
    sku: 'VIR-NUTRI-120G',
    name: 'Virbac Nutri-Plus Gel High Calorie Supplement 120g',
    category: 'Obat & Vitamin',
    purchase_price_idr: 118000,
    selling_price_idr: 145000,
    base_unit: 'tube',
    minimum_stock: 3,
    stock: 15,
  },
  {
    sku: 'CATIT-SCRATCH-01',
    name: 'Catit Scratching Post Board Lounger',
    category: 'Aksesoris & Mainan',
    purchase_price_idr: 85000,
    selling_price_idr: 125000,
    base_unit: 'pcs',
    minimum_stock: 2,
    stock: 8,
  },
]

async function seed() {
  console.log('Seeding demo categories, products and inventory...')
  const categoryIds = {}
  for (const name of categories) {
    const res = await fetch(`${API_BASE}/api/v1/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
      },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const json = await res.json()
      categoryIds[name] = json.data.id
      console.log(`Created category: ${name}`)
    } else if (res.status === 409) {
      const list = await fetch(`${API_BASE}/api/v1/categories`, {
        headers: { 'X-Tenant-ID': TENANT_ID },
      }).then((r) => r.json())
      const found = (list.data || []).find((c) => c.name.toLowerCase() === name.toLowerCase())
      if (found) {
        categoryIds[name] = found.id
        console.log(`Category exists: ${name}`)
      }
    } else {
      console.warn(`Failed to create category ${name}:`, await res.text())
    }
  }
  const catalog = {}
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
        category_id: categoryIds[item.category] || null,
        purchase_price_idr: item.purchase_price_idr,
        selling_price_idr: item.selling_price_idr,
        base_unit: item.base_unit,
        minimum_stock: item.minimum_stock,
      }),
    })

    let prodId = null
    if (resProd.ok) {
      const prodJson = await resProd.json()
      prodId = prodJson.data.id
      console.log(`Created product: ${item.name} (${prodId})`)
    } else if (resProd.status === 409) {
      // Product already seeded: resolve its id for sales seeding below.
      const list = await fetch(`${API_BASE}/api/v1/products`, {
        headers: { 'X-Tenant-ID': TENANT_ID },
      }).then((r) => r.json())
      const found = (list.data || []).find((p) => p.sku === item.sku)
      if (found) {
        prodId = found.id
        console.log(`Product exists: ${item.name} (${prodId})`)
      } else {
        console.warn(`Failed to create ${item.sku}:`, await resProd.text())
        continue
      }
    } else {
      console.warn(`Failed to create ${item.sku}:`, await resProd.text())
      continue
    }

    catalog[item.sku] = { id: prodId, name: item.name, price: item.selling_price_idr }

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

  await seedDemoSales(catalog)
  await seedDemoServices()
  console.log('Seeding finished!')
}

function orderItem(catalog, sku, quantity) {
  const entry = catalog[sku]
  return {
    product_id: entry.id,
    product_name: entry.name,
    sku,
    unit_price_idr: entry.price,
    quantity,
  }
}

async function seedDemoSales(catalog) {
  const needed = ['WSK-TUNA-85G', 'PROP-SALM-25KG', 'BENT-LAV-10L', 'BIO-SHAMP-250ML', 'VIR-NUTRI-120G', 'CATIT-SCRATCH-01']
  if (needed.some((sku) => !catalog[sku])) {
    console.warn('Skipping sales seeding: catalog incomplete.')
    return
  }

  const existing = await fetch(`${API_BASE}/api/v1/orders`, {
    headers: { 'X-Tenant-ID': TENANT_ID },
  }).then((r) => r.json())
  if ((existing.data || []).length > 0) {
    console.log('Sales already seeded, skipping demo transactions.')
    return
  }

  // Open a cashier shift for the demo sales (tolerate already-open).
  const openRes = await fetch(`${API_BASE}/api/v1/shifts/open`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': TENANT_ID,
    },
    body: JSON.stringify({
      cashier_name: 'Siti Rahma',
      starting_cash_idr: 200000,
      notes: 'Shift demo untuk presentasi lead',
    }),
  })
  if (openRes.ok) {
    console.log('Opened demo cashier shift.')
  } else {
    console.log(`Shift open skipped (${openRes.status}), continuing sales seeding.`)
  }

  const demoOrders = [
    {
      label: 'Tunai dengan kembalian',
      payment_method: 'cash',
      paid_amount_idr: 150000,
      notes: 'Pelanggan bawa 3 pouch + 2 pasir',
      items: [orderItem(catalog, 'WSK-TUNA-85G', 3), orderItem(catalog, 'BENT-LAV-10L', 2)],
    },
    {
      label: 'QRIS lunas pas',
      payment_method: 'qris',
      paid_amount_idr: 320000,
      notes: 'Scan QRIS di meja kasir',
      items: [orderItem(catalog, 'PROP-SALM-25KG', 1)],
    },
    {
      label: 'Split Tunai + QRIS',
      payment_method: 'split',
      paid_amount_idr: 213000,
      cash_amount_idr: 100000,
      non_cash_amount_idr: 113000,
      notes: 'Rp 100rb tunai + sisa QRIS',
      items: [orderItem(catalog, 'BIO-SHAMP-250ML', 1), orderItem(catalog, 'VIR-NUTRI-120G', 1)],
    },
    {
      label: 'Debit EDC',
      payment_method: 'debit_card',
      paid_amount_idr: 125000,
      notes: 'Gesek kartu debit',
      items: [orderItem(catalog, 'CATIT-SCRATCH-01', 1)],
    },
    {
      label: 'Tunai + diskon + pajak',
      payment_method: 'cash',
      paid_amount_idr: 50000,
      discount_idr: 2500,
      tax_idr: 4400,
      notes: 'Promo member + PPN 11%',
      items: [orderItem(catalog, 'WSK-TUNA-85G', 5)],
    },
  ]

  for (const order of demoOrders) {
    const res = await fetch(`${API_BASE}/api/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
      },
      body: JSON.stringify({ location_id: LOCATION_ID, ...order, label: undefined }),
    })
    if (res.ok) {
      const json = await res.json()
      console.log(`Created demo order ${json.data.order_number} (${order.label})`)
    } else {
      console.warn(`Failed to create demo order (${order.label}):`, await res.text())
    }
  }
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})

async function api(path, method = 'GET', body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': TENANT_ID,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return res
}

async function seedDemoServices() {
  const existing = await api('/api/v1/services').then((r) => r.json())
  if ((existing.data || []).length > 0) {
    console.log('Services already seeded, skipping demo jasa.')
    return
  }

  const demoServices = [
    { name: 'Grooming Komplit Kucing', category: 'grooming', price_idr: 80000, duration_minutes: 60 },
    { name: 'Grooming Anjing Kecil', category: 'grooming', price_idr: 100000, duration_minutes: 75 },
    { name: 'Vaksin Rabies + Konsultasi', category: 'klinik', price_idr: 150000, duration_minutes: 30 },
    { name: 'Penitipan Harian Kucing', category: 'penitipan', price_idr: 50000, duration_minutes: 0 },
  ]
  const serviceIds = {}
  for (const svc of demoServices) {
    const res = await api('/api/v1/services', 'POST', svc)
    if (!res.ok) {
      console.warn(`Failed to create service ${svc.name}:`, await res.text())
      continue
    }
    const json = await res.json()
    serviceIds[svc.name] = json.data.id
    console.log(`Created service: ${svc.name}`)
  }

  const pkgRes = await api('/api/v1/packages', 'POST', {
    name: 'Paket Grooming Kucing 3x',
    price_idr: 210000,
    description: 'Hemat Rp 30rb untuk 3x grooming komplit.',
    items: serviceIds['Grooming Komplit Kucing']
      ? [{ service_id: serviceIds['Grooming Komplit Kucing'], sessions_included: 3 }]
      : [],
  })
  if (pkgRes.ok) {
    console.log('Created package: Paket Grooming Kucing 3x')
  }

  // Demo customer + pet + booking so the antrean flow is visible immediately.
  const custRes = await api('/api/v1/customers', 'POST', {
    name: 'Sinta Maharani',
    phone: '081298765432',
    address: 'Jl. Kenanga No. 8',
  })
  if (!custRes.ok) {
    console.warn('Failed to create demo customer:', await custRes.text())
    return
  }
  const customerId = (await custRes.json()).data.id
  const petRes = await api('/api/v1/pets', 'POST', {
    customer_id: customerId,
    name: 'Cimol',
    species: 'Kucing',
    breed: 'Domestik',
    gender: 'jantan',
    weight_kg: 4.2,
  })
  if (!petRes.ok) {
    console.warn('Failed to create demo pet:', await petRes.text())
    return
  }
  const petId = (await petRes.json()).data.id
  const slot = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  const bookRes = await api('/api/v1/bookings', 'POST', {
    customer_id: customerId,
    pet_id: petId,
    service_id: serviceIds['Grooming Komplit Kucing'],
    location_id: LOCATION_ID,
    scheduled_at: slot,
    staff_name: 'Rina (Groomer)',
    notes: 'Minta potong kuku + bersihkan telinga',
  })
  if (bookRes.ok) {
    const json = await bookRes.json()
    console.log(`Created demo booking ${json.data.id} (Cimol - Grooming Komplit)`)
  } else {
    console.warn('Failed to create demo booking:', await bookRes.text())
  }

  // Demo Promos & Vouchers for POS testing and customer campaigns
  const demoPromos = [
    {
      code: 'PAWHEMAT10',
      name: 'Diskon Pelanggan Setia 10%',
      kind: 'percent',
      value: 10,
      min_spend: 50000,
      max_discount: 25000,
      quota: 100,
    },
    {
      code: 'NEWPET25K',
      name: 'Voucher Belanja Pertama Rp 25.000',
      kind: 'nominal',
      value: 25000,
      min_spend: 100000,
      max_discount: 0,
      quota: 50,
    },
    {
      code: 'GROOMINGVIP',
      name: 'Promo Paket Grooming VIP 15%',
      kind: 'percent',
      value: 15,
      min_spend: 75000,
      max_discount: 30000,
      quota: 30,
    },
  ]

  for (const promo of demoPromos) {
    const res = await api('/api/v1/promos', 'POST', promo)
    if (res.ok) {
      console.log(`Created promo: ${promo.code} (${promo.name})`)
    } else if (res.status === 409) {
      console.log(`Promo ${promo.code} already exists, skipping`)
    } else {
      console.warn(`Failed to create promo ${promo.code}:`, await res.text())
    }
  }
}
