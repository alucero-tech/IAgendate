'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { addMinutes, format, parse, eachDayOfInterval, addDays, isBefore } from 'date-fns'
import { notifyProfessional, notifyOwner, notifyClient } from '@/features/notifications/services/push-service'

// ========== DEPÓSITO CONFIGURABLE ==========

export async function getDepositPercentage(): Promise<number> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('store_settings')
    .select('value')
    .eq('key', 'deposit_percentage')
    .single()
  const pct = parseInt(data?.value || '50', 10)
  if (isNaN(pct) || pct < 10 || pct > 90) return 50
  return pct
}

// Helper (not exported as server action — use inline)
function calcDepositAmount(price: number, percentage: number): number {
  return Math.ceil(price * percentage / 100)
}

// ========== QUERIES PÚBLICAS (sin auth) ==========

export async function getPublicCategories() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, description')
    .eq('active', true)
    .order('display_order')

  return data || []
}

export async function getAllTreatmentsGrouped() {
  const supabase = createAdminClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, description')
    .eq('active', true)
    .order('display_order')

  if (!categories) return []

  const { data: treatments } = await supabase
    .from('treatments')
    .select('id, name, description, duration_minutes, price, category_id')
    .eq('active', true)
    .order('name')

  return (categories || []).map(cat => ({
    ...cat,
    treatments: (treatments || []).filter(t => t.category_id === cat.id),
  }))
}

export async function getTreatmentsByCategory(categoryId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('treatments')
    .select('id, name, description, duration_minutes, price, category_id')
    .eq('category_id', categoryId)
    .eq('active', true)
    .order('name')

  return data || []
}

export async function getProfessionalsForTreatment(treatmentId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('professional_treatments')
    .select(`
      professional_id,
      professionals (id, first_name, last_name, active)
    `)
    .eq('treatment_id', treatmentId)

  if (!data) return []

  const professionals: { id: string; first_name: string; last_name: string }[] = []
  for (const pt of data) {
    const p = pt.professionals as unknown as { id: string; first_name: string; last_name: string; active: boolean } | null
    if (p && p.active) {
      professionals.push({ id: p.id, first_name: p.first_name, last_name: p.last_name })
    }
  }
  return professionals
}

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

interface CartItem {
  treatmentId: string
  treatmentName: string
  professionalId: string
  professionalName: string
  durationMinutes: number
  price: number
}

export async function getMultiServiceAvailableDays(items: CartItem[]) {
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
    const profs = await getProfessionalsForTreatment(item.treatmentId)
    const profDays = await Promise.all(profs.map(p => getAvailableDays(p.id)))
    // Union of all professionals' days
    const unionDays = new Set(profDays.flat())
    commonDays = commonDays.filter(d => unionDays.has(d))
  }

  return commonDays
}

