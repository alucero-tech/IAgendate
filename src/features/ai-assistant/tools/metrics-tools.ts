import { tool } from 'ai'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns'

export const queryRevenue = tool({
  description: 'Consulta ingresos del negocio para un período específico. Devuelve totales, por profesional y por tratamiento.',
  inputSchema: z.object({
    period: z.enum(['this_week', 'last_week', 'this_month', 'last_month']).describe('Período a consultar'),
  }),
  execute: async ({ period }) => {
    const supabase = createAdminClient()
    const now = new Date()

    let startDate: Date
    let endDate: Date

    switch (period) {
      case 'this_week':
        startDate = startOfWeek(now, { weekStartsOn: 1 })
        endDate = endOfWeek(now, { weekStartsOn: 1 })
        break
      case 'last_week':
        startDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
        endDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
        break
      case 'this_month':
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        break
      case 'last_month':
        startDate = startOfMonth(subMonths(now, 1))
        endDate = endOfMonth(subMonths(now, 1))
        break
    }

    const { data: bookings } = await supabase
      .from('bookings')
      .select(`
        id, amount_total, status,
        booking_items (
          price, professional_id,
          professionals!booking_items_professional_id_fkey (first_name, last_name, commission_percentage),
          treatments (name, categories (name))
        )
      `)
      .gte('booking_date', format(startDate, 'yyyy-MM-dd'))
      .lte('booking_date', format(endDate, 'yyyy-MM-dd'))
      .in('status', ['confirmed', 'rescheduled', 'completed'])

    if (!bookings || bookings.length === 0) {
      return { period, totalRevenue: 0, totalBookings: 0, byProfessional: [], byTreatment: [] }
    }

    const profMap = new Map<string, { name: string; revenue: number; count: number; commission: number }>()
    const treatMap = new Map<string, { category: string; revenue: number; count: number }>()

    for (const b of bookings) {
      const items = (b.booking_items as unknown as Array<{
        price: number
        professional_id: string
        professionals: { first_name: string; last_name: string; commission_percentage: number }
        treatments: { name: string; categories: { name: string } }
      }>) || []

      for (const item of items) {
        const profKey = item.professional_id
        const prof = profMap.get(profKey) || {
          name: `${item.professionals.first_name} ${item.professionals.last_name}`,
          revenue: 0,
          count: 0,
          commission: item.professionals.commission_percentage,
        }
        prof.revenue += item.price
        prof.count += 1
        profMap.set(profKey, prof)

        const treatKey = item.treatments.name
        const treat = treatMap.get(treatKey) || {
          category: item.treatments.categories.name,
          revenue: 0,
          count: 0,
        }
        treat.revenue += item.price
        treat.count += 1
        treatMap.set(treatKey, treat)
      }
    }

    const byProfessional = Array.from(profMap.entries()).map(([, v]) => ({
      name: v.name,
      revenue: v.revenue,
      bookings: v.count,
      commissionPercent: v.commission,
      professionalShare: Math.round(v.revenue * v.commission / 100),
      ownerShare: Math.round(v.revenue * (100 - v.commission) / 100),
    })).sort((a, b) => b.revenue - a.revenue)

    const byTreatment = Array.from(treatMap.entries()).map(([name, v]) => ({
      name,
      category: v.category,
      revenue: v.revenue,
      bookings: v.count,
    })).sort((a, b) => b.revenue - a.revenue)

    const totalRevenue = byProfessional.reduce((sum, p) => sum + p.revenue, 0)
    const ownerTotal = byProfessional.reduce((sum, p) => sum + p.ownerShare, 0)

    return {
      period,
      periodLabel: period === 'this_week' ? 'esta semana' : period === 'last_week' ? 'semana pasada' : period === 'this_month' ? 'este mes' : 'mes pasado',
      totalRevenue,
      ownerShare: ownerTotal,
      totalBookings: bookings.length,
      byProfessional,
      byTreatment,
    }
  },
})

