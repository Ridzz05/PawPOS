import { createTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { ModalSlideTransition } from './components/ModalSlideTransition'

export function getTheme(mode: 'light' | 'dark' = 'light'): Theme {
  const isDark = mode === 'dark'

  const bgDefault = isDark ? '#0B0F19' : '#F8FAFC'
  const bgPaper = isDark ? '#131B2E' : '#FFFFFF'
  const bgInset = isDark ? '#0E1626' : '#F1F5F9'
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A'
  const textSecondary = isDark ? '#94A3B8' : '#64748B'
  const dividerColor = isDark ? '#1E293B' : '#E2E8F0'
  const borderColorHover = isDark ? '#334155' : '#CBD5E1'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#FF8A3D', // Official PawPOS Brand Orange
        dark: '#E66E20',
        light: isDark ? '#3B2414' : '#FFE3CC',
        contrastText: '#ffffff',
      },
      secondary: {
        main: isDark ? '#E2E8F0' : '#2D2D2D',
        dark: isDark ? '#CBD5E1' : '#1A1A1A',
        light: isDark ? '#94A3B8' : '#4B5563',
        contrastText: isDark ? '#0F172A' : '#ffffff',
      },
      background: {
        default: bgDefault,
        paper: bgPaper,
      },
      text: {
        primary: textPrimary,
        secondary: textSecondary,
      },
      divider: dividerColor,
      error: {
        main: '#EF4444',
        light: isDark ? '#451A1A' : '#FEE2E2',
        dark: '#B91C1C',
        contrastText: '#ffffff',
      },
      warning: {
        main: '#F59E0B',
        light: isDark ? '#3D2800' : '#FEF3C7',
        dark: '#B45309',
        contrastText: '#ffffff',
      },
      success: {
        main: '#10B981',
        light: isDark ? '#063B26' : '#ECFDF5',
        dark: '#047857',
        contrastText: '#ffffff',
      },
    },
    typography: {
      fontFamily:
        '"Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      h1: { fontWeight: 850, letterSpacing: '-0.035em', color: textPrimary, lineHeight: 1.15 },
      h2: { fontWeight: 800, letterSpacing: '-0.03em', color: textPrimary, lineHeight: 1.2 },
      h3: { fontWeight: 800, letterSpacing: '-0.025em', color: textPrimary, lineHeight: 1.25 },
      h4: { fontWeight: 800, letterSpacing: '-0.025em', color: textPrimary, lineHeight: 1.25 },
      h5: { fontWeight: 750, letterSpacing: '-0.02em', color: textPrimary, lineHeight: 1.3 },
      h6: { fontWeight: 750, letterSpacing: '-0.015em', color: textPrimary, lineHeight: 1.3 },
      subtitle1: { fontWeight: 600, letterSpacing: '-0.01em', color: textSecondary, lineHeight: 1.4 },
      subtitle2: { fontWeight: 650, letterSpacing: '-0.005em', color: textSecondary, lineHeight: 1.4 },
      body1: { fontSize: '0.925rem', letterSpacing: '-0.01em', lineHeight: 1.5, color: textPrimary },
      body2: { fontSize: '0.835rem', letterSpacing: '-0.005em', lineHeight: 1.45, color: textSecondary },
      button: { textTransform: 'none', fontWeight: 700, letterSpacing: '-0.01em' },
      overline: {
        fontWeight: 800,
        letterSpacing: '0.08em',
        fontSize: '0.72rem',
        color: '#FF8A3D',
      },
      caption: {
        fontSize: '0.76rem',
        letterSpacing: '0',
        color: textSecondary,
        fontFeatureSettings: '"tnum"',
      },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':focus-visible': {
            outline: '2px solid #FF8A3D',
            outlineOffset: '2px',
          },
        },
      },
      MuiButtonBase: {
        defaultProps: {
          disableRipple: true,
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true, disableRipple: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 650,
            padding: '8px 16px',
            boxShadow: 'none',
            transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
            '&:active': {
              transform: 'none',
            },
          },
          containedPrimary: {
            background: '#FF8A3D',
            color: '#ffffff',
            boxShadow: 'none',
            '&:hover': {
              background: '#E66E20',
              boxShadow: 'none',
            },
            '&:active': {
              background: '#D95D10',
              boxShadow: 'none',
            },
          },
          outlined: {
            borderColor: dividerColor,
            color: textPrimary,
            backgroundColor: bgPaper,
            boxShadow: 'none',
            '&:hover': {
              borderColor: borderColorHover,
              backgroundColor: isDark ? '#1A2438' : '#F8FAFC',
              color: textPrimary,
            },
          },
          sizeSmall: {
            padding: '5px 12px',
            fontSize: '0.8125rem',
            borderRadius: 8,
          },
          sizeLarge: {
            padding: '10px 22px',
            fontSize: '0.95rem',
            borderRadius: 10,
          },
        },
      },
      MuiPaper: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: {
            borderColor: dividerColor,
            borderRadius: 12,
            backgroundColor: bgPaper,
            boxShadow: 'none',
            transition: 'border-color 120ms ease, background-color 120ms ease',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            borderColor: dividerColor,
            backgroundColor: bgPaper,
            boxShadow: 'none',
            transition: 'border-color 120ms ease, background-color 120ms ease',
            '&:hover': {
              borderColor: borderColorHover,
              boxShadow: 'none',
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: dividerColor,
            fontFeatureSettings: '"tnum"',
            padding: '11px 16px',
            color: textPrimary,
          },
          head: {
            fontWeight: 700,
            color: textSecondary,
            backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
            borderBottom: `1px solid ${dividerColor}`,
            fontSize: '0.78rem',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 650,
            borderRadius: 8,
            fontSize: '0.76rem',
            height: 26,
          },
          outlined: {
            borderColor: dividerColor,
            backgroundColor: bgPaper,
            color: textPrimary,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: 'small',
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: bgInset,
            boxShadow: 'none',
            transition: 'border-color 120ms ease',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: dividerColor,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: borderColorHover,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#FF8A3D',
              borderWidth: 1.5,
            },
          },
          input: {
            color: textPrimary,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: bgPaper,
            color: textPrimary,
            borderColor: dividerColor,
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: bgPaper,
            borderColor: dividerColor,
            color: textPrimary,
          },
        },
      },
      MuiDialog: {
        defaultProps: {
          TransitionComponent: ModalSlideTransition,
          transitionDuration: { enter: 300, exit: 220 },
        },
        styleOverrides: {
          container: {
            alignItems: 'center',
            justifyContent: 'center',
            '@media (max-width: 599px)': {
              alignItems: 'flex-end',
              padding: 0,
            },
          },
          paper: {
            borderRadius: 20,
            border: `1px solid ${dividerColor}`,
            backgroundColor: bgPaper,
            boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 25px rgba(0,0,0,0.06)',
            overflow: 'hidden',
            '@media (max-width: 599px)': {
              margin: 0,
              width: '100%',
              maxWidth: '100% !important',
              maxHeight: '90vh',
              borderRadius: '24px 24px 0 0',
              borderBottom: 'none',
              boxShadow: isDark
                ? '0 -10px 30px rgba(0,0,0,0.5)'
                : '0 -10px 30px rgba(0,0,0,0.08)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
              '&::before': {
                content: '""',
                display: 'block',
                width: 40,
                height: 4.5,
                borderRadius: 9999,
                backgroundColor: isDark ? '#334155' : '#cbd5e1',
                margin: '10px auto 2px auto',
                flexShrink: 0,
              },
            },
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            padding: '16px 20px',
            borderBottom: `1px solid ${dividerColor}`,
            fontSize: '1.05rem',
            fontWeight: 750,
            letterSpacing: '-0.015em',
            color: textPrimary,
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: '20px',
            color: textPrimary,
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: '12px 20px',
            borderTop: `1px solid ${dividerColor}`,
            backgroundColor: isDark ? '#0E1626' : '#FAFAFA',
          },
        },
      },
    },
  })
}

// Backward-compatible default theme export
export const theme = getTheme('light')
