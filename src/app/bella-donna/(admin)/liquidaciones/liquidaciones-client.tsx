'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { confirmSettlement, generateWeeklySettlement } from '@/features/metrics/services/metrics-actions'
import { Banknote, CheckCircle2, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

interface Settlement {
  id: string
  professional_id: string
  week_start: string
  week_end: string
  total_revenue: number
  professional_share: number
  owner_share: number
  status: string
  professional_confirmed: boolean
  owner_confirmed: boolean
  professionals: { first_name: string; last_name: string }
}

interface Props {
  settlements: Settlement[]
  isOwner: boolean
  role?: string
  currentProfessionalId: string
}

export function LiquidacionesClient({ settlements: initialSettlements, isOwner, role = 'professional', currentProfessionalId }: Props) {
  const isManager = role === 'manager'
  const [settlements, setSettlements] = useState(initialSettlements)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const formatMoney = (amount: number) => `$${Math.round(amount).toLocaleString('es-AR')}`

  async function handleGenerate() {
    setGenerating(true)
    const result = await generateWeeklySettlement()
    if (result.error) {
      alert(result.error)
    } else {
      window.location.reload()
    }
    setGenerating(false)
  }

  async function handleConfirm(settlementId: string, role: 'professional' | 'owner') {
    setLoading(true)
    const result = await confirmSettlement(settlementId, role)
    if (result.error) {
      alert(result.error)
    } else {
      setSettlements(prev =>
        prev.map(s => {
          if (s.id !== settlementId) return s
          if (role === 'professional') return { ...s, professional_confirmed: true }
          if (role === 'owner') return { ...s, owner_confirmed: true }
          return s
        }).map(s => ({
          ...s,
          status: s.professional_confirmed && s.owner_confirmed ? 'confirmed' : s.status,
        }))
      )
    }
    setLoading(false)
  }

  function getStatusBadge(settlement: Settlement) {
    if (settlement.status === 'confirmed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle2 className="h-3 w-3" /> Confirmada
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <Clock className="h-3 w-3" /> Pendiente
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Banknote className="h-8 w-8 text-bella-rose-500" />
          Liquidaciones
        </h1>

        {isOwner && (
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-bella-rose-600 hover:bg-bella-rose-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
            Generar semana anterior
          </Button>
        )}
      </div>

      {settlements.length === 0 ? (
        <div className="text-center py-16">
          <Banknote className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No hay liquidaciones todavía</p>
          {isOwner && (
            <p className="text-sm text-muted-foreground mt-1">
              Generá la liquidación de la semana anterior con el botón de arriba
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {settlements.map(settlement => {
            const prof = settlement.professionals as { first_name: string; last_name: string }
            const weekLabel = `${format(parseISO(settlement.week_start), "d 'de' MMM", { locale: es })} - ${format(parseISO(settlement.week_end), "d 'de' MMM yyyy", { locale: es })}`

            const canProfConfirm = !settlement.professional_confirmed && settlement.professional_id === currentProfessionalId
            const canOwnerConfirm = !settlement.owner_confirmed && isOwner

            return (
              <div key={settlement.id} className="mesh-gradient-card rounded-2xl border border-border/50 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold text-lg">{prof.first_name} {prof.last_name}</p>
                    <p className="text-sm text-muted-foreground">{weekLabel}</p>
                  </div>
                  {getStatusBadge(settlement)}
                </div>

                <div className={`grid ${isOwner ? 'grid-cols-3' : isManager ? 'grid-cols-1' : 'grid-cols-2'} gap-4 mb-4`}>
                  {isOwner && (
                    <div>
                      <p className="text-xs text-muted-foreground">Recaudación</p>
                      <p className="font-bold text-lg">{formatMoney(settlement.total_revenue)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">{isOwner ? 'Profesional' : isManager ? 'A pagar a profesional' : 'Tu parte'}</p>
                    <p className="font-bold text-lg text-bella-violet-600">{formatMoney(settlement.professional_share)}</p>
                  </div>
                  {isOwner && (
                    <div>
                      <p className="text-xs text-muted-foreground">Dueña</p>
                      <p className="font-bold text-lg text-bella-rose-600">{formatMoney(settlement.owner_share)}</p>
                    </div>
                  )}
                  {!isOwner && !isManager && (
                    <div>
                      <p className="text-xs text-muted-foreground">Recaudación total</p>
                      <p className="font-bold text-lg">{formatMoney(settlement.total_revenue)}</p>
                    </div>
                  )}
                </div>

                {settlement.status !== 'confirmed' && (
                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <div className="flex gap-2 text-xs">
                      <span className={`flex items-center gap-1 ${settlement.professional_confirmed ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {settlement.professional_confirmed ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        Profesional
                      </span>
                      <span className={`flex items-center gap-1 ${settlement.owner_confirmed ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {settlement.owner_confirmed ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        Dueña
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {canProfConfirm && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() => handleConfirm(settlement.id, 'professional')}
                        >
                          Confirmar como profesional
                        </Button>
                      )}
                      {canOwnerConfirm && (
                        <Button
                          size="sm"
                          disabled={loading}
                          className="bg-bella-rose-600 hover:bg-bella-rose-700"
                          onClick={() => handleConfirm(settlement.id, 'owner')}
                        >
                          Confirmar como dueña
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
