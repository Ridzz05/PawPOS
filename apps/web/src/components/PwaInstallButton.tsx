import { useEffect, useState } from 'react'
import { GetAppOutlined, IosShareOutlined } from '@mui/icons-material'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function PwaInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [iosModalOpen, setIosModalOpen] = useState(false)

  const isIos =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream

  useEffect(() => {
    // Check if already in standalone mode
    if (
      (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
      (typeof window !== 'undefined' && (window.navigator as unknown as { standalone?: boolean })?.standalone === true)
    ) {
      setIsInstalled(true)
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  if (isInstalled) return null

  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
      }
    } else if (isIos) {
      setIosModalOpen(true)
    } else {
      // Fallback: show instructions or prompt
      alert('Untuk menginstal PawPOS: buka menu browser (titik tiga atau tombol bagikan) lalu pilih "Instal Aplikasi" atau "Tambahkan ke Layar Utama".')
    }
  }

  return (
    <>
      <Tooltip title="Instal PawPOS ke Layar Utama / Home Screen sebagai Aplikasi Native" arrow>
        <Button
          variant="outlined"
          size="small"
          onClick={handleInstallClick}
          startIcon={<GetAppOutlined sx={{ fontSize: 17 }} />}
          sx={{
            display: { xs: 'none', sm: 'inline-flex' },
            borderColor: 'divider',
            color: 'text.primary',
            fontSize: '0.78rem',
            fontWeight: 700,
            borderRadius: '8px',
            px: 1.5,
            py: 0.5,
            bgcolor: 'background.paper',
            '&:hover': {
              borderColor: 'primary.main',
              color: 'primary.main',
              bgcolor: 'action.hover',
            },
          }}
        >
          Instal POS
        </Button>
      </Tooltip>

      {/* Mobile Icon Button */}
      <Tooltip title="Instal POS" arrow>
        <IconButton
          size="small"
          onClick={handleInstallClick}
          sx={{
            display: { xs: 'inline-flex', sm: 'none' },
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px',
            p: 0.6,
          }}
        >
          <GetAppOutlined sx={{ fontSize: 18, color: 'text.primary' }} />
        </IconButton>
      </Tooltip>

      {/* iOS Installation Instruction Dialog */}
      <Dialog open={iosModalOpen} onClose={() => setIosModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1rem' }}>
          Instal di iPhone / iPad
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary', lineHeight: 1.6 }}>
            Untuk menginstal PawPOS ke Layar Utama Apple iOS layaknya aplikasi App Store:
          </Typography>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', lineHeight: 1.7 }}>
            <li>
              Ketuk tombol <strong>Bagikan (Share)</strong> <IosShareOutlined sx={{ fontSize: 16, verticalAlign: 'text-bottom' }} /> di bilah bawah Safari.
            </li>
            <li>
              Gulir ke bawah lalu pilih menu <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
            </li>
            <li>
              Ketuk <strong>Tambah (Add)</strong> di sudut kanan atas.
            </li>
          </ol>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setIosModalOpen(false)} variant="contained" sx={{ fontWeight: 700, borderRadius: '8px' }}>
            Mengerti
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
