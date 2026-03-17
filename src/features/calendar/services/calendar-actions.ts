'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, parseISO } from 'date-fns'

export interface CalendarBooking {
  id: string
  booking_id: string
  booking_date: string
  start_time: string
  end_time: string
  status: string
  client_id: string
  client_name: string
  client_phone: string
  client_email: string
  treatment_name: string
  category_name: string
  professional_name: string
  professional_id: string
}

export interface ClientHistoryBooking {
  id: string
  booking_date: string
  start_time: string
  status: string
  treatment_name: string
  professional_name: string
  amount_total: number
}

export async function getWeekBookings(
  weekStartDate: string,
  professionalId?: string
): Promise<CalendarBooking[]> {
  const supabase = createAdminClient()

  const weekStart = startOfWeek(parseISO(weekStartDate), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(parseISO(weekStartDate), { weekStartsOn: 1 })

  const startStr = format(weekStart, 'yyyy-MM-dd')
  const endStr = format(weekEnd, 'yyyy-MM-dd')

  // Query bookings with booking_items for multi-service support
  let query = supabase
    .from('bookings')
    .select(`
      id, booking_date, start_time, end_time, status, client_id,
      clients (id, first_name, last_name, phone, email),
      treatments (name, categories (name)),
      professionals (id, first_name, last_name),
      booking_items (
        id, start_time, end_time, professional_id,
        treatments (name, categories (name)),
        professionals!booking_items_professional_id_fkey (id, first_name, last_name)
      )
    `)
    .gte('booking_date', startStr)
    .lte('booking_date', endStr)
    .in('status', ['confirmed', 'rescheduled', 'pending_payment', 'in_progress', 'completed'])
    .order('start_time')

  // For professional filter, we can't filter by booking_items.professional_id at query level,
  // so we filter after fetching
  const { data } = await query

  if (!data) return []

  const results: CalendarBooking[] = []

  for (const b of data) {
    const client = b.clients as unknown as { id: string; first_name: string; last_name: string; phone: string; email: string | null }
    const items = (b.booking_items as unknown as Array<{
      id: string; start_time: string; end_time: string; professional_id: string
      treatments: { name: string; categories: { name: string } }
      professionals: { id: string; first_name: string; last_name: string }
    }>) || []

    if (items.length > 0) {
      // Multi-service: each item is a separate calendar block
      for (const item of items) {
        if (professionalId && item.professional_id !== professionalId) continue
        results.push({
          id: `${b.id}-${item.id}`,
          booking_id: b.id,
          booking_date: b.booking_date,
          start_time: item.start_time,
          end_time: item.end_time,
          status: b.status,
          client_id: client.id,
          client_name: `${client.first_name} ${client.last_name}`,
          client_phone: client.phone || '',
          client_email: client.email || '',
          treatment_name: item.treatments.name,
          category_name: item.treatments.categories.name,
          professional_name: `${item.professionals.first_name} ${item.professionals.last_name}`,
          professional_id: item.professional_id,
        })
      }
    } else {
      // Legacy booking
      const treatment = b.treatments as unknown as { name: string; categories: { name: string } }
      const professional = b.professionals as unknown as { id: string; first_name: string; last_name: string }
      if (professionalId && professional?.id !== professionalId) continue
      if (treatment && professional) {
        results.push({
          id: b.id,
          booking_id: b.id,
          booking_date: b.booking_date,
          start_time: b.start_time,
          end_time: b.end_time,
          status: b.status,
          client_id: client.id,
          client_name: `${client.first_name} ${client.last_name}`,
          client_phone: client.phone || '',
          client_email: client.email || '',
          treatment_name: treatment.name,
          category_name: treatment.categories.name,
          professional_name: `${professional.first_name} ${professional.last_name}`,
          professional_id: professional.id,
        })
      }
    }
  }

  return results
}

export async function getDayBookings(
  date: string,
  professionalId?: string
): Promise<CalendarBooking[]> {
  return getDateRangeBookings(date, date, professionalId)
}

export async function getMonthBookings(
  monthDate: string,
  professionalId?: string
): Promise<CalendarBooking[]> {
  const monthStart = startOfMonth(parseISO(monthDate))
  const monthEnd = endOfMonth(parseISO(monthDate))
  return getDateRangeBookings(
    format(monthStart, 'yyyy-MM-dd'),
    format(monthEnd, 'yyyy-MM-dd'),
    professionalId
  )
}

async function getDateRangeBookings(
  startDate: string,
  endDate: string,
  professionalId?: string
): Promise<CalendarBooking[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('bookings')
    .select(`
      id, booking_date, start_time, end_time, status, client_id,
      clients (id, first_name, last_name, phone, email),
      treatments (name, categories (name)),
      professionals (id, first_name, last_name),
      booking_items (
        id, start_time, end_time, professional_id,
        treatments (name, categories (name)),
        professionals!booking_items_professional_id_fkey (id, first_name, last_name)
      )
    `)
    .gte('booking_date', startDate)
    .lte('booking_date', endDate)
    .in('status', ['confirmed', 'rescheduled', 'pending_payment', 'in_progress', 'completed'])
    .order('start_time')

  const { data } = await query
  if (!data) return []

  const results: CalendarBooking[] = []

  for (const b of data) {
    const client = b.clients as unknown as { id: string; first_name: string; last_name: string; phone: string; email: string | null }
    const items = (b.booking_items as unknown as Array<{
      id: string; start_time: string; end_time: string; professional_id: string
      treatments: { name: string; categories: { name: string } }
      professionals: { id: string; first_name: string; last_name: string }
    }>) || []

    if (items.length > 0) {
      for (const item of items) {
        if (professionalId && item.professional_id !== professionalId) continue
        results.push({
          id: `${b.id}-${item.id}`,
          booking_id: b.id,
          booking_date: b.booking_date,
          start_time: item.start_time,
          end_time: item.end_time,
          status: b.status,
          client_id: client.id,
          client_name: `${client.first_name} ${client.last_name}`,
          client_phone: client.phone || '',
          client_email: client.email || '',
          treatment_name: item.treatments.name,
          category_name: item.treatments.categories.name,
          professional_name: `${item.professionals.first_name} ${item.professionals.last_name}`,
          professional_id: item.professional_id,
        })
      }
    } else {
      const treatment = b.treatments as unknown as { name: string; categories: { name: string } }
      const professional = b.professionals as unknown as { id: string; first_name: string; last_name: string }
      if (professionalId && professional?.id !== professionalId) continue
      if (treatment && professional) {
        results.push({
          id: b.id,
          booking_id: b.id,
          booking_date: b.booking_date,
          start_time: b.start_time,
          end_time: b.end_time,
          status: b.status,
          client_id: client.id,
          client_name: `${client.first_name} ${client.last_name}`,
          client_phone: client.phone || '',
          client_email: client.email || '',
          treatment_name: treatment.name,
          category_name: treatment.categories.name,
          professional_name: `${professional.first_name} ${professional.last_name}`,
          professional_id: professional.id,
        })
      }
    }
  }

  return results
}

export async function getClientBookingHistory(clientId: string): Promise<ClientHistoryBooking[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('bookings')
    .select(`
      id, booking_date, start_time, status, amount_total,
      treatments (name),
      professionals (first_name, last_name)
    `)
    .eq('client_id', clientId)
    .in('status', ['confirmed', 'completed', 'rescheduled', 'in_progress', 'pending_payment'])
    .order('booking_date', { ascending: false })
    .limit(10)

  if (!data) return []

  return data.map(b => {
    const treatment = b.treatments as unknown as { name: string } | null
    const professional = b.professionals as unknown as { first_name: string; last_name: string } | null
    return {
      id: b.id,
      booking_date: b.booking_date,
      start_time: b.start_time,
      status: b.status,
      treatment_name: treatment?.name || 'Sin tratamiento',
      professional_name: professional ? `${professional.first_name} ${professional.last_name}` : '',
      amount_total: b.amount_total,
    }
  })
}

export async function getTimeBlocks(weekStartDate: string, professionalId?: string) {
  const supabase = createAdminClient()

  const weekStart = startOfWeek(parseISO(weekStartDate), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(parseISO(weekStartDate), { weekStartsOn: 1 })

  let query = supabase
    .from('time_blocks')
    .select('*, professionals (first_name, last_name)')
    .gte('block_date', format(weekStart, 'yyyy-MM-dd'))
    .lte('block_date', format(weekEnd, 'yyyy-MM-dd'))
    .eq('status', 'approved')

  if (professionalId) {
    query = query.eq('professional_id', professionalId)
  }

  const { data } = await query
  return data || []
}

export async function getActiveProfessionals() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('professionals')
    .select('id, first_name, last_name, is_owner')
    .eq('active', true)
    .order('first_name')

  return data || []
}
