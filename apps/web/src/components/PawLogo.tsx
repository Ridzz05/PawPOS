import React from 'react'
import { Box, Stack, Typography } from '@mui/material'

export interface PawLogoProps {
  variant?: 'horizontal' | 'vertical' | 'icon-only' | 'compact'
  size?: 'small' | 'medium' | 'large'
  showTagline?: boolean
  tagline?: string
  inverted?: boolean
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
  inverted = false,
  sx = {},
}: PawLogoProps) {
  const iconSize = size === 'small' ? 28 : size === 'large' ? 44 : 36
  const textSize = size === 'small' ? '1.15rem' : size === 'large' ? '1.65rem' : '1.35rem'
  const taglineSize = size === 'small' ? '0.62rem' : size === 'large' ? '0.74rem' : '0.68rem'
  const textColor = inverted ? '#FFFFFF' : '#2D2D2D'

  if (variant === 'icon-only') {
    return <PawIcon size={iconSize} sx={sx} />
  }

  if (variant === 'vertical') {
    return (
      <Stack alignItems="center" spacing={0.75} sx={sx}>
        <PawIcon size={iconSize * 1.25} />
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            component="span"
            sx={{
              fontWeight: 900,
              fontSize: textSize,
              letterSpacing: '-0.035em',
              color: textColor,
              lineHeight: 1,
              fontFamily: '"Plus Jakarta Sans", sans-serif',
            }}
          >
            Paw<span style={{ color: '#FF8A3D' }}>POS</span>
          </Typography>
          {showTagline && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mt: 0.25,
                color: inverted ? 'rgba(255,255,255,0.7)' : '#64748B',
                fontWeight: 700,
                letterSpacing: '0.04em',
                fontSize: taglineSize,
              }}
            >
              {tagline}
            </Typography>
          )}
        </Box>
      </Stack>
    )
  }

  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={sx}>
      <PawIcon size={iconSize} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="div"
          sx={{
            fontWeight: 900,
            fontSize: textSize,
            letterSpacing: '-0.03em',
            color: textColor,
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
              mt: 0.1,
              color: inverted ? 'rgba(255,255,255,0.7)' : '#64748B',
              fontWeight: 700,
              letterSpacing: '0.04em',
              fontSize: taglineSize,
              whiteSpace: 'nowrap',
            }}
          >
            {tagline}
          </Typography>
        )}
      </Box>
    </Stack>
  )
}
