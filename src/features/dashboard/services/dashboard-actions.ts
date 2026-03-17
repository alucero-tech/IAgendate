'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { format, startOfWeek, endOfWeek } from 'date-fns'

export async function getDashboardStats(professionalId: string, isOwner: boolean) {
  const supabase = createAdminClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const now = format(new Date(), 'HH:mm:ss')

  // --- Turnos hoy ---
  let todayQuery = supabase
    .from('bookings')
    .select('id, booking_items!inner(professional_id)', { count: 'exact', head: true })
    .eq('booking_date', today)
    .in('status', ['confirmed', 'rescheduled', 'in_progress', 'completed'])

  if (!isOwner) {
    todayQuery = todayQuery.eq('booking_items.professional_id', professionalId)
  }

  const { count: todayCount } = await todayQuery

  // --- Próximo turno ---
  let nextQuery = supabase
    .from('bookings')
    .select(`
      id, booking_date, start_time,
      clients (first_name, last_name),
      booking_items (professional_id)
    `)
    .in('status', ['confirmed', 'rescheduled'])
    .or(`booking_date.gt.${today},and(booking_date.eq.${today},start_time.gte.${now})`)
    .order('booking_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(5)

  const { data: nextBookings } = await nextQuery

  let nextTurn: { time: string; client: string; date: string } | null = null

  if (nextBookings && nextBookings.length > 0) {
    // Filter by professional if not owner
    const filtered = isOwner
      ? nextBookings
      : nextBookings.filter(b => {
          const items = (b.booking_items as unknown as Array<{ professional_id: string }>) || []
          return items.some(i => i.professional_id === professionalId)
        })

    if (filtered.length > 0) {
      const next = filtered[0]
      const client = next.clients as unknown as { first_name: string; last_name: string }
      nextTurn = {
        time: next.start_time.slice(0, 5),
        client: `${client.first_name} ${client.last_name}`,
        date: next.booking_date,
      }
    }
  }

  // --- Owner-only stats ---
  let professionalCount = 0
  let weeklyRevenue = 0

  if (isOwner) {
    // Active professionals
    const { count: profCount } = await supabase
      .from('professionals')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)

    professionalCount = profCount || 0

    // Weekly revenue
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

    const { data: weekBookings } = await supabase
      .from('bookings')
      .select('amount_total')
      .gte('booking_date', weekStart)
      .lte('booking_date', weekEnd)
      .in('status', ['confirmed', 'rescheduled', 'in_progress', 'completed'])

    weeklyRevenue = (weekBookings || []).reduce((sum, b) => sum + (b.amount_total || 0), 0)
  }

  return {
    todayCount: todayCount || 0,
    nextTurn,
    professionalCount,
    weeklyRevenue,
  }
}
