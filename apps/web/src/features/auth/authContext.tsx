import React, { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { StaffRole } from './rbac'
import { ROLE_DEFINITIONS, setActiveStaff } from './rbac'
import type { BackendUser } from './authApi'
import { AuthApiError, loginPinWithBackend, loginWithBackend, revokeBackendSession } from './authApi'

export interface DemoAccount {
  email: string
  password: string
  pin: string
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
    pin: '9999',
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
    pin: '1234',
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
    pin: '5678',
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
    pin: '2026',
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
  pin: string
  name: string
  role: StaffRole
  roleTitle: string
  avatar: string
  /** Opaque session token dari backend; undefined saat login demo lokal. */
  token?: string
}

export interface AuthResult {
  success: boolean
  error?: string
  user?: AuthUser
  initialRoute?: string
}

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isScreenLocked: boolean
  login: (email: string, pass: string) => Promise<AuthResult>
  loginWithPin: (role: StaffRole, pin: string) => Promise<AuthResult>
  loginAsDemo: (role: StaffRole) => { user: AuthUser; initialRoute: string }
  lockScreen: () => void
  unlockScreen: (pin: string) => { success: boolean; error?: string }
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const AUTH_STORAGE_KEY = 'pawpos_auth_user'
const LOCK_STORAGE_KEY = 'pawpos_screen_locked'
const LOGIN_AT_KEY = 'pawpos_auth_login_at'

// Lead-hardening: batasi brute-force PIN + batasi umur sesi.
export const MAX_PIN_ATTEMPTS = 5
export const PIN_LOCKOUT_MS = 60_000
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000

function lockoutKey(role: string): string {
  return `pawpos_pin_lockout_${role}`
}

interface LockoutState {
  fails: number
  lockedUntil: number
}

function readLockout(role: string): LockoutState {
  try {
    const raw = localStorage.getItem(lockoutKey(role))
    if (raw) {
      const parsed = JSON.parse(raw) as LockoutState
      if (typeof parsed.fails === 'number' && typeof parsed.lockedUntil === 'number') {
        return parsed
      }
    }
  } catch {
    // ignore
  }
  return { fails: 0, lockedUntil: 0 }
}

function writeLockout(role: string, state: LockoutState): void {
  try {
    localStorage.setItem(lockoutKey(role), JSON.stringify(state))
  } catch {
    // storage fallback
  }
}

function clearLockout(role: string): void {
  try {
    localStorage.removeItem(lockoutKey(role))
  } catch {
    // storage fallback
  }
}

function lockoutRemainingMs(role: string): number {
  const state = readLockout(role)
  return Math.max(0, state.lockedUntil - Date.now())
}

function recordPinFailure(role: string): number {
  const state = readLockout(role)
  const fails = state.fails + 1
  const lockedUntil = fails >= MAX_PIN_ATTEMPTS ? Date.now() + PIN_LOCKOUT_MS : state.lockedUntil
  writeLockout(role, { fails, lockedUntil })
  return Math.max(0, lockedUntil - Date.now())
}

/** Demo 1-klik hanya untuk presentasi lead: DEV atau URL ?demo=1. */
export function isDemoLoginEnabled(): boolean {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true
  } catch {
    // ignore
  }
  try {
    if (typeof window !== 'undefined' && window.location.search.includes('demo=1')) return true
  } catch {
    // ignore
  }
  return false
}

function isSessionExpired(): boolean {
  try {
    const raw = localStorage.getItem(LOGIN_AT_KEY)
    if (!raw) return false
    return Date.now() - Number(raw) > SESSION_MAX_AGE_MS
  } catch {
    return false
  }
}

function persistSession(authUser: AuthUser): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser))
  try {
    localStorage.setItem(LOGIN_AT_KEY, String(Date.now()))
  } catch {
    // storage fallback
  }
}

function clearSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  localStorage.removeItem(LOCK_STORAGE_KEY)
  try {
    localStorage.removeItem(LOGIN_AT_KEY)
  } catch {
    // storage fallback
  }
}

function initialRouteFor(role: StaffRole): string {
  if (role === 'cashier') return '/pos'
  if (role === 'warehouse') return '/inventory/stocks'
  return '/dashboard'
}

