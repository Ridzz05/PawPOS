import React from 'react'
import { Box } from '@mui/material'

export type MascotState = 'idle' | 'requesting' | 'listening' | 'uploading' | 'success' | 'error' | 'cancelled'

interface MascotAvatarProps {
  state?: MascotState
  size?: number
  sx?: object
}

export function MascotAvatar({ state = 'idle', size = 84, sx = {} }: MascotAvatarProps) {
  const isListening = state === 'listening'
  const isUploading = state === 'uploading'
  const isSuccess = state === 'success'
  const isError = state === 'error'

  return (
    <Box
      sx={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...sx,
      }}
    >
      {/* Pulse Aura Animation during Listening */}
      {isListening && (
        <Box
          sx={{
            position: 'absolute',
            width: size * 1.15,
            height: size * 1.15,
            borderRadius: '50%',
            bgcolor: 'rgba(255, 138, 61, 0.25)',
            animation: 'pawPulse 1.4s ease-out infinite',
            '@keyframes pawPulse': {
              '0%': { transform: 'scale(0.9)', opacity: 0.8 },
              '50%': { transform: 'scale(1.15)', opacity: 0.3 },
              '100%': { transform: 'scale(1.25)', opacity: 0 },
            },
          }}
        />
      )}

      {/* SVG Mascot Character with Headset */}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ overflow: 'visible' }}
      >
        {/* Soft Drop Shadow Filter */}
        <defs>
          <filter id="mascotShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#2D2D2D" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Headset Headband */}
        <path
          d="M 20 46 C 18 18, 82 18, 80 46"
          fill="none"
          stroke="#2D2D2D"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Fox / Shiba Ears */}
        {/* Left Ear */}
        <polygon points="26,42 16,16 42,26" fill="#FF8A3D" />
        <polygon points="26,38 20,22 36,28" fill="#FFE3CC" />
        {/* Right Ear */}
        <polygon points="74,42 84,16 58,26" fill="#FF8A3D" />
        <polygon points="74,38 80,22 64,28" fill="#FFE3CC" />

        {/* Main Head Base */}
        <circle cx="50" cy="52" r="32" fill="#FF8A3D" filter="url(#mascotShadow)" />

        {/* White Cheeks / Muzzle Mask */}
        <path
          d="M 30 52 C 26 62, 34 76, 50 76 C 66 76, 74 62, 70 52 C 64 56, 58 58, 50 58 C 42 58, 36 56, 30 52 Z"
          fill="#FFFFFF"
        />

        {/* Eyebrows (Cute white patches) */}
        <ellipse cx="39" cy="40" rx="3.5" ry="2.2" fill="#FFFFFF" />
        <ellipse cx="61" cy="40" rx="3.5" ry="2.2" fill="#FFFFFF" />

        {/* Eyes */}
        {isSuccess ? (
          // Winking eyes on success
          <>
            <circle cx="39" cy="49" r="3.8" fill="#2D2D2D" />
            <circle cx="40.5" cy="47.5" r="1.3" fill="#FFFFFF" />
            <path d="M 57 49 Q 62 45 67 49" fill="none" stroke="#2D2D2D" strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : isUploading ? (
          // Sparkling focused eyes when thinking
          <>
            <circle cx="39" cy="48" r="4.2" fill="#2D2D2D" />
            <circle cx="40.5" cy="46.5" r="1.5" fill="#FFFFFF" />
            <circle cx="61" cy="48" r="4.2" fill="#2D2D2D" />
            <circle cx="62.5" cy="46.5" r="1.5" fill="#FFFFFF" />
          </>
        ) : isError ? (
          // Puzzled eyes
          <>
            <circle cx="39" cy="49" r="3.5" fill="#2D2D2D" />
            <circle cx="61" cy="49" r="3.5" fill="#2D2D2D" />
            <ellipse cx="50" cy="67" rx="3" ry="2" fill="#2D2D2D" />
          </>
        ) : (
          // Normal friendly open eyes
          <>
            <circle cx="39" cy="49" r="4.2" fill="#2D2D2D" />
            <circle cx="40.5" cy="47" r="1.5" fill="#FFFFFF" />
            <circle cx="61" cy="49" r="4.2" fill="#2D2D2D" />
            <circle cx="62.5" cy="47" r="1.5" fill="#FFFFFF" />
          </>
        )}

        {/* Nose */}
        <ellipse cx="50" cy="58" rx="3.8" ry="2.8" fill="#2D2D2D" />

        {/* Mouth Smile */}
        {!isError && (
          <path
            d="M 44 63 Q 50 69 56 63"
            fill="none"
            stroke="#2D2D2D"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        )}

        {/* Soft Pink Cheeks */}
        <ellipse cx="29" cy="56" rx="3.5" ry="2.5" fill="#FFB15C" opacity="0.6" />
        <ellipse cx="71" cy="56" rx="3.5" ry="2.5" fill="#FFB15C" opacity="0.6" />

        {/* Left Headset Earcup with Paw Emblem */}
        <g transform="translate(14, 42)">
          <rect x="-3" y="-3" width="14" height="22" rx="7" fill="#2D2D2D" />
          <circle cx="4" cy="8" r="5" fill="#FF8A3D" />
          <circle cx="4" cy="9" r="2.2" fill="#FFFFFF" />
          <circle cx="2" cy="6.5" r="0.9" fill="#FFFFFF" />
          <circle cx="4" cy="5.8" r="0.9" fill="#FFFFFF" />
          <circle cx="6" cy="6.5" r="0.9" fill="#FFFFFF" />
        </g>

        {/* Right Headset Earcup with Paw Emblem */}
        <g transform="translate(75, 42)">
          <rect x="-3" y="-3" width="14" height="22" rx="7" fill="#2D2D2D" />
          <circle cx="4" cy="8" r="5" fill="#FF8A3D" />
          <circle cx="4" cy="9" r="2.2" fill="#FFFFFF" />
          <circle cx="2" cy="6.5" r="0.9" fill="#FFFFFF" />
          <circle cx="4" cy="5.8" r="0.9" fill="#FFFFFF" />
          <circle cx="6" cy="6.5" r="0.9" fill="#FFFFFF" />
        </g>

        {/* Microphone Boom Arm from Left Earcup to Mouth */}
        <path
          d="M 18 56 Q 22 72 40 70"
          fill="none"
          stroke="#2D2D2D"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        {/* Microphone Tip */}
        <ellipse cx="40" cy="70" rx="3.5" ry="2.8" fill={isListening ? '#FF8A3D' : '#2D2D2D'} />
      </svg>
    </Box>
  )
}
