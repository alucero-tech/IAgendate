import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDepositPercentage } from '@/features/booking/services/booking-actions'

const IS_MP_TEST_MODE = !process.env.MERCADOPAGO_ACCESS_TOKEN ||
  process.env.MERCADOPAGO_ACCESS_TOKEN === 'TU_ACCESS_TOKEN_DE_MERCADOPAGO'

export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json()

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId requerido' }, { status: 400 })
    }

    const supabase = await createClient()

    // Obtener booking con datos del tratamiento
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        *,
        clients (first_name, last_name, email, phone),
        treatments (name, price)
      `)
      .eq('id', bookingId)
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    }

    const treatment = booking.treatments as { name: string; price: number }
    const depositPct = await getDepositPercentage()
    const depositAmount = Math.ceil(treatment.price * depositPct / 100)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

    // --- MODO TEST: redirigir a mock checkout ---
    if (IS_MP_TEST_MODE) {
      const mockUrl = `${baseUrl}/reservar/mock-checkout?booking=${bookingId}&amount=${depositAmount}&treatment=${encodeURIComponent(treatment.name)}`
      return NextResponse.json({
        preferenceId: 'mock-' + bookingId,
        initPoint: mockUrl,
      })
    }

    // --- MODO PRODUCCIÓN: Mercado Pago real ---
    const { preferenceClient } = await import('@/lib/mercadopago')
    const client = booking.clients as { first_name: string; last_name: string; email: string | null; phone: string }

    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: bookingId,
            title: `Seña - ${treatment.name}`,
            quantity: 1,
            unit_price: depositAmount,
            currency_id: 'ARS',
          },
        ],
        payer: {
          name: client.first_name,
          surname: client.last_name,
          email: client.email || undefined,
          phone: client.phone ? { number: client.phone } : undefined,
        },
        back_urls: {
          success: `${baseUrl}/reservar/resultado?status=success&booking=${bookingId}`,
          failure: `${baseUrl}/reservar/resultado?status=failure&booking=${bookingId}`,
          pending: `${baseUrl}/reservar/resultado?status=pending&booking=${bookingId}`,
        },
        auto_return: 'approved',
        external_reference: bookingId,
        notification_url: `${baseUrl}/api/mercadopago/webhook`,
        statement_descriptor: 'IAGENDATE',
      },
    })

    await supabase
      .from('payments')
      .update({ external_reference: preference.id })
      .eq('booking_id', bookingId)

    return NextResponse.json({
      preferenceId: preference.id,
      initPoint: preference.init_point,
    })
  } catch (error) {
    console.error('Error creating MP preference:', error)
    return NextResponse.json(
      { error: 'Error al crear el pago' },
      { status: 500 }
    )
  }
}