/** Petakan user backend ke AuthUser lokal (PIN unlock diambil dari persona demo se-peran). */
function toAuthUser(backend: BackendUser, token: string): AuthUser {
  const role = (backend.role in ROLE_DEFINITIONS ? backend.role : 'cashier') as StaffRole
  const demoPin = DEMO_ACCOUNTS.find((a) => a.role === role)?.pin ?? ''
  return {
    id: backend.id,
    email: backend.email,
    pin: demoPin,
    name: backend.display_name,
    role,
    roleTitle: ROLE_DEFINITIONS[role].title,
    avatar: backend.avatar || ROLE_DEFINITIONS[role].label.charAt(0),
    token,
  }
}

function establishSession(authUser: AuthUser): AuthResult {
  return { success: true, user: authUser, initialRoute: initialRouteFor(authUser.role) }
}

function applySession(
  setUser: (u: AuthUser) => void,
  setLocked: (v: boolean) => void,
  authUser: AuthUser,
): void {
  setUser(authUser)
  setLocked(false)
  localStorage.removeItem(LOCK_STORAGE_KEY)
  persistSession(authUser)
  setActiveStaff({ id: authUser.id, name: authUser.name, role: authUser.role })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      if (isSessionExpired()) {
        clearSession()
        return null
      }
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

  const [isScreenLocked, setIsScreenLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LOCK_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Backend dulu (bcrypt server-side); jatuh ke demo lokal hanya jika backend tak terjangkau.
  const login = async (email: string, pass: string): Promise<AuthResult> => {
    const cleanEmail = email.trim().toLowerCase()
    const cleanPass = pass.trim()
    if (!cleanEmail || !cleanPass) {
      return { success: false, error: 'Email dan kata sandi wajib diisi.' }
    }
    const lockKey = `email-${cleanEmail}`
    const remaining = lockoutRemainingMs(lockKey)
    if (remaining > 0) {
      return { success: false, error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(remaining / 1000)} detik.` }
    }
    try {
      const backend = await loginWithBackend(cleanEmail, cleanPass)
      clearLockout(lockKey)
      const authUser = toAuthUser(backend.user, backend.token)
      applySession(setUser, setIsScreenLocked, authUser)
      return establishSession(authUser)
    } catch (error) {
      if (error instanceof AuthApiError && error.code !== 'NETWORK_ERROR') {
        const lockedFor = recordPinFailure(lockKey)
        if (lockedFor > 0) {
          return { success: false, error: `Kredensial salah 5x. Coba lagi dalam ${Math.ceil(lockedFor / 1000)} detik.` }
        }
        return { success: false, error: error.message }
      }
    }
    const match = DEMO_ACCOUNTS.find(
      (acc) => acc.email.toLowerCase() === cleanEmail && acc.password === cleanPass
    )
    if (!match) {
      const lockedFor = recordPinFailure(lockKey)
      if (lockedFor > 0) {
        return { success: false, error: `Kredensial salah 5x. Coba lagi dalam ${Math.ceil(lockedFor / 1000)} detik.` }
      }
      return { success: false, error: 'Email atau password akun tidak sesuai. Periksa kembali kredensial Anda.' }
    }
    clearLockout(lockKey)
    const authUser: AuthUser = {
      id: `staff-${match.role}`,
      email: match.email,
      pin: match.pin,
      name: match.name,
      role: match.role,
      roleTitle: match.roleTitle,
      avatar: match.avatar,
    }
    applySession(setUser, setIsScreenLocked, authUser)
    return establishSession(authUser)
  }

  const loginWithPin = async (role: StaffRole, pin: string): Promise<AuthResult> => {
    const cleanPin = pin.trim()
    const remaining = lockoutRemainingMs(role)
    if (remaining > 0) {
      return { success: false, error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(remaining / 1000)} detik.` }
    }
    try {
      const backend = await loginPinWithBackend(role, cleanPin)
      clearLockout(role)
      const authUser = toAuthUser(backend.user, backend.token)
      applySession(setUser, setIsScreenLocked, authUser)
      return establishSession(authUser)
    } catch (error) {
      if (error instanceof AuthApiError && error.code !== 'NETWORK_ERROR') {
        const lockedFor = recordPinFailure(role)
        if (lockedFor > 0) {
          return { success: false, error: `PIN salah 5x. Terminal dikunci ${Math.ceil(lockedFor / 1000)} detik.` }
        }
        return { success: false, error: error.message }
      }
    }
    const match = DEMO_ACCOUNTS.find((acc) => acc.role === role)
    if (!match) {
      return { success: false, error: 'Profil kasir tidak ditemukan.' }
    }
    if (match.pin !== cleanPin) {
      const lockedFor = recordPinFailure(role)
      if (lockedFor > 0) {
        return { success: false, error: `PIN salah 5x. Terminal dikunci ${Math.ceil(lockedFor / 1000)} detik.` }
      }
      return { success: false, error: 'PIN kasir salah. Silakan coba kembali.' }
    }
    clearLockout(role)
    const authUser: AuthUser = {
      id: `staff-${match.role}`,
      email: match.email,
      pin: match.pin,
      name: match.name,
      role: match.role,
      roleTitle: match.roleTitle,
      avatar: match.avatar,
    }
    applySession(setUser, setIsScreenLocked, authUser)
    return establishSession(authUser)
  }

  const loginAsDemo = (role: StaffRole) => {
    if (!isDemoLoginEnabled()) {
      throw new Error('Demo login dinonaktifkan di build produksi.')
    }
    const match = DEMO_ACCOUNTS.find((acc) => acc.role === role) || DEMO_ACCOUNTS[0]
    const authUser: AuthUser = {
      id: `staff-${match.role}`,
      email: match.email,
      pin: match.pin,
      name: match.name,
      role: match.role,
      roleTitle: match.roleTitle,
      avatar: match.avatar,
    }
    setUser(authUser)
    setIsScreenLocked(false)
    localStorage.removeItem(LOCK_STORAGE_KEY)
    persistSession(authUser)
    setActiveStaff({ id: authUser.id, name: authUser.name, role: authUser.role })
    return { user: authUser, initialRoute: match.initialRoute }
  }

  const lockScreen = () => {
    setIsScreenLocked(true)
    try {
      localStorage.setItem(LOCK_STORAGE_KEY, 'true')
    } catch {
      // storage fallback
    }
  }

  const unlockScreen = (pin: string) => {
    const cleanPin = pin.trim()
    if (!user) {
      return { success: false, error: 'Sesi tidak aktif. Silakan login kembali.' }
    }
    const remaining = lockoutRemainingMs(`unlock-${user.id}`)
    if (remaining > 0) {
      return { success: false, error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(remaining / 1000)} detik.` }
    }
    // Check against user PIN or matching demo PIN
    const expectedPin = user.pin || DEMO_ACCOUNTS.find((a) => a.role === user.role)?.pin || '1234'
    if (cleanPin !== expectedPin) {
      const lockedFor = recordPinFailure(`unlock-${user.id}`)
      if (lockedFor > 0) {
        return { success: false, error: `PIN salah 5x. Terminal dikunci ${Math.ceil(lockedFor / 1000)} detik.` }
      }
      return { success: false, error: 'PIN pengunci salah. Silakan periksa kembali.' }
    }
    clearLockout(`unlock-${user.id}`)
    setIsScreenLocked(false)
    try {
      localStorage.removeItem(LOCK_STORAGE_KEY)
    } catch {
      // storage fallback
    }
    return { success: true }
  }

  const logout = () => {
    if (user?.token) {
      revokeBackendSession(user.token)
    }
    setUser(null)
    setIsScreenLocked(false)
    clearSession()
    setActiveStaff({ id: 'guest', name: 'Tamu', role: 'cashier' })
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isScreenLocked,
        login,
        loginWithPin,
        loginAsDemo,
        lockScreen,
        unlockScreen,
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
    // Tanpa provider = tidak terautentikasi. Jangan auto-login sebagai owner.
    return {
      user: null,
      isAuthenticated: false,
      isScreenLocked: false,
      login: async () => ({ success: false, error: 'Sesi tidak tersedia.' }),
      loginWithPin: async () => ({ success: false, error: 'Sesi tidak tersedia.' }),
      loginAsDemo: () => {
        throw new Error('Sesi tidak tersedia.')
      },
      lockScreen: () => {},
      unlockScreen: () => ({ success: false, error: 'Sesi tidak tersedia.' }),
      logout: () => {},
    }
  }
  return ctx
}
