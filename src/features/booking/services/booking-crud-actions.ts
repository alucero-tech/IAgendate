'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getTenantPath, getCurrentTenantSlug } from '@/lib/tenant'
import { z } from 'zod'
import { addMinutes, format, parse } from 'date-fns'
import { notifyProfessional, notifyOwner, notifyClient } from '@/features/notifications/services/push-service'
import {
  cancelBookingSchema,
  cancelBookingByClientSchema,
  getBookingsByPhoneSchema,
  rescheduleBookingSchema,
} from '@/shared/schemas/zod-schemas'
import { calcDepositAmount } from './booking-helpers'
import { getProfessionalsForTreatment } from './catalog-actions'
import { getAvailableSlots } from './availability-actions'

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

export async function getTransferAlias(): Promise<string> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('store_settings')
    .select('value')
    .eq('key', 'transfer_alias')
    .maybeSingle()
  return (data?.value as string) || ''
}

export async function getStorePhone(): Promise<string> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('store_settings')
    .select('value')
    .eq('key', 'phone')
    .maybeSingle()
  return data?.value || ''
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

// ========== CANCELAR BOOKING ==========

export async function cancelBooking(bookingId: string, refund: boolean) {
  const parsed = cancelBookingSchema.safeParse({ bookingId, refund })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

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

  const slug = await getCurrentTenantSlug()
  revalidatePath(getTenantPath(slug, '/turnos'))
  return { success: true }
}

export async function cancelBookingByClient(bookingId: string, clientPhone: string) {
  const parsed = cancelBookingByClientSchema.safeParse({ bookingId, clientPhone })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

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

// ========== CONSULTAR Y REAGENDAR ==========

export async function getBookingsByPhone(phone: string) {
  const parsed = getBookingsByPhoneSchema.safeParse({ phone })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

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
  const parsed = rescheduleBookingSchema.safeParse({ bookingId, newDate, newStartTime })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

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

  const slug = await getCurrentTenantSlug()
  revalidatePath(getTenantPath(slug, '/turnos'))
  revalidatePath(getTenantPath(slug, '/calendario'))
  return { success: true }
}