export async function getMultiServiceSlots(items: CartItem[], dateStr: string) {
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
    const profs = await getProfessionalsForTreatment(item.treatmentId)
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

// ========== CREAR RESERVA MULTI-SERVICIO ==========

const multiBookingSchema = z.object({
  firstName: z.string().min(2, 'Nombre requerido'),
  lastName: z.string().min(2, 'Apellido requerido'),
  phone: z.string().regex(/^\d{10}$/, 'El celular debe tener 10 dígitos (ej: 1122334455)'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  paymentMethod: z.enum(['mercadopago', 'transfer']),
  items: z.array(z.object({
    treatmentId: z.string().uuid(),
    professionalId: z.string(), // can be UUID or 'any'
    durationMinutes: z.number(),
    price: z.number(),
  })).min(1, 'Seleccioná al menos un servicio'),
})

export async function createMultiBooking(input: {
  firstName: string
  lastName: string
  phone: string
  email: string
  date: string
  startTime: string
  paymentMethod: 'mercadopago' | 'transfer'
  items: { treatmentId: string; professionalId: string; durationMinutes: number; price: number }[]
}) {
  const parsed = multiBookingSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Validate future date
  const today = format(new Date(), 'yyyy-MM-dd')
  if (parsed.data.date < today) {
    return { error: 'No se puede reservar en una fecha pasada.' }
  }

  const supabase = createAdminClient()
  const depositPct = await getDepositPercentage()

  // 1. Create or find client by phone
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('phone', parsed.data.phone)
    .single()

  let clientId: string

  if (existingClient) {
    clientId = existingClient.id
    await supabase.from('clients').update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email || null,
    }).eq('id', clientId)
  } else {
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
      })
      .select('id')
      .single()

    if (clientError || !newClient) {
      return { error: 'Error al registrar tus datos. Intentá de nuevo.' }
    }
    clientId = newClient.id
  }

  // 2. Resolve "any" professional assignments
  const resolvedItems = [...parsed.data.items]
  for (let i = 0; i < resolvedItems.length; i++) {
    if (resolvedItems[i].professionalId === 'any') {
      const profs = await getProfessionalsForTreatment(resolvedItems[i].treatmentId)
      // Find first professional with a free slot at the requested time
      let assigned = false
      for (const prof of profs) {
        const slots = await getAvailableSlots(prof.id, resolvedItems[i].treatmentId, parsed.data.date)
        const matchingSlot = slots.find(s => s.time === parsed.data.startTime && s.available)
        if (matchingSlot) {
          resolvedItems[i] = { ...resolvedItems[i], professionalId: prof.id }
          assigned = true
          break
        }
      }
      if (!assigned) {
        return { error: 'No hay profesional disponible para ese horario. Probá otro horario.' }
      }
    }
  }

  // 3. Calculate times for each item
  // Group by professional - same professional items are consecutive
  const byProfessional: Record<string, typeof resolvedItems> = {}
  for (const item of resolvedItems) {
    if (!byProfessional[item.professionalId]) {
      byProfessional[item.professionalId] = []
    }
    byProfessional[item.professionalId].push(item)
  }

  // Assign start/end times: all professionals start at the same time
  // Each professional's items are consecutive
  const itemsWithTimes: {
    treatmentId: string
    professionalId: string
    startTime: string
    endTime: string
    price: number
    depositAmount: number
  }[] = []

  for (const profItems of Object.values(byProfessional)) {
    let currentStart = parse(parsed.data.startTime, 'HH:mm', new Date())

    for (const item of profItems) {
      const endTime = addMinutes(currentStart, item.durationMinutes)
      itemsWithTimes.push({
        treatmentId: item.treatmentId,
        professionalId: item.professionalId,
        startTime: format(currentStart, 'HH:mm'),
        endTime: format(endTime, 'HH:mm'),
        price: item.price,
        depositAmount: calcDepositAmount(item.price, depositPct),
      })
      currentStart = endTime
    }
  }

  // 4. Calculate totals
  const totalAmount = itemsWithTimes.reduce((sum, i) => sum + i.price, 0)
  const totalDeposit = itemsWithTimes.reduce((sum, i) => sum + i.depositAmount, 0)

  // Global start/end time (earliest start to latest end)
  const allStartTimes = itemsWithTimes.map(i => i.startTime).sort()
  const allEndTimes = itemsWithTimes.map(i => i.endTime).sort()
  const globalStart = allStartTimes[0]
  const globalEnd = allEndTimes[allEndTimes.length - 1]

  // 5. Create booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      client_id: clientId,
      professional_id: null,
      treatment_id: null,
      booking_date: parsed.data.date,
      start_time: globalStart,
      end_time: globalEnd,
      status: 'pending_payment',
      amount_total: totalAmount,
      amount_paid: 0,
    })
    .select('id')
    .single()

  if (bookingError || !booking) {
    return { error: 'Error al crear la reserva. Intentá de nuevo.' }
  }

  // 6. Create booking items
  const { error: itemsError } = await supabase
    .from('booking_items')
    .insert(
      itemsWithTimes.map(item => ({
        booking_id: booking.id,
        treatment_id: item.treatmentId,
        professional_id: item.professionalId,
        start_time: item.startTime,
        end_time: item.endTime,
        price: item.price,
        deposit_amount: item.depositAmount,
      }))
    )

  if (itemsError) {
    // Rollback booking
    await supabase.from('bookings').delete().eq('id', booking.id)
    return { error: 'Error al crear los servicios. Intentá de nuevo.' }
  }

  // 7. Create payment record
  await supabase.from('payments').insert({
    booking_id: booking.id,
    amount: totalDeposit,
    method: parsed.data.paymentMethod,
    status: 'pending',
  })

  // 8. Push notifications to assigned professionals + owner
  const clientName = `${parsed.data.firstName} ${parsed.data.lastName}`
  const notifiedProfs = new Set<string>()
  for (const item of itemsWithTimes) {
    if (!notifiedProfs.has(item.professionalId)) {
      notifiedProfs.add(item.professionalId)
      notifyProfessional(item.professionalId, {
        title: 'Nueva reserva',
        body: `${clientName} reservó para el ${parsed.data.date} a las ${globalStart}hs`,
        url: '/bella-donna/turnos',
        tag: `booking-${booking.id}`,
      }).catch(() => {}) // fire and forget
    }
  }
  notifyOwner({
    title: 'Nueva reserva',
    body: `${clientName} · ${parsed.data.date} ${globalStart}hs · ${parsed.data.paymentMethod === 'transfer' ? 'Transferencia (pendiente)' : 'Mercado Pago'}`,
    url: '/bella-donna/turnos',
    tag: `booking-${booking.id}`,
  }).catch(() => {})

  return {
    success: true,
    bookingId: booking.id,
    depositAmount: totalDeposit,
    paymentMethod: parsed.data.paymentMethod,
  }
}

