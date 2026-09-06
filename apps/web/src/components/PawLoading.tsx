import { Box, Paper, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

export interface PawLoadingProps {
  /** Optional loading message/label rendered under the icon/progress */
  label?: string
  /**
   * 'card' (default): Centered inside a flat terminal paper card with indeterminate progress track
   * 'inline': Compact badge/micro-spinner for buttons, status chips, or compact tables
   * 'fullscreen': Viewport-centered overlay for route or initial load transitions
   * 'icon': Clean floating animated icon with progress bar
   */
  variant?: 'card' | 'inline' | 'fullscreen' | 'icon'
  /** Size of the logo / icon */
  size?: 'small' | 'medium' | 'large'
  /** Custom sx overrides */
  sx?: SxProps<Theme>
  /** Additional class name */
  className?: string
  /** Optional data-testid */
  testId?: string
}

const SIZE_HEIGHT_MAP = {
  small: 28,
  medium: 42,
  large: 58,
}

const TRACK_WIDTH_MAP = {
  small: 100,
  medium: 140,
  large: 180,
}

export function PawLoading({
  label,
  variant = 'card',
  size = 'medium',
  sx = {},
  className = '',
  testId = 'paw-loading',
}: PawLoadingProps) {
  const height = SIZE_HEIGHT_MAP[size]
  const trackWidth = TRACK_WIDTH_MAP[size]

  // Inline Micro Loader (Compact for tables/buttons)
  if (variant === 'inline') {
    const inlineSize = size === 'small' ? 18 : size === 'large' ? 28 : 22
    return (
      <Box
        data-testid={testId}
        className={`paw-loading-inline ${className}`}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1.25,
          verticalAlign: 'middle',
          ...sx,
        }}
      >
        <Box
          sx={{
            width: inlineSize,
            height: inlineSize,
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Subtle spinning circular accent track */}
          <Box
            sx={{
              position: 'absolute',
              inset: -2,
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: 'primary.main',
              animation: 'spin 0.9s linear infinite',
            }}
          />
          {/* Iconic Paw Brand Badge */}
          <Box
            component="img"
            src="/branding/branding.png"
            alt="Loading..."
            sx={{
              width: inlineSize,
              height: inlineSize,
              borderRadius: '50%',
              objectFit: 'cover',
              objectPosition: 'left center',
              animation: 'pawBrandPulse 1.6s ease-in-out infinite',
              display: 'block',
            }}
          />
        </Box>
        {label && (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 650,
              fontSize: size === 'small' ? '0.78rem' : '0.85rem',
              color: 'text.secondary',
            }}
          >
            {label}
          </Typography>
        )}
      </Box>
    )
  }

  // Core Brand Visual Content
  const brandVisual = (
    <Box
      className="paw-loading-brand-wrap"
      sx={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Light Mode: Official raster branding.png */}
      <Box
        component="img"
        src="/branding/branding.png"
        alt={label || 'PawPOS Loading'}
        className="paw-loading-brand-img paw-loading-light paw-loading-pulse"
        sx={{
          height,
          width: 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
          display: 'block',
          'html[data-theme="dark"] &': {
            display: 'none',
          },
        }}
      />

      {/* Dark Mode: Official raster branding-dark.png (Paw in #ffffff, POS in #ff8a3d, tagline in slate) */}
      <Box
        component="img"
        src="/branding/branding-dark.png"
        alt={label || 'PawPOS Loading'}
        className="paw-loading-brand-img paw-loading-dark paw-loading-pulse"
        sx={{
          height,
          width: 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
          display: 'none',
          'html[data-theme="dark"] &': {
            display: 'block',
          },
        }}
      />

      {/* Indeterminate High-Precision Progress Track */}
      <Box
        className="paw-loading-progress-track"
        sx={{
          width: trackWidth,
          height: size === 'small' ? 2 : 3,
          mt: 1.5,
          bgcolor: 'divider',
          borderRadius: '9999px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box
          className="paw-loading-progress-bar"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '45%',
            bgcolor: 'primary.main',
            borderRadius: '9999px',
          }}
        />
      </Box>

      {label && (
        <Typography
          sx={{
            mt: 1.75,
            fontWeight: 650,
            color: 'text.secondary',
            fontSize: size === 'small' ? '0.8rem' : '0.88rem',
            letterSpacing: '-0.01em',
            textAlign: 'center',
          }}
        >
          {label}
        </Typography>
      )}
    </Box>
  )

  // Fullscreen Overlay
  if (variant === 'fullscreen') {
    return (
      <Box
        data-testid={testId}
        className={`paw-loading-fullscreen ${className}`}
        sx={{
          minHeight: '100dvh',
          width: '100vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          p: 3,
          boxSizing: 'border-box',
          ...sx,
        }}
      >
        {brandVisual}
      </Box>
    )
  }

  // Pure Floating Icon Variant
  if (variant === 'icon') {
    return (
      <Box
        data-testid={testId}
        className={`paw-loading-icon-variant ${className}`}
        sx={{
          py: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          ...sx,
        }}
      >
        {brandVisual}
      </Box>
    )
  }

  // Standard Terminal Card Variant (Default for page-level loaders)
  return (
    <Paper
      data-testid={testId}
      className={`terminal-card paw-loading-card ${className}`}
      elevation={0}
      sx={{
        p: { xs: 3.5, sm: 4.5 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '12px',
        bgcolor: 'background.paper',
        ...sx,
      }}
    >
      {brandVisual}
    </Paper>
  )
}
