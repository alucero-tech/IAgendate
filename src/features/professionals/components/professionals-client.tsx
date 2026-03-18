'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ProfessionalForm } from '@/features/professionals/components/professional-form'
import { toggleProfessionalActive, updateProfessionalRole } from '@/features/professionals/services/professional-actions'
import { markSettlementsPaid } from '@/features/metrics/services/metrics-actions'
import { UserPlus, Users, Mail, Phone, Crown, Shield, DollarSign, AlertCircle, CheckCircle2, Pencil, Power, ChevronRight } from 'lucide-react'

interface Professional {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  commission_percentage: number
  is_owner: boolean
  role?: string
  active: boolean
}

interface PendingSettlement {
  total_pending: number
  professional_share: number
  count: number
}

interface Props {
  professionals: Professional[]
  isOwner?: boolean
  pendingSettlements?: Record<string, PendingSettlement>
}

export function ProfessionalsClient({ professionals, isOwner = false, pendingSettlements = {} }: Props) {
  const [open, setOpen] = useState(false)
  const [editProfessional, setEditProfessional] = useState<Professional | null>(null)
  const [liquidarProf, setLiquidarProf] = useState<Professional | null>(null)
  const [manualAmount, setManualAmount] = useState('')
  const [useManual, setUseManual] = useState(false)
  const [paying, setPaying] = useState(false)

  const formatMoney = (amount: number) => `$${Math.round(amount).toLocaleString('es-AR')}`

  const initials = (p: Professional) =>
    `${p.first_name[0]}${p.last_name[0]}`.toUpperCase()

  async function handleLiquidar() {
    if (!liquidarProf) return
    setPaying(true)
    const amount = useManual && manualAmount ? parseFloat(manualAmount) : undefined
    const result = await markSettlementsPaid(liquidarProf.id, amount)
    if (result.error) {
      alert(result.error)
    } else {
      setLiquidarProf(null)
      setManualAmount('')
      setUseManual(false)
    }
    setPaying(false)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 sm:h-8 sm:w-8 text-bella-rose-500 shrink-0" />
            <span className="truncate">Profesionales</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 hidden sm:block">
            Gestioná el equipo de tu negocio
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-bella-rose-600 hover:bg-bella-rose-700 shrink-0" size="sm">
              <UserPlus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Agregar profesional</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva profesional</DialogTitle>
            </DialogHeader>
            <ProfessionalForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {professionals.map(prof => {
          const pending = pendingSettlements[prof.id]
          return (
            <div
              key={prof.id}
              className="mesh-gradient-card rounded-2xl border border-border/50 p-4 sm:p-5 space-y-3"
            >
              {/* Header row */}
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  prof.is_owner
                    ? 'bg-bella-rose-100 text-bella-rose-700'
                    : prof.active
                    ? 'bg-bella-violet-100 text-bella-violet-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {initials(prof)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base flex items-center gap-1.5 truncate">
                    {prof.first_name} {prof.last_name}
                    {prof.is_owner && <Crown className="h-3.5 w-3.5 text-bella-gold-500 shrink-0" />}
                    {prof.role === 'manager' && <Shield className="h-3.5 w-3.5 text-bella-violet-500 shrink-0" />}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {prof.commission_percentage}% comisión
                  </p>
                </div>
                <Badge variant={prof.active ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                  {prof.active ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>

              {/* Contact info - compact */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 truncate">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{prof.email}</span>
                </span>
                {prof.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3 shrink-0" />
                    {prof.phone}
                  </span>
                )}
              </div>

              {/* Pending settlement - owner view */}
              {isOwner && !prof.is_owner && pending && pending.count > 0 && (
                <button
                  onClick={() => {
                    setLiquidarProf(prof)
                    setManualAmount('')
                    setUseManual(false)
                  }}
                  className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3 text-left hover:bg-amber-100 transition-colors active:scale-[0.98]"
                >
                  <div className="w-9 h-9 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                    <DollarSign className="h-4 w-4 text-amber-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="text-xs font-medium text-amber-700">
                        {pending.count} pendiente{pending.count > 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-base font-bold text-amber-900 mt-0.5">
                      A pagar: {formatMoney(pending.professional_share)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-amber-400 shrink-0" />
                </button>
              )}

              {isOwner && !prof.is_owner && (!pending || pending.count === 0) && (
                <div className="flex items-center gap-2 text-green-600 text-xs bg-green-50 rounded-xl px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Al día — sin pendientes</span>
                </div>
              )}

              {/* Actions */}
              {!prof.is_owner && (
                <div className="flex gap-2 pt-1">
                  <Dialog
                    open={editProfessional?.id === prof.id}
                    onOpenChange={(open) => !open && setEditProfessional(null)}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 text-xs"
                      onClick={() => setEditProfessional(prof)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Editar
                    </Button>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar profesional</DialogTitle>
                      </DialogHeader>
                      {editProfessional && (
                        <ProfessionalForm
                          professional={editProfessional}
                          onSuccess={() => setEditProfessional(null)}
                        />
                      )}
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => toggleProfessionalActive(prof.id, !prof.active)}
                  >
                    <Power className="h-3.5 w-3.5 mr-1.5" />
                    {prof.active ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => updateProfessionalRole(
                      prof.id,
                      prof.role === 'manager' ? 'professional' : 'manager'
                    )}
                    title={prof.role === 'manager' ? 'Quitar rol de encargada' : 'Asignar como encargada'}
                  >
                    <Shield className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {professionals.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p>No hay profesionales registradas</p>
          <p className="text-sm">Agregá la primera profesional para empezar</p>
        </div>
      )}

      {/* Liquidar Dialog */}
      <Dialog open={!!liquidarProf} onOpenChange={(open) => !open && setLiquidarProf(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              Liquidar a {liquidarProf?.first_name}
            </DialogTitle>
          </DialogHeader>
          {liquidarProf && pendingSettlements[liquidarProf.id] && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Recaudación</p>
                    <p className="font-bold text-lg">{formatMoney(pendingSettlements[liquidarProf.id].total_pending)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">A pagar ({liquidarProf.commission_percentage}%)</p>
                    <p className="font-bold text-lg text-bella-violet-600">{formatMoney(pendingSettlements[liquidarProf.id].professional_share)}</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground border-t border-gray-200 pt-2">
                  {pendingSettlements[liquidarProf.id].count} semana{pendingSettlements[liquidarProf.id].count > 1 ? 's' : ''} pendiente{pendingSettlements[liquidarProf.id].count > 1 ? 's' : ''}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useManual}
                    onChange={(e) => setUseManual(e.target.checked)}
                    className="rounded border-gray-300 text-bella-rose-600 focus:ring-bella-rose-500"
                  />
                  <span className="text-sm">Ingresar monto manual</span>
                </label>

                {useManual && (
                  <div>
                    <label className="text-xs text-muted-foreground">Monto a pagar</label>
                    <Input
                      type="number"
                      placeholder="Ej: 150000"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      className="mt-1"
                      autoFocus
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Para pagos fuera de la app que no fueron registrados
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setLiquidarProf(null)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={paying}
                  onClick={handleLiquidar}
                >
                  {paying ? 'Procesando...' : 'Confirmar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
