import { createTheme } from '@mui/material/styles'
import { ModalSlideTransition } from './components/ModalSlideTransition'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#FF8A3D', // Official PawPOS Brand Orange
      dark: '#E66E20',
      light: '#FFE3CC', // Soft Peach Tint
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#2D2D2D', // Official Dark Charcoal
      dark: '#1A1A1A',
      light: '#4B5563',
      contrastText: '#ffffff',
    },
    background: {
      default: '#F5F6F7', // Official Clean Neutral Canvas
      paper: '#ffffff',
    },
    text: {
      primary: '#2D2D2D', // Official Dark Charcoal
      secondary: '#64748B',
    },
    divider: '#e2e8f0',
    error: {
      main: '#dc2626',
      light: '#fee2e2',
      dark: '#991b1b',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#f59e0b',
      light: '#fef3c7',
      dark: '#b45309',
      contrastText: '#ffffff',
    },
    success: {
      main: '#10b981',
      light: '#ecfdf5',
      dark: '#047857',
      contrastText: '#ffffff',
    },
  },
  typography: {
    fontFamily:
      '"Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 850, letterSpacing: '-0.035em', color: '#0f172a', lineHeight: 1.15 },
    h2: { fontWeight: 800, letterSpacing: '-0.03em', color: '#0f172a', lineHeight: 1.2 },
    h3: { fontWeight: 800, letterSpacing: '-0.025em', color: '#0f172a', lineHeight: 1.25 },
    h4: { fontWeight: 800, letterSpacing: '-0.025em', color: '#0f172a', lineHeight: 1.25 },
    h5: { fontWeight: 750, letterSpacing: '-0.02em', color: '#0f172a', lineHeight: 1.3 },
    h6: { fontWeight: 750, letterSpacing: '-0.015em', color: '#0f172a', lineHeight: 1.3 },
    subtitle1: { fontWeight: 600, letterSpacing: '-0.01em', color: '#334155', lineHeight: 1.4 },
    subtitle2: { fontWeight: 650, letterSpacing: '-0.005em', color: '#334155', lineHeight: 1.4 },
    body1: { fontSize: '0.925rem', letterSpacing: '-0.01em', lineHeight: 1.5, color: '#1e293b' },
    body2: { fontSize: '0.835rem', letterSpacing: '-0.005em', lineHeight: 1.45, color: '#64748d' },
    button: { textTransform: 'none', fontWeight: 700, letterSpacing: '-0.01em' },
    overline: {
      fontWeight: 800,
      letterSpacing: '0.08em',
      fontSize: '0.72rem',
      color: '#ff8042',
    },
    caption: {
      fontSize: '0.76rem',
      letterSpacing: '0',
      fontFeatureSettings: '"tnum"',
    },
  },
  shape: { borderRadius: 12 }, // Standard Medium Radius (Section 13: 8/12/14px)
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true, // Snappy operational terminal feedback (no slow mobile water ripples)
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: true },
      styleOverrides: {
        root: {
          borderRadius: 8, // Standard Small Radius (Section 13)
          fontWeight: 650,
          padding: '8px 18px',
          boxShadow: 'none',
          transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
          '&:active': {
            transform: 'none', // No bounce or translation
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
          borderColor: '#e2e8f0',
          color: '#334155',
          backgroundColor: '#ffffff',
          boxShadow: 'none',
          '&:hover': {
            borderColor: '#cbd5e1',
            backgroundColor: '#f8fafc',
            color: '#1e293b',
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
          borderColor: '#e2e8f0',
          borderRadius: 12,
          backgroundColor: '#ffffff',
          boxShadow: 'none', // Flat-first (Section 14)
          transition: 'border-color 120ms ease, background-color 120ms ease',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          borderColor: '#e2e8f0',
          backgroundColor: '#ffffff',
          boxShadow: 'none', // Flat-first (Section 14)
          transition: 'border-color 120ms ease, background-color 120ms ease',
          '&:hover': {
            borderColor: '#cbd5e1',
            boxShadow: 'none', // No hover jump/shadow (Section 9)
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#e2e8f0',
          fontFeatureSettings: '"tnum"',
          padding: '11px 16px',
        },
        head: {
          fontWeight: 700,
          color: '#475569',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
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
          borderRadius: 8, // Compact 8px or pill only for status
          fontSize: '0.76rem',
          height: 26,
        },
        outlined: {
          borderColor: '#e2e8f0',
          backgroundColor: '#ffffff',
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
          borderRadius: 10, // 10-12px as per section 6
          backgroundColor: '#ffffff',
          boxShadow: 'none',
          transition: 'border-color 120ms ease',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#e2e8f0',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#cbd5e1',
          },
          '&.Mui-focused': {
            boxShadow: 'none',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#ff8042',
              borderWidth: '1.5px',
            },
          },
        },
        input: {
          fontSize: '0.88rem',
          padding: '9px 13px',
        },
      },
    },
    MuiDialog: {
      defaultProps: {
        TransitionComponent: ModalSlideTransition,
        transitionDuration: { enter: 300, exit: 220 },
      },
      styleOverrides: {
        root: {
          '& .MuiBackdrop-root': {
            transition: 'opacity 180ms ease !important',
          },
        },
        paper: {
          borderRadius: 14, // Large 14px as per Section 13
          boxShadow: '0 20px 40px -8px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(15, 23, 42, 0.04)', // Shadows allowed only on modals (Section 14)
          border: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          willChange: 'transform, opacity',
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(2px)',
          transition: 'opacity 180ms ease !important',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          border: '1px solid transparent',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 40,
        },
        indicator: {
          height: 2.5,
          borderRadius: 0,
          backgroundColor: '#ff8042',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 650,
          textTransform: 'none',
          fontSize: '0.88rem',
          minHeight: 40,
          padding: '8px 16px',
          color: '#64748d',
          '&.Mui-selected': {
            color: '#ff8042',
            fontWeight: 700,
          },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        ':focus-visible': { outline: '2px solid #ff8042', outlineOffset: 2 },
        body: {
          minWidth: 320,
          backgroundColor: '#f8f9fa',
          color: '#1e293b',
          fontFamily: '"Montserrat", system-ui, -apple-system, sans-serif',
          fontFeatureSettings: '"ss01"',
        },
        '::selection': {
          backgroundColor: '#fed7aa',
          color: '#1e293b',
        },
      },
    },
  },
})
