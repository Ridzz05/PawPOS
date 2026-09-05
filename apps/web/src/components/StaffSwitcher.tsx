import { useEffect, useState } from 'react'
import {
  AdminPanelSettingsOutlined,
  PointOfSaleOutlined,
  SupervisorAccountOutlined,
  WarehouseOutlined,
} from '@mui/icons-material'
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { ModalSlideTransition } from './ModalSlideTransition'
import {
  DEFAULT_STAFF,
  getActiveStaff,
  ROLE_DEFINITIONS,
  setActiveStaff,
  type StaffRole,
  type StaffUser,
} from '../features/auth/rbac'

export {
  DEFAULT_STAFF,
  getActiveStaff,
  setActiveStaff,
  type StaffUser,
}

export function StaffSwitcher({ fullWidth = false }: { fullWidth?: boolean } = {}) {
  const [activeStaff, setActiveStaffState] = useState<StaffUser>(getActiveStaff())
  const [modalOpen, setModalOpen] = useState(false)
  const [nameInput, setNameInput] = useState(activeStaff.name)
  const [roleInput, setRoleInput] = useState<StaffRole>(activeStaff.role)

  useEffect(() => {
    const handleStaffChange = () => {
      setActiveStaffState(getActiveStaff())
    }
    window.addEventListener('pawpos:staff_change', handleStaffChange)
    return () => window.removeEventListener('pawpos:staff_change', handleStaffChange)
  }, [])

  const handleOpenModal = () => {
    setNameInput(activeStaff.name)
    setRoleInput(activeStaff.role)
    setModalOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameInput.trim()) return
    const updated: StaffUser = {
      id: roleInput === 'owner' ? 'staff-owner' : `staff-${roleInput}-${Date.now()}`,
      name: nameInput.trim(),
      role: roleInput,
    }
    setActiveStaff(updated)
    setModalOpen(false)
  }

  const currentMeta = ROLE_DEFINITIONS[activeStaff.role] || ROLE_DEFINITIONS.owner

  return (
    <>
      <Button
        onClick={handleOpenModal}
        aria-label="Pilih operator staf kasir"
        variant="outlined"
        size="small"
        fullWidth={fullWidth}
        sx={{
          borderRadius: '8px',
          borderColor: '#e2e8f0',
          color: '#1e293b',
          bgcolor: '#ffffff',
          width: fullWidth ? '100%' : 'auto',
          justifyContent: fullWidth ? 'space-between' : 'flex-start',
          px: 1.25,
          py: 0.6,
          textTransform: 'none',
          '&:hover': {
            borderColor: '#cbd5e1',
            bgcolor: '#f8fafc',
          },
        }}
        startIcon={
          <Avatar
            sx={{
              width: 22,
              height: 22,
              fontSize: '0.75rem',
              fontWeight: 750,
              bgcolor: currentMeta.color,
              color: '#ffffff',
            }}
          >
            {activeStaff.name.charAt(0).toUpperCase()}
          </Avatar>
        }
      >
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <Typography
            variant="body2"
            noWrap
            sx={{
              fontWeight: 700,
              fontSize: '0.78rem',
              color: '#1e293b',
            }}
          >
            {activeStaff.name}
          </Typography>
          <Chip
            label={currentMeta.label}
            size="small"
            sx={{
              fontSize: '0.62rem',
              fontWeight: 800,
              height: 18,
              bgcolor: currentMeta.badgeBg,
              color: currentMeta.badgeColor,
              border: `1px solid ${currentMeta.color}33`,
              ml: 'auto',
            }}
          />
        </Stack>
      </Button>

      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        TransitionComponent={ModalSlideTransition}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          },
        }}
      >
        <form onSubmit={handleSave}>
          <DialogTitle sx={{ pb: 1, fontWeight: 800, fontSize: '1.2rem', color: '#1e293b' }}>
            Ganti Operator & Peran Staf
          </DialogTitle>
          <DialogContent sx={{ pt: 1.5 }}>
            <Stack spacing={2.5}>
              <Typography variant="body2" color="text.secondary">
                Atur identitas operator aktif yang mengoperasikan POS atau dasbor toko. Hak akses sistem akan disesuaikan otomatis dengan peran yang dipilih.
              </Typography>

              <TextField
                label="Nama Operator"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                fullWidth
                required
                size="small"
                placeholder="cth. Kasir Siti / Pak Hendra / Budi Gudang"
              />

              <TextField
                select
                label="Peran / Hak Akses (RBAC)"
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value as StaffRole)}
                fullWidth
                size="small"
              >
                <MenuItem value="owner">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <AdminPanelSettingsOutlined sx={{ fontSize: 20, color: '#2563eb' }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 750, color: '#0f172a' }}>
                        {ROLE_DEFINITIONS.owner.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ROLE_DEFINITIONS.owner.description}
                      </Typography>
                    </Box>
                  </Stack>
                </MenuItem>

                <MenuItem value="manager">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <SupervisorAccountOutlined sx={{ fontSize: 20, color: '#7c3aed' }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 750, color: '#0f172a' }}>
                        {ROLE_DEFINITIONS.manager.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ROLE_DEFINITIONS.manager.description}
                      </Typography>
                    </Box>
                  </Stack>
                </MenuItem>

                <MenuItem value="cashier">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <PointOfSaleOutlined sx={{ fontSize: 20, color: '#059669' }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 750, color: '#0f172a' }}>
                        {ROLE_DEFINITIONS.cashier.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ROLE_DEFINITIONS.cashier.description}
                      </Typography>
                    </Box>
                  </Stack>
                </MenuItem>

                <MenuItem value="warehouse">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <WarehouseOutlined sx={{ fontSize: 20, color: '#ea580c' }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 750, color: '#0f172a' }}>
                        {ROLE_DEFINITIONS.warehouse.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ROLE_DEFINITIONS.warehouse.description}
                      </Typography>
                    </Box>
                  </Stack>
                </MenuItem>
              </TextField>

              {/* Quick Select Preset Buttons for all 4 roles */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 1, letterSpacing: '0.04em' }}>
                  PILIHAN PRESET PERAN CEPAT:
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
                    gap: 1,
                  }}
                >
                  <Button
                    size="small"
                    variant={roleInput === 'owner' ? 'contained' : 'outlined'}
                    onClick={() => {
                      setNameInput('Pemilik Toko')
                      setRoleInput('owner')
                    }}
                    sx={{
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      fontWeight: 750,
                      py: 0.75,
                      textTransform: 'none',
                    }}
                  >
                    Owner Mode
                  </Button>

                  <Button
                    size="small"
                    variant={roleInput === 'manager' ? 'contained' : 'outlined'}
                    onClick={() => {
                      setNameInput('Manajer Hendra')
                      setRoleInput('manager')
                    }}
                    sx={{
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      fontWeight: 750,
                      py: 0.75,
                      textTransform: 'none',
                    }}
                  >
                    Manager Mode
                  </Button>

                  <Button
                    size="small"
                    variant={roleInput === 'cashier' ? 'contained' : 'outlined'}
                    onClick={() => {
                      setNameInput('Kasir Siti')
                      setRoleInput('cashier')
                    }}
                    sx={{
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      fontWeight: 750,
                      py: 0.75,
                      textTransform: 'none',
                    }}
                  >
                    Kasir Mode
                  </Button>

                  <Button
                    size="small"
                    variant={roleInput === 'warehouse' ? 'contained' : 'outlined'}
                    onClick={() => {
                      setNameInput('Budi Gudang')
                      setRoleInput('warehouse')
                    }}
                    sx={{
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      fontWeight: 750,
                      py: 0.75,
                      textTransform: 'none',
                    }}
                  >
                    Gudang Mode
                  </Button>
                </Box>
              </Box>
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, borderTop: '1px solid #f1f5f9' }}>
            <Button onClick={() => setModalOpen(false)} sx={{ fontWeight: 650, color: '#64748d' }}>
              Batal
            </Button>
            <Button type="submit" variant="contained" sx={{ fontWeight: 700, borderRadius: '8px', px: 2.5 }}>
              Simpan Operator
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  )
}