// ========== GESTIÓN DE TURNOS (admin) ==========

export async function confirmTransferPayment(bookingId: string) {
  const supabase = createAdminClient()

  const { error: payError } = await supabase
    .from('payments')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('booking_id', bookingId)
    .eq('status', 'pending')

  if (payError) return { error: payError.message }

  const { data: payment } = await supabase
    .from('payments')
    .select('amount')
    .eq('booking_id', bookingId)
    .single()

  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      amount_paid: payment?.amount || 0,
    })
    .eq('id', bookingId)

  if (error) return { error: error.message }

  // Notify professionals about confirmed payment
  const { data: bk } = await supabase
    .from('bookings')
    .select('booking_items (professional_id)')
    .eq('id', bookingId)
    .single()
  const profIds = [...new Set((bk?.booking_items as { professional_id: string }[] || []).map((i: { professional_id: string }) => i.professional_id))]
  for (const pid of profIds) {
    notifyProfessional(pid, { title: 'Seña confirmada', body: 'Se confirmó el pago de una reserva.' })
  }

  revalidatePath('/bella-donna/turnos')
  return { success: true }
}

export async function cancelBooking(bookingId: string, refund: boolean) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) return { error: error.message }

  if (refund) {
    await supabase
      .from('payments')
      .update({ status: 'refunded' })
      .eq('booking_id', bookingId)
  }

  // Notify professionals about cancellation
  const { data: cancelBk } = await supabase
    .from('bookings')
    .select('client_id, booking_items (professional_id)')
    .eq('id', bookingId)
    .single()
  const cancelProfIds = [...new Set((cancelBk?.booking_items as { professional_id: string }[] || []).map((i: { professional_id: string }) => i.professional_id))]
  for (const pid of cancelProfIds) {
    notifyProfessional(pid, { title: 'Turno cancelado', body: 'Se canceló una reserva.' })
  }
  if (cancelBk?.client_id) {
    notifyClient(cancelBk.client_id, { title: 'Turno cancelado', body: refund ? 'Tu turno fue cancelado. Se procesará el reembolso.' : 'Tu turno fue cancelado.' })
  }

  revalidatePath('/bella-donna/turnos')
  return { success: true }
}

export async function confirmArrival(bookingId: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'in_progress' })
    .eq('id', bookingId)
    .in('status', ['confirmed', 'rescheduled'])

  if (error) return { error: error.message }

  notifyOwner({ title: 'Cliente llegó', body: 'Se confirmó la llegada de un cliente.' })

  revalidatePath('/bella-donna/turnos')
  revalidatePath('/bella-donna/calendario')
  return { success: true }
}

// ========== FLUJO DE TURNO: EXTRAS ==========

export async function getTreatmentsForProfessional(professionalId: string) {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('professional_treatments')
    .select(`
      treatment_id,
      treatments (id, name, duration_minutes, price, category_id, categories (name))
    `)
    .eq('professional_id', professionalId)

  if (!data) return []

  return data
    .map(pt => pt.treatments as unknown as {
      id: string; name: string; duration_minutes: number; price: number
      category_id: string; categories: { name: string }
    })
    .filter(Boolean)
}

