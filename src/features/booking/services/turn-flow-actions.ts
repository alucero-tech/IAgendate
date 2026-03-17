'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { addMinutes, format, parse } from 'date-fns'
import { notifyOwner, notifyClient } from '@/features/notifications/services/push-service'

// ========== LLEGADA ==========

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
