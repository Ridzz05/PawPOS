import React from 'react'
import { IconButton, Tooltip } from '@mui/material'
import { DarkModeOutlined, LightModeOutlined } from '@mui/icons-material'
import { useThemeMode } from '../themeContext'

export function ThemeToggle({ size = 'medium' }: { size?: 'small' | 'medium' }) {
  const { mode, toggleThemeMode, isDark } = useThemeMode()

  return (
    <Tooltip title={isDark ? 'Beralih ke Tema Terang' : 'Beralih ke Tema Gelap'} arrow>
      <IconButton
        id="btn-theme-toggle"
        aria-label={isDark ? 'Beralih ke Tema Terang' : 'Beralih ke Tema Gelap'}
        onClick={toggleThemeMode}
        size={size}
        sx={{
          color: isDark ? '#F59E0B' : '#475569',
          bgcolor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(0, 0, 0, 0.04)',
          border: '1px solid',
          borderColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0, 0, 0, 0.08)',
          borderRadius: '8px',
          p: size === 'small' ? 0.6 : 0.9,
          transition: 'all 150ms ease',
          '&:hover': {
            bgcolor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0, 0, 0, 0.08)',
            borderColor: isDark ? '#F59E0B' : '#64748B',
          },
        }}
      >
        {isDark ? (
          <LightModeOutlined sx={{ fontSize: size === 'small' ? 18 : 20 }} />
        ) : (
          <DarkModeOutlined sx={{ fontSize: size === 'small' ? 18 : 20 }} />
        )}
      </IconButton>
    </Tooltip>
  )
}
