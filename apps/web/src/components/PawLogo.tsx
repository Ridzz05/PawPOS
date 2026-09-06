import { Box, Stack, Typography } from '@mui/material'

export interface PawLogoProps {
  variant?: 'horizontal' | 'vertical' | 'icon-only' | 'compact'
  size?: 'small' | 'medium' | 'large'
  showTagline?: boolean
  tagline?: string
  sx?: object
}

export function PawIcon({ size = 32, sx = {} }: { size?: number; sx?: object }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 100 100"
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'inline-block',
        ...sx,
      }}
    >
      {/* Brand Orange Circular Badge */}
      <circle cx="50" cy="50" r="48" fill="#FF8A3D" />

      {/* Paw Center Main Pad */}
      <ellipse cx="50" cy="65" rx="19" ry="14" fill="#FFFFFF" />

      {/* 4 Toe Pads with Organic Angled Proportions */}
      <ellipse cx="32" cy="42" rx="7" ry="11" fill="#FFFFFF" transform="rotate(-14 32 42)" />
      <ellipse cx="44" cy="33" rx="7" ry="11" fill="#FFFFFF" transform="rotate(-4 44 33)" />
      <ellipse cx="56" cy="33" rx="7" ry="11" fill="#FFFFFF" transform="rotate(4 56 33)" />
      <ellipse cx="68" cy="42" rx="7" ry="11" fill="#FFFFFF" transform="rotate(14 68 42)" />
    </Box>
  )
}

export function PawLogo({
  variant = 'horizontal',
  size = 'medium',
  showTagline = true,
  tagline = 'Smart POS for Pet Business',
  sx = {},
}: PawLogoProps) {
  if (variant === 'icon-only') {
    const iconSize = size === 'small' ? 28 : size === 'large' ? 44 : 36
    return <PawIcon size={iconSize} sx={sx} />
  }

  const height =
    size === 'small'
      ? 28
      : size === 'large'
        ? (variant === 'vertical' ? 56 : 44)
        : 36

  return (
    <Box
      className="pawpos-primary-logo"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        ...sx,
      }}
    >
      {/* Light Mode: Official branding.png raster logo */}
      <Box
        component="img"
        src="/branding/branding.png"
        alt="PawPOS Logo"
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

      {/* Dark Mode: Official Brand Usage Dark Theme Palette (Paw in #FFFFFF, POS in #FF8A3D) */}
      <Stack
        direction={variant === 'vertical' ? 'column' : 'row'}
        alignItems="center"
        spacing={variant === 'vertical' ? 1 : 1.25}
        sx={{
          display: 'none',
          'html[data-theme="dark"] &': {
            display: 'inline-flex',
          },
        }}
      >
        <PawIcon size={variant === 'vertical' ? height : height * 0.9} />
        <Box sx={{ textAlign: variant === 'vertical' ? 'center' : 'left' }}>
          <Typography
            component="div"
            sx={{
              fontWeight: 900,
              fontSize: size === 'small' ? '1.1rem' : size === 'large' ? '1.5rem' : '1.3rem',
              letterSpacing: '-0.03em',
              color: '#FFFFFF',
              lineHeight: 1.1,
              fontFamily: '"Plus Jakarta Sans", sans-serif',
            }}
          >
            Paw<span style={{ color: '#FF8A3D' }}>POS</span>
          </Typography>
          {showTagline && variant !== 'compact' && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mt: 0.2,
                color: 'rgba(255, 255, 255, 0.72)',
                fontWeight: 650,
                letterSpacing: '0.03em',
                fontSize: size === 'small' ? '0.62rem' : size === 'large' ? '0.74rem' : '0.68rem',
                whiteSpace: 'nowrap',
              }}
            >
              {tagline}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  )
}
