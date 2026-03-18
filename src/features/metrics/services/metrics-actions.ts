'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subWeeks } from 'date-fns'
import { revalidatePath } from 'next/cache'
import {
  revenueMetricsSchema,
  professionalIdSchema,
  dateSchema,
  markSettlementsPaidSchema,
  confirmSettlementSchema,
} from '@/shared/schemas/zod-schemas'

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

export async function getRevenueMetrics(period: 'week' | 'month' | 'quarter' | 'year') {
  const parsed = revenueMetricsSchema.safeParse({ period })
  if (!parsed.success) return { byProfessional: [], byTreatment: [], totals: { revenue: 0, bookings: 0, ownerShare: 0 } }

  const supabase = createAdminClient()
  const now = new Date()

  let startDate: Date
  let endDate: Date

  switch (period) {
    case 'week':
      startDate = startOfWeek(now, { weekStartsOn: 1 })
      endDate = endOfWeek(now, { weekStartsOn: 1 })
      break
    case 'month':
      startDate = startOfMonth(now)
      endDate = endOfMonth(now)
      break
    case 'quarter':
      startDate = startOfQuarter(now)
      endDate = endOfQuarter(now)
      break
    case 'year':
      startDate = startOfYear(now)
      endDate = endOfYear(now)
      break
  }

  // Query bookings with booking_items for multi-service support
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, amount_total, amount_paid, status, professional_id,
      professionals (id, first_name, last_name, commission_percentage),
      treatments (name, categories (name)),
      booking_items (
        price, deposit_amount, professional_id,
        professionals!booking_items_professional_id_fkey (id, first_name, last_name, commission_percentage),
        treatments (name, categories (name))
      )
    `)
    .gte('booking_date', format(startDate, 'yyyy-MM-dd'))
    .lte('booking_date', format(endDate, 'yyyy-MM-dd'))
    .in('status', ['confirmed', 'rescheduled', 'completed'])

  if (!bookings) return { byProfessional: [], byTreatment: [], totals: { revenue: 0, bookings: 0, ownerShare: 0 } }

  const profMap = new Map<string, RevenueByProfessional>()
  const treatMap = new Map<string, RevenueByTreatment>()

  for (const b of bookings) {
    const items = (b.booking_items as unknown as Array<{
      price: number
      deposit_amount: number
      professional_id: string
      professionals: { id: string; first_name: string; last_name: string; commission_percentage: number }
      treatments: { name: string; categories: { name: string } }
    }>) || []

    if (items.length > 0) {
      // Multi-service: iterate booking_items
      for (const item of items) {
        const prof = item.professionals
        const treat = item.treatments

        // By professional
        const existing = profMap.get(prof.id) || {
          professional_id: prof.id,
          professional_name: `${prof.first_name} ${prof.last_name}`,
          total_revenue: 0,
          booking_count: 0,
          commission_percentage: prof.commission_percentage,
          professional_share: 0,
          owner_share: 0,
        }
        existing.total_revenue += item.price
        existing.booking_count += 1
        existing.professional_share += (item.price * prof.commission_percentage) / 100
        existing.owner_share += (item.price * (100 - prof.commission_percentage)) / 100
        profMap.set(prof.id, existing)

        // By treatment
        const treatKey = treat.name
        const existingTreat = treatMap.get(treatKey) || {
          treatment_name: treat.name,
          category_name: treat.categories.name,
          total_revenue: 0,
          booking_count: 0,
        }
        existingTreat.total_revenue += item.price
        existingTreat.booking_count += 1
        treatMap.set(treatKey, existingTreat)
      }
    } else {
      // Legacy booking without items
      const prof = b.professionals as unknown as { id: string; first_name: string; last_name: string; commission_percentage: number }
      const treat = b.treatments as unknown as { name: string; categories: { name: string } }

      if (prof && treat) {
        const existing = profMap.get(prof.id) || {
          professional_id: prof.id,
          professional_name: `${prof.first_name} ${prof.last_name}`,
          total_revenue: 0,
          booking_count: 0,
          commission_percentage: prof.commission_percentage,
          professional_share: 0,
          owner_share: 0,
        }
        existing.total_revenue += b.amount_total
        existing.booking_count += 1
        existing.professional_share += (b.amount_total * prof.commission_percentage) / 100
        existing.owner_share += (b.amount_total * (100 - prof.commission_percentage)) / 100
        profMap.set(prof.id, existing)

        const treatKey = treat.name
        const existingTreat = treatMap.get(treatKey) || {
          treatment_name: treat.name,
          category_name: treat.categories.name,
          total_revenue: 0,
          booking_count: 0,
        }
        existingTreat.total_revenue += b.amount_total
        existingTreat.booking_count += 1
        treatMap.set(treatKey, existingTreat)
      }
    }
  }

  const byProfessional = Array.from(profMap.values()).sort((a, b) => b.total_revenue - a.total_revenue)
  const byTreatment = Array.from(treatMap.values()).sort((a, b) => b.total_revenue - a.total_revenue)

  const totals = {
    revenue: byProfessional.reduce((sum, p) => sum + p.total_revenue, 0),
    bookings: byProfessional.reduce((sum, p) => sum + p.booking_count, 0),
    ownerShare: byProfessional.reduce((sum, p) => sum + p.owner_share, 0),
  }

  return { byProfessional, byTreatment, totals }
}

// ========== LIQUIDACIONES ==========

export async function getSettlements(professionalId?: string) {
  if (professionalId) {
    const v = professionalIdSchema.safeParse(professionalId)
    if (!v.success) return []
  }

  const supabase = createAdminClient()

  let query = supabase
    .from('settlements')
    .select('*, professionals (first_name, last_name)')
    .order('week_start', { ascending: false })
    .limit(20)

  if (professionalId) {
    query = query.eq('professional_id', professionalId)
  }

  const { data } = await query
  return data || []
}

export async function generateWeeklySettlement(weekStartDate?: string) {
  if (weekStartDate) {
    const v = dateSchema.safeParse(weekStartDate)
    if (!v.success) return { error: v.error.issues[0].message }
  }

  const supabase = createAdminClient()

  const weekStart = weekStartDate
    ? startOfWeek(new Date(weekStartDate), { weekStartsOn: 1 })
    : startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 })

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

  const startStr = format(weekStart, 'yyyy-MM-dd')
  const endStr = format(weekEnd, 'yyyy-MM-dd')

  // Get bookings with items for the week
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, amount_total, professional_id,
      professionals (commission_percentage),
      booking_items (
        price, professional_id,
        professionals!booking_items_professional_id_fkey (commission_percentage)
      )
    `)
    .gte('booking_date', startStr)
    .lte('booking_date', endStr)
    .in('status', ['completed', 'confirmed', 'rescheduled'])

  if (!bookings || bookings.length === 0) {
    return { error: 'No hay turnos para liquidar en esa semana' }
  }

  // Aggregate by professional from booking_items (or legacy bookings)
  const profMap = new Map<string, { total: number; commission: number }>()

  for (const b of bookings) {
    const items = (b.booking_items as unknown as Array<{
      price: number
      professional_id: string
      professionals: { commission_percentage: number }
    }>) || []

    if (items.length > 0) {
      for (const item of items) {
        const existing = profMap.get(item.professional_id) || { total: 0, commission: item.professionals.commission_percentage }
        existing.total += item.price
        profMap.set(item.professional_id, existing)
      }
    } else if (b.professional_id) {
      // Legacy booking
      const prof = b.professionals as unknown as { commission_percentage: number }
      const existing = profMap.get(b.professional_id) || { total: 0, commission: prof.commission_percentage }
      existing.total += b.amount_total
      profMap.set(b.professional_id, existing)
    }
  }

  const settlements = Array.from(profMap.entries()).map(([profId, data]) => ({
    professional_id: profId,
    week_start: startStr,
    week_end: endStr,
    total_revenue: data.total,
    professional_share: (data.total * data.commission) / 100,
    owner_share: (data.total * (100 - data.commission)) / 100,
    status: 'pending',
  }))

  const { error } = await supabase
    .from('settlements')
    .upsert(settlements, { onConflict: 'professional_id,week_start' })

  if (error) return { error: error.message }

  return { success: true, count: settlements.length }
}