export async function addOwnAddon(bookingId: string, treatmentId: string, professionalId: string) {
  const supabase = createAdminClient()

  // 1. Get treatment details
  const { data: treatment } = await supabase
    .from('treatments')
    .select('duration_minutes, price')
    .eq('id', treatmentId)
    .single()

  if (!treatment) return { error: 'Tratamiento no encontrado' }

  // 2. Get existing items for this professional in this booking to calculate start time
  const { data: existingItems } = await supabase
    .from('booking_items')
    .select('end_time')
    .eq('booking_id', bookingId)
    .eq('professional_id', professionalId)
    .order('end_time', { ascending: false })
    .limit(1)

  // Start after the last item for this professional
  const lastEndTime = existingItems?.[0]?.end_time || '09:00'
  const startTime = parse(lastEndTime.substring(0, 5), 'HH:mm', new Date())
  const endTime = addMinutes(startTime, treatment.duration_minutes)

  const newStartStr = format(startTime, 'HH:mm')
  const newEndStr = format(endTime, 'HH:mm')

  // 3. Create addon booking_item
  const { error: itemError } = await supabase
    .from('booking_items')
    .insert({
      booking_id: bookingId,
      treatment_id: treatmentId,
      professional_id: professionalId,
      start_time: newStartStr,
      end_time: newEndStr,
      price: treatment.price,
      deposit_amount: 0,
      is_addon: true,
      addon_status: 'confirmed',
    })

  if (itemError) return { error: itemError.message }

  // 4. Update booking end_time if addon extends it, and recalculate total
  const { data: allItems } = await supabase
    .from('booking_items')
    .select('end_time, price')
    .eq('booking_id', bookingId)

  if (allItems) {
    const maxEnd = allItems.map(i => i.end_time as string).sort().pop() || newEndStr
    const newTotal = allItems.reduce((sum, i) => sum + (i.price as number), 0)

    await supabase
      .from('bookings')
      .update({ end_time: maxEnd, amount_total: newTotal })
      .eq('id', bookingId)
  }

  revalidatePath('/bella-donna/turnos')
  revalidatePath('/bella-donna/calendario')
  return { success: true }
}

export async function addReferralAddon(bookingId: string, referredByProfId: string, targetProfId: string) {
  const supabase = createAdminClient()

  // Create a pending addon item — the target professional will load the treatment later
  const { error } = await supabase
    .from('booking_items')
    .insert({
      booking_id: bookingId,
      treatment_id: null,
      professional_id: targetProfId,
      start_time: '00:00',
      end_time: '00:00',
      price: 0,
      deposit_amount: 0,
      is_addon: true,
      addon_status: 'pending_acceptance',
      referred_by: referredByProfId,
    })

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/turnos')
  return { success: true }
}

export async function acceptReferralAddon(itemId: string, treatmentId: string) {
  const supabase = createAdminClient()

  // 1. Get treatment details
  const { data: treatment } = await supabase
    .from('treatments')
    .select('duration_minutes, price')
    .eq('id', treatmentId)
    .single()

  if (!treatment) return { error: 'Tratamiento no encontrado' }

  // 2. Get the addon item to know booking and professional
  const { data: item } = await supabase
    .from('booking_items')
    .select('booking_id, professional_id')
    .eq('id', itemId)
    .single()

  if (!item) return { error: 'Item no encontrado' }

  // 3. Get existing items for this professional to calculate start time
  const { data: existingItems } = await supabase
    .from('booking_items')
    .select('end_time')
    .eq('booking_id', item.booking_id)
    .eq('professional_id', item.professional_id)
    .neq('id', itemId)
    .order('end_time', { ascending: false })
    .limit(1)

  const lastEndTime = existingItems?.[0]?.end_time || '09:00'
  const startTime = parse(lastEndTime.substring(0, 5), 'HH:mm', new Date())
  const endTime = addMinutes(startTime, treatment.duration_minutes)

  // 4. Update the addon item
  const { error: updateError } = await supabase
    .from('booking_items')
    .update({
      treatment_id: treatmentId,
      start_time: format(startTime, 'HH:mm'),
      end_time: format(endTime, 'HH:mm'),
      price: treatment.price,
      addon_status: 'confirmed',
    })
    .eq('id', itemId)

  if (updateError) return { error: updateError.message }

  // 5. Recalculate booking totals and end_time
  const { data: allItems } = await supabase
    .from('booking_items')
    .select('end_time, price')
    .eq('booking_id', item.booking_id)

  if (allItems) {
    const maxEnd = allItems.map(i => i.end_time as string).sort().pop()
    const newTotal = allItems.reduce((sum, i) => sum + (i.price as number), 0)

    await supabase
      .from('bookings')
      .update({ end_time: maxEnd, amount_total: newTotal })
      .eq('id', item.booking_id)
  }

  revalidatePath('/bella-donna/turnos')
  revalidatePath('/bella-donna/calendario')
  return { success: true }
}

