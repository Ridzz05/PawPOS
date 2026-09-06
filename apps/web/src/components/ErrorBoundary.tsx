import { Component, type ErrorInfo, type ReactNode } from 'react'
import {
  Box,
  Button,
  Collapse,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import {
  BugReportOutlined,
  ErrorOutlineOutlined,
  KeyboardArrowDownOutlined,
  KeyboardArrowUpOutlined,
  RefreshOutlined,
  ReplayOutlined,
} from '@mui/icons-material'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
  onReset?: () => void
}

export interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  }

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    // Log to console or external monitoring
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo)
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    })
    this.props.onReset?.()
  }

  private handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  private toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }))
  }

  public override render(): ReactNode {
    const { hasError, error, errorInfo, showDetails } = this.state
    const { children, fallback } = this.props

    if (!hasError) {
      return children
    }

    if (fallback) {
      if (typeof fallback === 'function') {
        return fallback(error ?? new Error('Unknown error'), this.handleReset)
      }
      return fallback
    }

    return (
      <Box
        role="alert"
        aria-live="assertive"
        sx={{
          p: { xs: 2.5, sm: 4 },
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            maxWidth: 640,
            width: '100%',
            p: { xs: 3, sm: 4 },
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            boxShadow: 'none',
            textAlign: 'center',
            bgcolor: 'background.paper',
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'error.light',
              color: 'error.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <ErrorOutlineOutlined sx={{ fontSize: 32 }} />
          </Box>

          <Typography
            variant="h5"
            sx={{ fontWeight: 700, color: 'text.primary', mb: 1, letterSpacing: '-0.02em' }}
          >
            Terjadi Kesalahan pada Aplikasi
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
            Maaf, antarmuka mengalami kendala tak terduga saat memproses tampilan ini. Anda dapat mencoba memuat ulang tampilan atau merefresh halaman web.
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            justifyContent="center"
            sx={{ mb: 2 }}
          >
            <Button
              variant="contained"
              color="primary"
              startIcon={<ReplayOutlined />}
              onClick={this.handleReset}
              sx={{ px: 3, py: 1, fontWeight: 600, borderRadius: 2 }}
            >
              Coba Lagi
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshOutlined />}
              onClick={this.handleReload}
              sx={{ px: 3, py: 1, fontWeight: 600, borderRadius: 2 }}
            >
              Muat Ulang Halaman
            </Button>
          </Stack>

          {/* Collapsible Technical Debug Details */}
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              size="small"
              variant="text"
              color="inherit"
              startIcon={<BugReportOutlined fontSize="small" />}
              endIcon={showDetails ? <KeyboardArrowUpOutlined fontSize="small" /> : <KeyboardArrowDownOutlined fontSize="small" />}
              onClick={this.toggleDetails}
              sx={{ color: 'text.secondary', textTransform: 'none', fontSize: '0.8rem' }}
            >
              {showDetails ? 'Sembunyikan Rincian Teknis' : 'Lihat Rincian Teknis'}
            </Button>

            <Collapse in={showDetails}>
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  bgcolor: 'background.default',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  textAlign: 'left',
                  overflowX: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  color: 'text.secondary',
                  maxHeight: 220,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', color: 'error.main', mb: 1 }}>
                  {error?.name}: {error?.message}
                </Typography>
                {errorInfo?.componentStack && (
                  <Box component="pre" sx={{ m: 0, fontSize: '0.75rem', color: 'text.secondary' }}>
                    {errorInfo.componentStack}
                  </Box>
                )}
              </Box>
            </Collapse>
          </Box>
        </Paper>
      </Box>
    )
  }
}
