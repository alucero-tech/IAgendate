import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json()

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId requerido' }, { status: 400 })
    }

    const supabase = await createClient()

    // Confirmar pago
    await supabase
      .from('payments')
      .update({
        status: 'confirmed',
        external_reference: 'mock-payment-' + Date.now(),
        confirmed_at: new Date().toISOString(),
      })
      .eq('booking_id', bookingId)

    // Obtener monto del pago
    const { data: payment } = await supabase
      .from('payments')
      .select('amount')
      .eq('booking_id', bookingId)
      .single()

    // Confirmar booking
    await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        amount_paid: payment?.amount || 0,
      })
      .eq('id', bookingId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mock webhook error:', error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