export async function rejectReferralAddon(itemId: string) {
  const supabase = createAdminClient()

  const { data: item } = await supabase
    .from('booking_items')
    .select('booking_id')
    .eq('id', itemId)
    .single()

  const { error } = await supabase
    .from('booking_items')
    .delete()
    .eq('id', itemId)

  if (error) return { error: error.message }

  // Recalculate booking total
  if (item) {
    const { data: allItems } = await supabase
      .from('booking_items')
      .select('price')
      .eq('booking_id', item.booking_id)

    if (allItems) {
      const newTotal = allItems.reduce((sum, i) => sum + (i.price as number), 0)
      await supabase
        .from('bookings')
        .update({ amount_total: newTotal })
        .eq('id', item.booking_id)
    }
  }

  revalidatePath('/bella-donna/turnos')
  return { success: true }
}

// ========== FINALIZAR TURNO ==========

export async function finalizeTurn(bookingId: string, paymentMethod: 'cash' | 'transfer') {
  const supabase = createAdminClient()

  // Check no pending addons
  const { data: pendingAddons } = await supabase
    .from('booking_items')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('addon_status', 'pending_acceptance')

  if (pendingAddons && pendingAddons.length > 0) {
    return { error: 'Hay derivaciones pendientes. Esperá a que se confirmen o rechacen.' }
  }

  // Calculate final amount
  const { data: booking } = await supabase
    .from('bookings')
    .select('amount_total, amount_paid')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'Turno no encontrado' }

  const finalAmount = Math.max(0, booking.amount_total - booking.amount_paid)

  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'completed',
      final_payment_method: paymentMethod,
      final_amount: finalAmount,
    })
    .eq('id', bookingId)

  if (error) return { error: error.message }

  // Register final payment in payments table
  if (finalAmount > 0) {
    await supabase.from('payments').insert({
      booking_id: bookingId,
      amount: finalAmount,
      method: paymentMethod,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })

    // Update amount_paid to reflect full payment
    await supabase
      .from('bookings')
      .update({ amount_paid: booking.amount_total })
      .eq('id', bookingId)
  }

  // Notify owner about completed turn
  notifyOwner({ title: 'Turno finalizado', body: `Turno completado. Cobro restante: $${finalAmount} (${paymentMethod === 'cash' ? 'efectivo' : 'transferencia'})` })

  revalidatePath('/bella-donna/turnos')
  revalidatePath('/bella-donna/calendario')
  return { success: true, finalAmount }
}

export async function completeBooking(bookingId: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'completed' })
    .eq('id', bookingId)

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/turnos')
  return { success: true }
}

// ========== REAGENDAMIENTO ==========

