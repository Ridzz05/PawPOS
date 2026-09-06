import {
  AssessmentOutlined,
  CalendarMonthOutlined,
  CardGiftcardOutlined,
  DashboardOutlined,
  GroupOutlined,
  Inventory2Outlined,
  LanguageOutlined,
  LocalShippingOutlined,
  MedicalServicesOutlined,
  PaymentsOutlined,
  PetsOutlined,
  PointOfSaleOutlined,
  ReceiptLongOutlined,
  SettingsOutlined,
  ShoppingCartOutlined,
  SpaOutlined,
  StorefrontOutlined,
  SwapHorizOutlined,
} from '@mui/icons-material'
import type { Permission } from '../auth/rbac'

export interface NavItem {
  to: string
  label: string
  icon: typeof DashboardOutlined
  permission: Permission
  badge?: string
  /** Menu roadmap: tampil terkunci dengan chip "Segera" sampai fiturnya diimplementasikan. */
  comingSoon?: boolean
}

export interface NavGroup {
  group: string
  items: NavItem[]
}

/**
 * Registry tunggal seluruh navigasi sidebar.
 * Tambah menu baru = tambah 1 entri di sini + rute di App + permission di rbac.ts.
 */
export const navGroups: NavGroup[] = [
  {
    group: 'OPERASIONAL',
    items: [
      { to: '/pos', label: 'Kasir POS', icon: PointOfSaleOutlined, badge: 'Live', permission: 'access_pos' },
      { to: '/bookings', label: 'Booking & Antrean', icon: CalendarMonthOutlined, permission: 'access_bookings' },
      { to: '/orders', label: 'Riwayat Transaksi', icon: ReceiptLongOutlined, permission: 'access_orders' },
    ],
  },
  {
    group: 'PENJUALAN',
    items: [
      { to: '/products', label: 'Katalog Produk', icon: StorefrontOutlined, permission: 'access_products' },
      { to: '/services', label: 'Layanan & Paket', icon: SpaOutlined, permission: 'access_services' },
      { to: '/promos', label: 'Promo & Voucher', icon: CardGiftcardOutlined, permission: 'manage_promos' },
    ],
  },
  {
    group: 'PELANGGAN',
    items: [
      { to: '/customers', label: 'Data Pelanggan', icon: GroupOutlined, permission: 'access_customers' },
      { to: '/customers/hewan', label: 'Data Hewan', icon: PetsOutlined, permission: 'access_customers' },
    ],
  },
  {
    group: 'INVENTAR',
    items: [
      { to: '/inventory/stocks', label: 'Stok Inventori', icon: Inventory2Outlined, permission: 'access_inventory' },
      { to: '/suppliers', label: 'Supplier', icon: LocalShippingOutlined, permission: 'access_suppliers', comingSoon: true },
      { to: '/purchases', label: 'Pembelian (PO)', icon: ShoppingCartOutlined, permission: 'manage_purchases', comingSoon: true },
    ],
  },
  {
    group: 'KEUANGAN',
    items: [
      { to: '/expenses', label: 'Biaya Operasional', icon: PaymentsOutlined, permission: 'record_expense', comingSoon: true },
      { to: '/reports', label: 'Laporan Laba-Rugi', icon: AssessmentOutlined, permission: 'view_reports', comingSoon: true },
    ],
  },
  {
    group: 'JASA & MEDIS',
    items: [
      { to: '/medical', label: 'Rekam Medis Hewan', icon: MedicalServicesOutlined, permission: 'access_medical', comingSoon: true },
    ],
  },
  {
    group: 'MANAJEMEN',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: DashboardOutlined, permission: 'access_dashboard' },
      { to: '/shifts', label: 'Sesi & Shift', icon: SwapHorizOutlined, permission: 'access_shifts' },
    ],
  },
  {
    group: 'WORKSPACE',
    items: [
      { to: '/settings', label: 'Pengaturan', icon: SettingsOutlined, permission: 'access_settings' },
      { to: '/landing', label: 'Landing Page SaaS', icon: LanguageOutlined, permission: 'access_pos' },
    ],
  },
]
