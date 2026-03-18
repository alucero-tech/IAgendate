'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getRevenueMetrics } from '@/features/metrics/services/metrics-actions'
import { BarChart3, DollarSign, Users, Scissors, TrendingUp } from 'lucide-react'
import { MetricsChat } from '@/features/ai-assistant/components/metrics-chat'

interface RevenueByProfessional {
  professional_id: string
  professional_name: string
  total_revenue: number
  booking_count: number
  commission_percentage: number
  professional_share: number
  owner_share: number
}

interface RevenueByTreatment {
  treatment_name: string
  category_name: string
  total_revenue: number
  booking_count: number
}

interface MetricsData {
  byProfessional: RevenueByProfessional[]
  byTreatment: RevenueByTreatment[]
  totals: { revenue: number; bookings: number; ownerShare: number }
}

export function MetricsClient({ initialData }: { initialData: MetricsData }) {
  const [data, setData] = useState(initialData)
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('week')
  const [loading, setLoading] = useState(false)

  async function changePeriod(newPeriod: 'week' | 'month' | 'quarter' | 'year') {
    setPeriod(newPeriod)
    setLoading(true)
    const newData = await getRevenueMetrics(newPeriod)
    setData(newData)
    setLoading(false)
  }

  const formatMoney = (amount: number) => `$${Math.round(amount).toLocaleString('es-AR')}`

  return (
    <div className={`space-y-6 ${loading ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-bella-rose-500" />
          Métricas
        </h1>

        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(['week', 'month', 'quarter', 'year'] as const).map(p => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'ghost'}
              size="sm"
              onClick={() => changePeriod(p)}
              className={period === p ? 'bg-bella-rose-600 hover:bg-bella-rose-700' : ''}
            >
              {{ week: 'Semana', month: 'Mes', quarter: 'Trimestre', year: 'Año' }[p]}
            </Button>
          ))}
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="mesh-gradient-card rounded-2xl border border-border/50 p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">Recaudación total</p>
            <DollarSign className="h-5 w-5 text-bella-rose-500" />
          </div>
          <p className="text-3xl font-bold">{formatMoney(data.totals.revenue)}</p>
        </div>
        <div className="mesh-gradient-card rounded-2xl border border-border/50 p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">Ganancia dueña</p>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-green-600">{formatMoney(data.totals.ownerShare)}</p>
        </div>
        <div className="mesh-gradient-card rounded-2xl border border-border/50 p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">Turnos completados</p>
            <Scissors className="h-5 w-5 text-bella-violet-500" />
          </div>
          <p className="text-3xl font-bold">{data.totals.bookings}</p>
        </div>
      </div>

      <Tabs defaultValue="profesionales">
        <TabsList>
          <TabsTrigger value="profesionales">
            <Users className="h-4 w-4 mr-1" /> Por profesional
          </TabsTrigger>
          <TabsTrigger value="tratamientos">
            <Scissors className="h-4 w-4 mr-1" /> Por tratamiento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profesionales" className="mt-4 space-y-3">
          {data.byProfessional.map(prof => {
            const maxRevenue = data.byProfessional[0]?.total_revenue || 1
            const barWidth = (prof.total_revenue / maxRevenue) * 100

            return (
              <div key={prof.professional_id} className="rounded-xl border border-border/50 bg-white/80 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold">{prof.professional_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {prof.booking_count} turnos · Comisión: {prof.commission_percentage}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatMoney(prof.total_revenue)}</p>
                    <p className="text-xs text-muted-foreground">
                      Prof: {formatMoney(prof.professional_share)} · Dueña: {formatMoney(prof.owner_share)}
                    </p>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-bella-rose-500 h-2 rounded-full transition-all"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            )
          })}
          {data.byProfessional.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No hay datos para este período</p>
          )}
        </TabsContent>

        <TabsContent value="tratamientos" className="mt-4 space-y-3">
          {data.byTreatment.map(treat => {
            const maxRevenue = data.byTreatment[0]?.total_revenue || 1
            const barWidth = (treat.total_revenue / maxRevenue) * 100

            return (
              <div key={treat.treatment_name} className="rounded-xl border border-border/50 bg-white/80 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold">{treat.treatment_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {treat.category_name} · {treat.booking_count} turnos
                    </p>
                  </div>
                  <p className="font-bold">{formatMoney(treat.total_revenue)}</p>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-bella-violet-500 h-2 rounded-full transition-all"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            )
          })}
          {data.byTreatment.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No hay datos para este período</p>
          )}
        </TabsContent>
      </Tabs>

      {/* AI Metrics Chat */}
      <MetricsChat />
    </div>
  )
}