export async function getBookingsByPhone(phone: string) {
  const supabase = createAdminClient()

  // Find client by phone
  const { data: client } = await supabase
    .from('clients')
    .select('id, first_name, last_name')
    .eq('phone', phone)
    .single()

  if (!client) return { error: 'No encontramos reservas con ese número' }

  // Get active bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, booking_date, start_time, end_time, status, reschedule_count, amount_total,
      booking_items (
        id, treatment_id, start_time, end_time, professional_id, price,
        treatments (name, duration_minutes, categories (name)),
        professionals!booking_items_professional_id_fkey (first_name, last_name)
      )
    `)
    .eq('client_id', client.id)
    .in('status', ['confirmed', 'rescheduled', 'pending_payment'])
    .gte('booking_date', format(new Date(), 'yyyy-MM-dd'))
    .order('booking_date')

  if (!bookings || bookings.length === 0) {
    return { error: 'No tenés turnos activos próximos' }
  }

  return {
    client: { id: client.id, name: `${client.first_name} ${client.last_name}` },
    bookings: bookings.map(b => ({
      id: b.id,
      date: b.booking_date,
      startTime: b.start_time,
      endTime: b.end_time,
      status: b.status,
      rescheduleCount: b.reschedule_count || 0,
      total: b.amount_total,
      items: (b.booking_items || []).map((item: Record<string, unknown>) => {
        const treatments = item.treatments as { name: string; duration_minutes: number; categories: { name: string } } | null
        const professionals = item.professionals as { first_name: string; last_name: string } | null
        return {
          id: item.id as string,
          treatmentId: item.treatment_id as string,
          treatmentName: treatments?.name || 'Servicio',
          categoryName: treatments?.categories?.name || '',
          professionalName: professionals ? `${professionals.first_name} ${professionals.last_name}` : '',
          professionalId: item.professional_id as string,
          durationMinutes: treatments?.duration_minutes || 0,
          startTime: item.start_time as string,
          endTime: item.end_time as string,
        }
      }),
    })),
  }
}

export async function rescheduleBooking(bookingId: string, newDate: string, newStartTime: string) {
  const supabase = createAdminClient()

  // 0. Validate future date
  const today = format(new Date(), 'yyyy-MM-dd')
  if (newDate < today) {
    return { error: 'No podés reagendar a una fecha pasada.' }
  }

  // 1. Atomic: claim reschedule slot (prevents concurrent reschedules)
  const { data: updated, error: claimError } = await supabase
    .from('bookings')
    .update({ reschedule_count: 1 })
    .eq('id', bookingId)
    .in('status', ['confirmed', 'rescheduled'])
    .lt('reschedule_count', 1)
    .select('id, client_id, booking_items (id, professional_id, treatment_id, treatments (duration_minutes))')
    .single()

  if (claimError || !updated) {
    // Check why it failed
    const { data: check } = await supabase
      .from('bookings')
      .select('status, reschedule_count')
      .eq('id', bookingId)
      .single()
    if (!check) return { error: 'Turno no encontrado' }
    if ((check.reschedule_count || 0) >= 1) {
      return { error: 'Ya reagendaste este turno. No es posible reagendar nuevamente. Perdés la reserva y la seña.' }
    }
    return { error: 'Este turno no se puede reagendar' }
  }

  // 2. Verify availability for all professionals on the new date/time
  const items = (updated.booking_items || []) as unknown as Array<{
    id: string; professional_id: string; treatment_id: string;
    treatments: { duration_minutes: number } | null
  }>

  for (const item of items) {
    const slots = await getAvailableSlots(item.professional_id, item.treatment_id, newDate)
    const isAvailable = slots.some(s => s.time === newStartTime && s.available)
    if (!isAvailable) {
      // Rollback: restore reschedule_count to 0
      await supabase.from('bookings').update({ reschedule_count: 0 }).eq('id', bookingId)
      return { error: 'El horario ya no está disponible. Elegí otro.' }
    }
  }

  // 3. Recalculate times for items
  const byProfessional: Record<string, typeof items> = {}
  for (const item of items) {
    if (!byProfessional[item.professional_id]) {
      byProfessional[item.professional_id] = []
    }
    byProfessional[item.professional_id].push(item)
  }

  let globalEnd = newStartTime
  for (const profItems of Object.values(byProfessional)) {
    let currentStart = parse(newStartTime, 'HH:mm', new Date())
    for (const item of profItems) {
      const duration = item.treatments?.duration_minutes || 30
      const endTime = addMinutes(currentStart, duration)
      const endStr = format(endTime, 'HH:mm')

      await supabase.from('booking_items')
        .update({ start_time: format(currentStart, 'HH:mm'), end_time: endStr })
        .eq('id', item.id)

      if (endStr > globalEnd) globalEnd = endStr
      currentStart = endTime
    }
  }

  // 4. Update booking date/time/status
  const { error } = await supabase
    .from('bookings')
    .update({
      booking_date: newDate,
      start_time: newStartTime,
      end_time: globalEnd,
      status: 'rescheduled',
    })
    .eq('id', bookingId)

  if (error) return { error: error.message }

  // Notify professionals about reschedule
  const reschProfIds = [...new Set(items.map(i => i.professional_id))]
  for (const pid of reschProfIds) {
    notifyProfessional(pid, { title: 'Turno reagendado', body: `Un turno fue reagendado al ${newDate} a las ${newStartTime}hs.` })
  }
  notifyOwner({ title: 'Turno reagendado', body: `Un cliente reagendó su turno al ${newDate} a las ${newStartTime}hs.` })

  revalidatePath('/bella-donna/turnos')
  revalidatePath('/bella-donna/calendario')
  return { success: true }
}

// ========== NO-SHOW ==========

export async function markNoShow(bookingId: string) {
  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, client_id')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'Turno no encontrado' }
  if (!['confirmed', 'rescheduled'].includes(booking.status)) {
    return { error: 'Solo se puede marcar no-show en turnos confirmados' }
  }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'no_show' })
    .eq('id', bookingId)

  if (error) return { error: error.message }

  // Notify client
  if (booking.client_id) {
    notifyClient(booking.client_id, {
      title: 'No asististe a tu turno',
      body: 'Tu turno fue marcado como no asistido. Contactanos si fue un error.',
      url: '/reagendar',
      tag: `noshow-${bookingId}`,
    }).catch(() => {})
  }

  revalidatePath('/bella-donna/turnos')
  return { success: true }
}

export async function revertNoShow(bookingId: string) {
  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'Turno no encontrado' }
  if (booking.status !== 'no_show') {
    return { error: 'Solo se puede revertir un turno marcado como ausente' }
  }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId)

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/turnos')
  revalidatePath('/bella-donna/calendario')
  return { success: true }
}

// ========== TRANSFERENCIA DE TURNOS ==========

export async function initiateTransfer(bookingItemId: string, targetProfessionalId: string) {
  const supabase = createAdminClient()

  const { data: item } = await supabase
    .from('booking_items')
    .select('id, professional_id, booking_id')
    .eq('id', bookingItemId)
    .single()

  if (!item) return { error: 'Item no encontrado' }

  // Validate target professional exists and is active
  const { data: targetProf } = await supabase
    .from('professionals')
    .select('id, active')
    .eq('id', targetProfessionalId)
    .single()

  if (!targetProf) return { error: 'Profesional destino no encontrada' }
  if (!targetProf.active) return { error: 'La profesional destino no está activa' }

  const { error } = await supabase
    .from('booking_items')
    .update({
      original_professional_id: item.professional_id,
      professional_id: targetProfessionalId,
      transfer_status: 'pending_transfer',
    })
    .eq('id', bookingItemId)

  if (error) return { error: error.message }

  // Notify target professional
  notifyProfessional(targetProfessionalId, {
    title: 'Transferencia de turno',
    body: 'Te transfirieron un turno. Aceptá o rechazá.',
    url: '/bella-donna/turnos',
    tag: `transfer-${bookingItemId}`,
  }).catch(() => {})

  revalidatePath('/bella-donna/turnos')
  return { success: true }
}

export async function acceptTransfer(bookingItemId: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('booking_items')
    .update({ transfer_status: 'accepted' })
    .eq('id', bookingItemId)
    .eq('transfer_status', 'pending_transfer')

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/turnos')
  revalidatePath('/bella-donna/calendario')
  return { success: true }
}

// ========== PORTAL MI TURNO (público) ==========

export async function cancelBookingByClient(bookingId: string, clientPhone: string) {
  const phoneSchema = z.string().regex(/^\d{10}$/, 'Celular inválido')
  const phoneParsed = phoneSchema.safeParse(clientPhone)
  if (!phoneParsed.success) return { error: 'Número de celular inválido' }

  const supabase = createAdminClient()

  // 1. Verify booking exists and belongs to this client (by phone)
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_date, start_time, status, client_id, clients!inner(phone)')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'Turno no encontrado' }

  const clientData = booking.clients as unknown as { phone: string }
  if (clientData.phone !== clientPhone) {
    return { error: 'Este turno no corresponde a tu número' }
  }

  if (!['confirmed', 'rescheduled', 'pending_payment'].includes(booking.status)) {
    return { error: 'Este turno no se puede cancelar' }
  }

  // 2. Validate 48hs rule
  const bookingDateTime = new Date(`${booking.booking_date}T${booking.start_time}`)
  const now = new Date()
  const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (hoursUntilBooking < 48) {
    return {
      error: 'No podés cancelar con menos de 48hs de anticipación. Contactanos por WhatsApp para resolverlo.',
      reason: 'too_late',
    }
  }

  // 3. Cancel without refund (client-initiated)
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) return { error: error.message }

  // 4. Notify professionals and owner
  const { data: bk } = await supabase
    .from('bookings')
    .select('booking_items (professional_id)')
    .eq('id', bookingId)
    .single()

  const profIds = [...new Set((bk?.booking_items as { professional_id: string }[] || []).map((i: { professional_id: string }) => i.professional_id))]
  for (const pid of profIds) {
    notifyProfessional(pid, {
      title: 'Turno cancelado por clienta',
      body: `La clienta canceló su turno del ${booking.booking_date}.`,
      url: '/bella-donna/turnos',
      tag: `client-cancel-${bookingId}`,
    }).catch(() => {})
  }
  notifyOwner({
    title: 'Turno cancelado por clienta',
    body: `Una clienta canceló su turno del ${booking.booking_date} a las ${booking.start_time}hs. Seña NO reembolsada.`,
    url: '/bella-donna/turnos',
    tag: `client-cancel-${bookingId}`,
  }).catch(() => {})

  return { success: true }
}

export async function manualRefund(bookingId: string, refundedByProfId: string) {
  const supabase = createAdminClient()

  const { error: payError } = await supabase
    .from('payments')
    .update({
      status: 'refunded',
      refund_type: 'manual',
      refunded_by: refundedByProfId,
    })
    .eq('booking_id', bookingId)
    .eq('status', 'confirmed')

  if (payError) return { error: payError.message }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) return { error: error.message }

  const { data: payment } = await supabase
    .from('payments')
    .select('amount')
    .eq('booking_id', bookingId)
    .single()

  const { data: refunder } = await supabase
    .from('professionals')
    .select('first_name, last_name')
    .eq('id', refundedByProfId)
    .single()

  const refunderName = refunder ? `${refunder.first_name} ${refunder.last_name}` : 'Encargada'
  const amount = payment?.amount || 0

  notifyOwner({
    title: 'Devolución manual registrada',
    body: `${refunderName} registró devolución manual de $${amount}. Verificar y procesar el reembolso.`,
    url: '/bella-donna/turnos',
    tag: `manual-refund-${bookingId}`,
  }).catch(() => {})

  const { data: bk } = await supabase
    .from('bookings')
    .select('client_id, booking_items (professional_id)')
    .eq('id', bookingId)
    .single()

  const profIds = [...new Set((bk?.booking_items as { professional_id: string }[] || []).map((i: { professional_id: string }) => i.professional_id))]
  for (const pid of profIds) {
    notifyProfessional(pid, {
      title: 'Turno cancelado con devolución',
      body: 'Se canceló un turno con devolución manual.',
    }).catch(() => {})
  }

  if (bk?.client_id) {
    notifyClient(bk.client_id, {
      title: 'Turno cancelado',
      body: 'Tu turno fue cancelado. Se procesará el reembolso de la seña.',
    }).catch(() => {})
  }

  revalidatePath('/bella-donna/turnos')
  return { success: true }
}

export async function getStorePhone(): Promise<string> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('store_settings')
    .select('value')
    .eq('key', 'phone')
    .single()
  return data?.value || ''
}

export async function rejectTransfer(bookingItemId: string) {
  const supabase = createAdminClient()

  // Get original professional to restore
  const { data: item } = await supabase
    .from('booking_items')
    .select('original_professional_id')
    .eq('id', bookingItemId)
    .single()

  if (!item || !item.original_professional_id) return { error: 'Item no encontrado' }

  const { error } = await supabase
    .from('booking_items')
    .update({
      professional_id: item.original_professional_id,
      original_professional_id: null,
      transfer_status: null,
    })
    .eq('id', bookingItemId)

  if (error) return { error: error.message }

  // Notify owner that transfer was rejected
  notifyOwner({
    title: 'Transferencia rechazada',
    body: 'La profesional rechazó la transferencia. El turno volvió a la profesional original.',
    url: '/bella-donna/turnos',
    tag: `transfer-reject-${bookingItemId}`,
  }).catch(() => {})

  revalidatePath('/bella-donna/turnos')
  revalidatePath('/bella-donna/calendario')
  return { success: true }
}
