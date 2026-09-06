import React, { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
export type StaffRole = 'owner' | 'manager' | 'cashier' | 'warehouse' | 'staff_jasa'

export interface StaffUser {
  id: string
  name: string
  role: StaffRole
}

export const DEFAULT_STAFF: StaffUser = {
  id: 'staff-owner',
  name: 'Pemilik Toko',
  role: 'owner',
}

export function getActiveStaff(): StaffUser {
  try {
    const raw = localStorage.getItem('pawpos_active_staff')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && parsed.name && parsed.role) {
        return parsed as StaffUser
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_STAFF
}

export function setActiveStaff(staff: StaffUser): void {
  try {
    localStorage.setItem('pawpos_active_staff', JSON.stringify(staff))
  } catch {
    // storage fallback
  }
  window.dispatchEvent(new CustomEvent('pawpos:staff_change', { detail: staff }))
}

export type Permission =
  | 'access_dashboard'
  | 'access_pos'
  | 'access_orders'
  | 'access_products'
  | 'create_edit_products'
  | 'delete_products'
  | 'access_inventory'
  | 'record_stock_movement'
  | 'access_shifts'
  | 'reconcile_shifts'
  | 'access_settings'
  | 'register_store'
  | 'access_customers'
  | 'manage_customers'
  | 'access_services'
  | 'manage_services'
  | 'access_bookings'
  | 'manage_bookings'
  | 'access_medical'
  | 'manage_medical'
  | 'access_suppliers'
  | 'manage_purchases'
  | 'record_expense'
  | 'view_reports'
  | 'manage_promos'
  | 'manage_staff'

export interface RoleMeta {
  role: StaffRole
  label: string
  title: string
  description: string
  color: string
  badgeBg: string
  badgeColor: string
}

export const ROLE_DEFINITIONS: Record<StaffRole, RoleMeta> = {
  owner: {
    role: 'owner',
    label: 'OWNER',
    title: 'Owner / Pemilik Toko',
    description: 'Akses penuh tanpa batas ke seluruh modul kasir, inventori, laporan finansial, dan pengaturan.',
    color: '#2563eb',
    badgeBg: '#eff6ff',
    badgeColor: '#1d4ed8',
  },
  manager: {
    role: 'manager',
    label: 'MANAGER',
    title: 'Manajer / Supervisor Toko',
    description: 'Operasional harian toko, audit kasir & mutasi stok, serta penyesuaian katalog harga.',
    color: '#7c3aed',
    badgeBg: '#f5f3ff',
    badgeColor: '#6d28d9',
  },
  cashier: {
    role: 'cashier',
    label: 'KASIR',
    title: 'Kasir Operasional',
    description: 'Fokus melayani transaksi penjualan di kasir POS, sesi pergantian shift, dan cetak struk.',
    color: '#059669',
    badgeBg: '#ecfdf5',
    badgeColor: '#047857',
  },
  warehouse: {
    role: 'warehouse',
    label: 'GUDANG',
    title: 'Staf Gudang & Logistik',
    description: 'Penerimaan barang masuk dari supplier, pencatatan barang keluar rusak/expired, dan audit saldo fisik.',
    color: '#ea580c',
    badgeBg: '#fff7ed',
    badgeColor: '#c2410c',
  },
  staff_jasa: {
    role: 'staff_jasa',
    label: 'JASA',
    title: 'Staf Jasa Grooming & Klinik',
    description: 'Layanan grooming dan klinik hewan, booking antrean, rekam medis, dan data pelanggan terkait.',
    color: '#0d9488',
    badgeBg: '#f0fdfa',
    badgeColor: '#0f766e',
  },
}

export const ROLE_PERMISSIONS: Record<StaffRole, Set<Permission>> = {
  owner: new Set<Permission>([
    'access_dashboard',
    'access_pos',
    'access_orders',
    'access_products',
    'create_edit_products',
    'delete_products',
    'access_inventory',
    'record_stock_movement',
    'access_shifts',
    'reconcile_shifts',
    'access_settings',
    'register_store',
    'access_customers',
    'manage_customers',
    'access_services',
    'manage_services',
    'access_bookings',
    'manage_bookings',
    'access_medical',
    'manage_medical',
    'access_suppliers',
    'manage_purchases',
    'record_expense',
    'view_reports',
    'manage_promos',
    'manage_staff',
  ]),
  manager: new Set<Permission>([
    'access_dashboard',
    'access_pos',
    'access_orders',
    'access_products',
    'create_edit_products',
    'access_inventory',
    'record_stock_movement',
    'access_shifts',
    'reconcile_shifts',
    'access_settings',
    'access_customers',
    'manage_customers',
    'access_services',
    'manage_services',
    'access_bookings',
    'manage_bookings',
    'access_medical',
    'manage_medical',
    'access_suppliers',
    'manage_purchases',
    'record_expense',
    'view_reports',
    'manage_promos',
  ]),
  cashier: new Set<Permission>([
    'access_pos',
    'access_orders',
    'access_shifts',
    'reconcile_shifts',
    'access_customers',
    'access_services',
    'access_bookings',
  ]),
  warehouse: new Set<Permission>([
    'access_dashboard',
    'access_products',
    'access_inventory',
    'record_stock_movement',
    'access_suppliers',
  ]),
  staff_jasa: new Set<Permission>([
    'access_dashboard',
    'access_customers',
    'access_services',
    'access_bookings',
    'manage_bookings',
    'access_medical',
    'manage_medical',
  ]),
}

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role]
  if (!permissions) return false
  return permissions.has(permission)
}

export function useRbac() {
  const [staff, setStaff] = useState<StaffUser>(getActiveStaff())

  useEffect(() => {
    const handleStaffChange = () => {
      setStaff(getActiveStaff())
    }
    window.addEventListener('pawpos:staff_change', handleStaffChange)
    return () => window.removeEventListener('pawpos:staff_change', handleStaffChange)
  }, [])

  const role = (staff.role in ROLE_PERMISSIONS ? staff.role : 'owner') as StaffRole
  const meta = ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.owner

  return {
    staff,
    role,
    meta,
    isOwner: role === 'owner',
    isManager: role === 'manager',
    isCashier: role === 'cashier',
    isWarehouse: role === 'warehouse',
    isServiceStaff: role === 'staff_jasa',
    hasPermission: (permission: Permission) => hasPermission(role, permission),
  }
}

export interface PermissionGateProps {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { hasPermission } = useRbac()
  if (!hasPermission(permission)) {
    return React.createElement(React.Fragment, null, fallback)
  }
  return React.createElement(React.Fragment, null, children)
}
