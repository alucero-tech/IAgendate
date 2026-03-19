'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { addMinutes, format, parse, eachDayOfInterval, addDays, isBefore } from 'date-fns'
import { type CartItem } from './booking-helpers'
import { getProfessionalsForTreatment } from './catalog-actions'

// ========== DISPONIBILIDAD ==========

export async function getAvailableSlots(
  professionalId: string,
  treatmentId: string,
  dateStr: string
) {
  const supabase = createAdminClient()

  // 1. Obtener duración del tratamiento
  const { data: treatment } = await supabase
    .from('treatments')
    .select('duration_minutes')
    .eq('id', treatmentId)
    .single()

  if (!treatment) return []

  const duration = treatment.duration_minutes

  // 2. Obtener horario de la profesional para ese día
  // Use UTC to avoid timezone shift when parsing 'YYYY-MM-DD'
  const date = new Date(dateStr + 'T12:00:00')
  const dayOfWeek = date.getDay()

  const { data: schedule } = await supabase
    .from('schedules')
    .select('start_time, end_time')
    .eq('professional_id', professionalId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .single()

  if (!schedule) return []

  // 3. Obtener turnos ya reservados para ese día (de booking_items y bookings legacy)
  const admin = createAdminClient()
  const { data: existingItems } = await admin
    .from('booking_items')
    .select('start_time, end_time, booking_id, bookings!inner(booking_date, status)')
    .eq('professional_id', professionalId)

  const bookedSlots = (existingItems || [])
    .filter((item: Record<string, unknown>) => {
      const booking = item.bookings as unknown as { booking_date: string; status: string }
      return booking.booking_date === dateStr &&
        ['confirmed', 'rescheduled', 'pending_payment', 'in_progress'].includes(booking.status)
    })
    .map((item: Record<string, unknown>) => ({
      start_time: item.start_time as string,
      end_time: item.end_time as string,
    }))

  // Also check legacy bookings (with professional_id directly on bookings)
  const { data: legacyBookings } = await supabase
    .from('bookings')
    .select('start_time, end_time')
    .eq('professional_id', professionalId)
    .eq('booking_date', dateStr)
    .in('status', ['confirmed', 'rescheduled', 'pending_payment', 'in_progress'])

  const allBooked = [...bookedSlots, ...(legacyBookings || [])]

  // 4. Obtener bloqueos aprobados
  const { data: blocks } = await supabase
    .from('time_blocks')
    .select('start_time, end_time')
    .eq('professional_id', professionalId)
    .eq('block_date', dateStr)
    .eq('status', 'approved')

  // 5. Calcular slots disponibles cada 15 minutos
  const slots: { time: string; available: boolean }[] = []
  const schedStart = parse(schedule.start_time, 'HH:mm:ss', new Date())
  const schedEnd = parse(schedule.end_time, 'HH:mm:ss', new Date())

  // Filter past time slots if booking for today
  const today = format(new Date(), 'yyyy-MM-dd')
  const isToday = dateStr === today
  const nowTime = isToday ? format(new Date(), 'HH:mm') : null

  let current = schedStart
  while (isBefore(addMinutes(current, duration), schedEnd) || format(addMinutes(current, duration), 'HH:mm') === format(schedEnd, 'HH:mm')) {
    const slotStart = format(current, 'HH:mm')
    const slotEnd = format(addMinutes(current, duration), 'HH:mm')

    const hasConflict = allBooked.some(booking => {
      const bStart = (booking.start_time as string).substring(0, 5)
      const bEnd = (booking.end_time as string).substring(0, 5)
      return slotStart < bEnd && slotEnd > bStart
    })

    const hasBlock = (blocks || []).some(block => {
      const bStart = block.start_time.substring(0, 5)
      const bEnd = block.end_time.substring(0, 5)
      return slotStart < bEnd && slotEnd > bStart
    })

    // Block past time slots for today
    const isPast = isToday && nowTime && slotStart <= nowTime

    slots.push({
      time: slotStart,
      available: !hasConflict && !hasBlock && !isPast,
    })

    current = addMinutes(current, 15)
  }

  return slots
}

export async function getAvailableDays(professionalId: string) {
  const supabase = createAdminClient()
  const today = new Date()
  const maxDate = addDays(today, 14)

  const { data: schedules } = await supabase
    .from('schedules')
    .select('day_of_week')
    .eq('professional_id', professionalId)
    .eq('is_active', true)

  if (!schedules) return []

  const activeDays = new Set(schedules.map(s => s.day_of_week))

  const days = eachDayOfInterval({ start: today, end: maxDate })
  return days
    .filter(day => activeDays.has(day.getDay()))
    .map(day => format(day, 'yyyy-MM-dd'))
}

// ========== DISPONIBILIDAD MULTI-SERVICIO ==========

export async function getMultiServiceAvailableDays(items: CartItem[], tenantId: string) {
  // Separate fixed-professional items from "any" items
  const fixedItems = items.filter(i => i.professionalId !== 'any')
  const anyItems = items.filter(i => i.professionalId === 'any')

  // Get days for fixed professionals (intersection - ALL must be available)
  const fixedProfIds = [...new Set(fixedItems.map(i => i.professionalId))]
  const fixedDays = await Promise.all(fixedProfIds.map(id => getAvailableDays(id)))

  let commonDays: string[]
  if (fixedDays.length > 0) {
    commonDays = fixedDays[0]
    for (let i = 1; i < fixedDays.length; i++) {
      const daySet = new Set(fixedDays[i])
      commonDays = commonDays.filter(d => daySet.has(d))
    }
  } else {
    // No fixed items - start with all days in next 14 days
    const today = new Date()
    const maxDate = addDays(today, 14)
    commonDays = eachDayOfInterval({ start: today, end: maxDate })
      .map(day => format(day, 'yyyy-MM-dd'))
  }

  // For "any" items: a day is valid if AT LEAST ONE professional for that treatment is available
  for (const item of anyItems) {
    const profs = await getProfessionalsForTreatment(item.treatmentId, tenantId)
    const profDays = await Promise.all(profs.map(p => getAvailableDays(p.id)))
    // Union of all professionals' days
    const unionDays = new Set(profDays.flat())
    commonDays = commonDays.filter(d => unionDays.has(d))
  }

  return commonDays
}

export async function getMultiServiceSlots(items: CartItem[], dateStr: string, tenantId: string) {
  // Separate fixed vs "any" items
  const fixedItems = items.filter(i => i.professionalId !== 'any')
  const anyItems = items.filter(i => i.professionalId === 'any')

  // --- Get slots for fixed-professional items (same logic as before) ---
  const byProfessional: Record<string, CartItem[]> = {}
  for (const item of fixedItems) {
    if (!byProfessional[item.professionalId]) {
      byProfessional[item.professionalId] = []
    }
    byProfessional[item.professionalId].push(item)
  }

  const fixedProfIds = Object.keys(byProfessional)

  const slotsPerProfessional: Record<string, { time: string; available: boolean }[]> = {}
  for (const profId of fixedProfIds) {
    const profItems = byProfessional[profId]
    const totalDuration = profItems.reduce((sum, i) => sum + i.durationMinutes, 0)
    const firstTreatment = profItems[0]
    const allSlots = await getAvailableSlots(profId, firstTreatment.treatmentId, dateStr)

    const filteredSlots = allSlots.map(slot => {
      if (!slot.available) return slot
      const startTime = parse(slot.time, 'HH:mm', new Date())
      let allFree = true
      let check = startTime
      while (isBefore(check, addMinutes(startTime, totalDuration - 15))) {
        check = addMinutes(check, 15)
        const checkStr = format(check, 'HH:mm')
        const checkSlot = allSlots.find(s => s.time === checkStr)
        if (!checkSlot || !checkSlot.available) {
          allFree = false
          break
        }
      }
      return { time: slot.time, available: allFree }
    })

    slotsPerProfessional[profId] = filteredSlots
  }

  // --- Get slots for "any" items (union across all professionals) ---
  const anySlotsPerItem: { time: string; available: boolean }[][] = []
  for (const item of anyItems) {
    const profs = await getProfessionalsForTreatment(item.treatmentId, tenantId)
    // Get slots for each professional, then UNION (any one free = slot available)
    const profSlotsList = await Promise.all(
      profs.map(async p => {
        const slots = await getAvailableSlots(p.id, item.treatmentId, dateStr)
        // Filter for full duration fit
        return slots.map(slot => {
          if (!slot.available) return slot
          const startTime = parse(slot.time, 'HH:mm', new Date())
          let allFree = true
          let check = startTime
          while (isBefore(check, addMinutes(startTime, item.durationMinutes - 15))) {
            check = addMinutes(check, 15)
            const checkStr = format(check, 'HH:mm')
            const checkSlot = slots.find(s => s.time === checkStr)
            if (!checkSlot || !checkSlot.available) {
              allFree = false
              break
            }
          }
          return { time: slot.time, available: allFree }
        })
      })
    )

    // Union: a time is available if ANY professional has it free
    const allTimes = new Set(profSlotsList.flat().map(s => s.time))
    const unionSlots = [...allTimes].sort().map(time => ({
      time,
      available: profSlotsList.some(profSlots =>
        profSlots.find(s => s.time === time)?.available === true
      ),
    }))
    anySlotsPerItem.push(unionSlots)
  }

  // --- Combine: intersection of all fixed + all any slots ---
  const allSlotSets = [
    ...fixedProfIds.map(id => slotsPerProfessional[id]),
    ...anySlotsPerItem,
  ]

  if (allSlotSets.length === 0) return []
  if (allSlotSets.length === 1) {
    return allSlotSets[0].filter(s => s.available).map(s => ({ time: s.time, available: true }))
  }

  // Intersection: time must be available in ALL slot sets
  const firstSet = allSlotSets[0]
  const validTimes = firstSet
    .filter(s => s.available)
    .filter(slot =>
      allSlotSets.slice(1).every(slotSet => {
        const match = slotSet.find(s => s.time === slot.time)
        return match?.available
      })
    )

  return validTimes.map(s => ({ time: s.time, available: true }))
}
