'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { notifyProfessional, notifyOwner, notifyClient } from '@/features/notifications/services/push-service'
import { bookingIdSchema, uuidSchema, manualRefundSchema, initiateTransferSchema } from '@/shared/schemas/zod-schemas'

// ========== CONFIRMAR PAGO POR TRANSFERENCIA ==========

export async function confirmTransferPayment(bookingId: string) {
  const v = bookingIdSchema.safeParse(bookingId)
  if (!v.success) return { error: v.error.issues[0].message }

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

// ========== DEVOLUCIÓN MANUAL ==========

export async function manualRefund(bookingId: string, refundedByProfId: string) {
  const parsed = manualRefundSchema.safeParse({ bookingId, refundedByProfId })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

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

// ========== TRANSFERENCIA DE TURNOS ==========

export async function initiateTransfer(bookingItemId: string, targetProfessionalId: string) {
  const parsed = initiateTransferSchema.safeParse({ bookingItemId, targetProfessionalId })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

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
  const v = uuidSchema.safeParse(bookingItemId)
  if (!v.success) return { error: v.error.issues[0].message }

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

export async function rejectTransfer(bookingItemId: string) {
  const v = uuidSchema.safeParse(bookingItemId)
  if (!v.success) return { error: v.error.issues[0].message }

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
