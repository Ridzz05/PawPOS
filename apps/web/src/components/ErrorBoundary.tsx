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
            borderColor: '#e3e8ee',
            borderRadius: 3,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            textAlign: 'center',
            bgcolor: '#ffffff',
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: '#fef2f2',
              color: '#df1b41',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2.5,
              border: '1px solid #fee2e2',
            }}
          >
            <ErrorOutlineOutlined sx={{ fontSize: 32 }} />
          </Box>

          <Typography
            variant="h5"
            sx={{ fontWeight: 700, color: '#0d253d', mb: 1, letterSpacing: '-0.02em' }}
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
              sx={{ px: 3, py: 1, fontWeight: 600, borderRadius: 2, borderColor: '#e3e8ee', color: '#425466' }}
            >
              Muat Ulang Halaman
            </Button>
          </Stack>

          {/* Collapsible Technical Debug Details */}
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #f0f2f5' }}>
            <Button
              size="small"
              variant="text"
              color="inherit"
              startIcon={<BugReportOutlined fontSize="small" />}
              endIcon={showDetails ? <KeyboardArrowUpOutlined fontSize="small" /> : <KeyboardArrowDownOutlined fontSize="small" />}
              onClick={this.toggleDetails}
              sx={{ color: '#697386', textTransform: 'none', fontSize: '0.8rem' }}
            >
              {showDetails ? 'Sembunyikan Rincian Teknis' : 'Lihat Rincian Teknis'}
            </Button>

            <Collapse in={showDetails}>
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  bgcolor: '#f8fafc',
                  borderRadius: 2,
                  border: '1px solid #e2e8f0',
                  textAlign: 'left',
                  overflowX: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  color: '#334155',
                  maxHeight: 220,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', color: '#dc2626', mb: 1 }}>
                  {error?.name}: {error?.message}
                </Typography>
                {errorInfo?.componentStack && (
                  <Box component="pre" sx={{ m: 0, fontSize: '0.75rem', color: '#64748b' }}>
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