export const queryTodayBookings = tool({
  description: 'Consulta los turnos de hoy con detalles de cliente, servicio y profesional.',
  inputSchema: z.object({}),
  execute: async () => {
    const supabase = createAdminClient()
    const today = format(new Date(), 'yyyy-MM-dd')

    const { data: bookings } = await supabase
      .from('bookings')
      .select(`
        id, booking_date, start_time, end_time, status, amount_total,
        clients (first_name, last_name, phone),
        booking_items (
          start_time, end_time, price,
          treatments (name),
          professionals!booking_items_professional_id_fkey (first_name, last_name)
        )
      `)
      .eq('booking_date', today)
      .in('status', ['confirmed', 'rescheduled', 'pending_payment', 'in_progress', 'completed'])
      .order('start_time')

    if (!bookings || bookings.length === 0) {
      return { date: today, bookings: [], totalBookings: 0, message: 'No hay turnos para hoy.' }
    }

    const formatted = bookings.map(b => {
      const client = b.clients as unknown as { first_name: string; last_name: string; phone: string }
      const items = (b.booking_items as unknown as Array<{
        start_time: string
        end_time: string
        price: number
        treatments: { name: string }
        professionals: { first_name: string; last_name: string }
      }>) || []

      return {
        startTime: b.start_time,
        endTime: b.end_time,
        status: b.status,
        total: b.amount_total,
        clientName: client ? `${client.first_name} ${client.last_name}` : 'Sin cliente',
        services: items.map(i => ({
          name: i.treatments?.name || 'Servicio',
          professional: i.professionals ? `${i.professionals.first_name} ${i.professionals.last_name}` : '',
          price: i.price,
        })),
      }
    })

    const byStatus = {
      confirmed: formatted.filter(b => ['confirmed', 'rescheduled'].includes(b.status)).length,
      inProgress: formatted.filter(b => b.status === 'in_progress').length,
      completed: formatted.filter(b => b.status === 'completed').length,
      pendingPayment: formatted.filter(b => b.status === 'pending_payment').length,
    }

    return {
      date: today,
      bookings: formatted,
      totalBookings: formatted.length,
      byStatus,
      expectedRevenue: formatted.reduce((sum, b) => sum + b.total, 0),
    }
  },
})

export const queryBookingStats = tool({
  description: 'Obtiene estadísticas generales: cancelaciones, no-shows, tasa de ocupación.',
  inputSchema: z.object({
    period: z.enum(['this_week', 'this_month']).describe('Período a consultar'),
  }),
  execute: async ({ period }) => {
    const supabase = createAdminClient()
    const now = new Date()

    const startDate = period === 'this_week'
      ? startOfWeek(now, { weekStartsOn: 1 })
      : startOfMonth(now)
    const endDate = period === 'this_week'
      ? endOfWeek(now, { weekStartsOn: 1 })
      : endOfMonth(now)

    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, status')
      .gte('booking_date', format(startDate, 'yyyy-MM-dd'))
      .lte('booking_date', format(endDate, 'yyyy-MM-dd'))

    if (!bookings) return { totalBookings: 0 }

    const total = bookings.length
    const completed = bookings.filter(b => b.status === 'completed').length
    const cancelled = bookings.filter(b => b.status === 'cancelled').length
    const noShow = bookings.filter(b => b.status === 'no_show').length
    const active = bookings.filter(b => ['confirmed', 'rescheduled', 'in_progress'].includes(b.status)).length

    return {
      period: period === 'this_week' ? 'esta semana' : 'este mes',
      totalBookings: total,
      completed,
      cancelled,
      noShow,
      active,
      cancellationRate: total > 0 ? `${Math.round(cancelled / total * 100)}%` : '0%',
      noShowRate: total > 0 ? `${Math.round(noShow / total * 100)}%` : '0%',
      completionRate: total > 0 ? `${Math.round(completed / total * 100)}%` : '0%',
    }
  },
})

export const metricsTools = {
  queryRevenue,
  queryTodayBookings,
  queryBookingStats,
}
