import { NextRequest, NextResponse } from 'next/server'
import { paymentClient } from '@/lib/mercadopago'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Solo procesar notificaciones de pago
    if (body.type !== 'payment' && body.action !== 'payment.created') {
      return NextResponse.json({ received: true })
    }

    const paymentId = body.data?.id
    if (!paymentId) {
      return NextResponse.json({ received: true })
    }

    // Obtener datos del pago desde Mercado Pago
    const mpPayment = await paymentClient.get({ id: paymentId })

    if (!mpPayment || !mpPayment.external_reference) {
      return NextResponse.json({ received: true })
    }

    const bookingId = mpPayment.external_reference
    const status = mpPayment.status // approved, pending, rejected, etc.

    const supabase = await createClient()

    if (status === 'approved') {
      // Confirmar pago
      await supabase
        .from('payments')
        .update({
          status: 'confirmed',
          external_reference: String(paymentId),
          confirmed_at: new Date().toISOString(),
        })
        .eq('booking_id', bookingId)

      // Confirmar booking
      const { data: payment } = await supabase
        .from('payments')
        .select('amount')
        .eq('booking_id', bookingId)
        .single()

      await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          amount_paid: payment?.amount || 0,
        })
        .eq('id', bookingId)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
  }
}
