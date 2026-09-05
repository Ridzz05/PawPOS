import { describe, expect, it } from 'vitest'
import { hasPermission, ROLE_DEFINITIONS, ROLE_PERMISSIONS, type StaffRole } from './rbac'

describe('RBAC module', () => {
  it('defines 4 valid staff roles with metadata', () => {
    const roles: StaffRole[] = ['owner', 'manager', 'cashier', 'warehouse']
    roles.forEach((r) => {
      expect(ROLE_DEFINITIONS[r]).toBeDefined()
      expect(ROLE_DEFINITIONS[r].label).toBeTruthy()
      expect(ROLE_DEFINITIONS[r].color).toBeTruthy()
      expect(ROLE_PERMISSIONS[r]).toBeDefined()
    })
  })

  it('verifies owner has full permissions including delete_products and register_store', () => {
    expect(hasPermission('owner', 'access_dashboard')).toBe(true)
    expect(hasPermission('owner', 'access_pos')).toBe(true)
    expect(hasPermission('owner', 'delete_products')).toBe(true)
    expect(hasPermission('owner', 'register_store')).toBe(true)
    expect(hasPermission('owner', 'access_settings')).toBe(true)
  })

  it('verifies manager cannot delete products or register new stores', () => {
    expect(hasPermission('manager', 'access_dashboard')).toBe(true)
    expect(hasPermission('manager', 'access_pos')).toBe(true)
    expect(hasPermission('manager', 'create_edit_products')).toBe(true)
    expect(hasPermission('manager', 'delete_products')).toBe(false)
    expect(hasPermission('manager', 'register_store')).toBe(false)
  })

  it('verifies cashier is restricted from inventory management and store registration', () => {
    expect(hasPermission('cashier', 'access_pos')).toBe(true)
    expect(hasPermission('cashier', 'access_orders')).toBe(true)
    expect(hasPermission('cashier', 'access_shifts')).toBe(true)
    expect(hasPermission('cashier', 'access_products')).toBe(false)
    expect(hasPermission('cashier', 'access_inventory')).toBe(false)
    expect(hasPermission('cashier', 'register_store')).toBe(false)
    expect(hasPermission('cashier', 'access_settings')).toBe(false)
  })

  it('verifies warehouse staff is restricted from POS register and cashier shifts', () => {
    expect(hasPermission('warehouse', 'access_inventory')).toBe(true)
    expect(hasPermission('warehouse', 'record_stock_movement')).toBe(true)
    expect(hasPermission('warehouse', 'access_products')).toBe(true)
    expect(hasPermission('warehouse', 'access_pos')).toBe(false)
    expect(hasPermission('warehouse', 'access_shifts')).toBe(false)
    expect(hasPermission('warehouse', 'access_settings')).toBe(false)
  })
})
