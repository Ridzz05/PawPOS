import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Theme } from '@mui/material/styles'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { getTheme } from './theme'

export type ThemeMode = 'light' | 'dark'

interface ThemeContextType {
  mode: ThemeMode
  toggleThemeMode: () => void
  setThemeMode: (mode: ThemeMode) => void
  isDark: boolean
  theme: Theme
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'pawpos_theme_mode'

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') {
        return stored
      }
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
    } catch {
      // fallback
    }
    return 'light'
  })

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode)
      document.documentElement.setAttribute('data-theme', mode)
      
      // Sync meta theme-color
      const metaThemeColor = document.querySelector('meta[name="theme-color"]')
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', mode === 'dark' ? '#0B0F19' : '#FFFFFF')
      }
    } catch {
      // storage fallback
    }
  }, [mode])

  const toggleThemeMode = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const setThemeMode = (newMode: ThemeMode) => {
    setMode(newMode)
  }

  const activeTheme = useMemo(() => getTheme(mode), [mode])

  return (
    <ThemeContext.Provider
      value={{
        mode,
        toggleThemeMode,
        setThemeMode,
        isDark: mode === 'dark',
        theme: activeTheme,
      }}
    >
      <MuiThemeProvider theme={activeTheme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  )
}

export function useThemeMode(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    // Graceful fallback if used outside provider (e.g. isolated test)
    return {
      mode: 'light',
      toggleThemeMode: () => {},
      setThemeMode: () => {},
      isDark: false,
      theme: getTheme('light'),
    }
  }
  return context
}
