import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mpCreatePreferenceSchema } from '@/shared/schemas/zod-schemas'

export async function POST(request: NextRequest) {
  try {
    const parsed = mpCreatePreferenceSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { bookingId } = parsed.data

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