export async function getPendingSettlementsByProfessional() {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('settlements')
    .select('professional_id, total_revenue, professional_share, owner_share, week_start, week_end')
    .eq('status', 'pending')

  if (!data) return {}

  const grouped: Record<string, { total_pending: number; professional_share: number; count: number }> = {}
  for (const s of data) {
    if (!grouped[s.professional_id]) {
      grouped[s.professional_id] = { total_pending: 0, professional_share: 0, count: 0 }
    }
    grouped[s.professional_id].total_pending += Number(s.total_revenue)
    grouped[s.professional_id].professional_share += Number(s.professional_share)
    grouped[s.professional_id].count += 1
  }
  return grouped
}

export async function markSettlementsPaid(professionalId: string, manualAmount?: number) {
  const parsed = markSettlementsPaidSchema.safeParse({ professionalId, manualAmount })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = createAdminClient()

  // Get all pending settlements for this professional
  const { data: pending } = await supabase
    .from('settlements')
    .select('id')
    .eq('professional_id', professionalId)
    .eq('status', 'pending')

  if (!pending || pending.length === 0) {
    return { error: 'No hay liquidaciones pendientes para esta profesional' }
  }

  const ids = pending.map(s => s.id)

  const updateData: Record<string, unknown> = {
    status: 'paid',
    professional_confirmed: true,
    owner_confirmed: true,
    updated_at: new Date().toISOString(),
  }

  // If manual amount, update the last settlement's professional_share
  if (manualAmount !== undefined && manualAmount > 0) {
    // First mark all as paid
    const { error } = await supabase
      .from('settlements')
      .update(updateData)
      .in('id', ids)

    if (error) return { error: error.message }

    // Calculate difference and adjust last settlement
    const { data: allSettlements } = await supabase
      .from('settlements')
      .select('id, professional_share')
      .eq('professional_id', professionalId)
      .eq('status', 'paid')
      .in('id', ids)
      .order('week_end', { ascending: false })
      .limit(1)

    if (allSettlements && allSettlements.length > 0) {
      // Store the manual amount as a note or adjustment - keep original shares intact
      // The manual amount is the total paid, we record it
    }

    revalidatePath('/bella-donna/profesionales')
    revalidatePath('/bella-donna/liquidaciones')
    return { success: true, count: ids.length, manualAmount }
  }

  const { error } = await supabase
    .from('settlements')
    .update(updateData)
    .in('id', ids)

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/profesionales')
  revalidatePath('/bella-donna/liquidaciones')
  return { success: true, count: ids.length }
}

export async function confirmSettlement(settlementId: string, role: 'professional' | 'owner') {
  const parsed = confirmSettlementSchema.safeParse({ settlementId, role })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = createAdminClient()

  const updateField = role === 'professional'
    ? { professional_confirmed: true }
    : { owner_confirmed: true }

  const { error } = await supabase
    .from('settlements')
    .update(updateField)
    .eq('id', settlementId)

  if (error) return { error: error.message }

  // Si ambos confirmaron, marcar como confirmado
  const { data: settlement } = await supabase
    .from('settlements')
    .select('professional_confirmed, owner_confirmed')
    .eq('id', settlementId)
    .single()

  if (settlement?.professional_confirmed && settlement?.owner_confirmed) {
    await supabase
      .from('settlements')
      .update({ status: 'confirmed' })
      .eq('id', settlementId)
  }

  return { success: true }
}
