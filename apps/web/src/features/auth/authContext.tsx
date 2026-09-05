import React, { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { StaffRole } from './rbac'
import { setActiveStaff } from './rbac'

export interface DemoAccount {
  email: string
  password: string
  name: string
  role: StaffRole
  roleTitle: string
  avatar: string
  description: string
  badgeBg: string
  badgeColor: string
  initialRoute: string
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'owner@pawpos.id',
    password: 'pawpos123',
    name: 'Budi Santoso',
    role: 'owner',
    roleTitle: 'Owner / Pemilik Toko',
    avatar: '👑',
    description: 'Akses penuh tanpa batas: Dashboard finansial, kasir POS, katalog produk, stok inventori, shift, dan pengaturan.',
    badgeBg: '#eff6ff',
    badgeColor: '#1d4ed8',
    initialRoute: '/dashboard',
  },
  {
    email: 'kasir@pawpos.id',
    password: 'kasir123',
    name: 'Siti Rahma',
    role: 'cashier',
    roleTitle: 'Kasir Operasional',
    avatar: '💳',
    description: 'Akses khusus terminal kasir POS, split payment, cetak struk, dan sesi pergantian shift kasir.',
    badgeBg: '#ecfdf5',
    badgeColor: '#047857',
    initialRoute: '/pos',
  },
  {
    email: 'gudang@pawpos.id',
    password: 'gudang123',
    name: 'Agus Pratama',
    role: 'warehouse',
    roleTitle: 'Staf Gudang & Logistik',
    avatar: '📦',
    description: 'Akses penerimaan barang masuk supplier, pencatatan mutasi fisik, monitoring stok menipis, dan katalog produk.',
    badgeBg: '#fff7ed',
    badgeColor: '#c2410c',
    initialRoute: '/inventory/stocks',
  },
  {
    email: 'manager@pawpos.id',
    password: 'manager123',
    name: 'Dewi Lestari',
    role: 'manager',
    roleTitle: 'Store Supervisor',
    avatar: '📋',
    description: 'Akses supervisi operasional harian, audit kasir & laci kas, monitoring mutasi stok, serta penyesuaian katalog harga.',
    badgeBg: '#f5f3ff',
    badgeColor: '#6d28d9',
    initialRoute: '/dashboard',
  },
]

export interface AuthUser {
  id: string
  email: string
  name: string
  role: StaffRole
  roleTitle: string
  avatar: string
}

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (email: string, pass: string) => { success: boolean; error?: string; user?: AuthUser; initialRoute?: string }
  loginAsDemo: (role: StaffRole) => { user: AuthUser; initialRoute: string }
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const AUTH_STORAGE_KEY = 'pawpos_auth_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser
        if (parsed && parsed.email && parsed.role) {
          // Sync with rbac
          setActiveStaff({ id: parsed.id, name: parsed.name, role: parsed.role })
          return parsed
        }
      }
    } catch {
      // fallback
    }
    return null
  })

  const login = (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase()
    const cleanPass = pass.trim()
    const match = DEMO_ACCOUNTS.find(
      (acc) => acc.email.toLowerCase() === cleanEmail && acc.password === cleanPass
    )
    if (!match) {
      return { success: false, error: 'Email atau password akun demo salah. Periksa kredensial di atas.' }
    }
    const authUser: AuthUser = {
      id: `staff-${match.role}`,
      email: match.email,
      name: match.name,
      role: match.role,
      roleTitle: match.roleTitle,
      avatar: match.avatar,
    }
    setUser(authUser)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser))
    setActiveStaff({ id: authUser.id, name: authUser.name, role: authUser.role })
    return { success: true, user: authUser, initialRoute: match.initialRoute }
  }

  const loginAsDemo = (role: StaffRole) => {
    const match = DEMO_ACCOUNTS.find((acc) => acc.role === role) || DEMO_ACCOUNTS[0]
    const authUser: AuthUser = {
      id: `staff-${match.role}`,
      email: match.email,
      name: match.name,
      role: match.role,
      roleTitle: match.roleTitle,
      avatar: match.avatar,
    }
    setUser(authUser)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser))
    setActiveStaff({ id: authUser.id, name: authUser.name, role: authUser.role })
    return { user: authUser, initialRoute: match.initialRoute }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setActiveStaff({ id: 'guest', name: 'Tamu', role: 'cashier' })
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        loginAsDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
