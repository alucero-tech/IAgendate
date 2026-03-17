'use server'

import { generateText } from 'ai'
import { google, MODELS } from '@/lib/ai/google'
import { createAdminClient } from '@/lib/supabase/admin'
import { format } from 'date-fns'

export async function generateDailySummary() {
  const supabase = createAdminClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  // Fetch today's data
  const [bookingsResult, paymentsResult] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        id, start_time, end_time, status, amount_total,
        clients (first_name, last_name),
        booking_items (
          treatments (name),
          professionals!booking_items_professional_id_fkey (first_name, last_name)
        )
      `)
      .eq('booking_date', today)
      .order('start_time'),
    supabase
      .from('payments')
      .select('amount, status, method, bookings!inner(booking_date)')
      .eq('bookings.booking_date', today),
  ])

  const bookings = bookingsResult.data || []
  const payments = paymentsResult.data || []

  if (bookings.length === 0) {
    return { summary: 'No hay turnos agendados para hoy. Es un buen día para descansar o planificar.' }
  }

  // Build context for the LLM
  const bookingSummary = bookings.map(b => {
    const client = b.clients as unknown as { first_name: string; last_name: string }
    const items = (b.booking_items as unknown as Array<{
      treatments: { name: string }
      professionals: { first_name: string; last_name: string }
    }>) || []

    return {
      hora: b.start_time?.substring(0, 5),
      cliente: client ? `${client.first_name} ${client.last_name}` : 'Sin nombre',
      servicios: items.map(i => i.treatments?.name).filter(Boolean).join(', '),
      profesional: items.map(i => i.professionals ? `${i.professionals.first_name}` : '').filter(Boolean).join(', '),
      estado: b.status,
      monto: b.amount_total,
    }
  })

  const totalExpected = bookings.reduce((sum, b) => sum + (b.amount_total || 0), 0)
  const confirmed = bookings.filter(b => ['confirmed', 'rescheduled'].includes(b.status)).length
  const pending = bookings.filter(b => b.status === 'pending_payment').length
  const completed = bookings.filter(b => b.status === 'completed').length

  const confirmedPayments = payments.filter(p => p.status === 'confirmed').reduce((sum, p) => sum + p.amount, 0)
  const pendingPayments = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0)

  const prompt = `Generá un resumen del día para la dueña del salón de belleza. Hoy es ${format(new Date(), 'EEEE d \'de\' MMMM')}.

DATOS DEL DÍA:
- Total de turnos: ${bookings.length}
- Confirmados: ${confirmed}
- Pendientes de pago: ${pending}
- Completados: ${completed}
- Ingreso esperado total: $${totalExpected}
- Señas cobradas: $${confirmedPayments}
- Señas pendientes: $${pendingPayments}

DETALLE DE TURNOS:
${JSON.stringify(bookingSummary, null, 2)}

INSTRUCCIONES:
- Escribí en español rioplatense, tono cálido y profesional.
- Empezá con un saludo breve según la hora del día.
- Resumí: cuántos turnos hay, quiénes vienen, qué servicios se hacen.
- Mencioná los ingresos esperados.
- Si hay turnos pendientes de pago, avisá.
- Cerrá con algo motivador o un dato útil.
- Máximo 200 palabras. No uses markdown complejo, solo texto plano con saltos de línea.`

  const { text } = await generateText({
    model: google(MODELS.fast),
    prompt,
    maxOutputTokens: 500,
  })

  return { summary: text }
}

export async function generateRescheduleSuggestions(
  bookingId: string,
  professionalId: string,
  treatmentId: string
) {
  const supabase = createAdminClient()

  // Get treatment duration
  const { data: treatment } = await supabase
    .from('treatments')
    .select('duration_minutes, name')
    .eq('id', treatmentId)
    .single()

  if (!treatment) return { suggestions: [] }

  // Get professional schedule
  const { data: schedules } = await supabase
    .from('schedules')
    .select('day_of_week, start_time, end_time')
    .eq('professional_id', professionalId)
    .eq('is_active', true)

  if (!schedules || schedules.length === 0) return { suggestions: [] }

  const activeDays = new Set(schedules.map(s => s.day_of_week))

  // Check next 7 days for available slots
  const suggestions: { date: string; dayLabel: string; slots: string[] }[] = []
  const now = new Date()

  for (let i = 1; i <= 7 && suggestions.length < 3; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() + i)
    const dayOfWeek = date.getDay()

    if (!activeDays.has(dayOfWeek)) continue

    const dateStr = format(date, 'yyyy-MM-dd')
    const dayLabel = format(date, 'EEEE d/MM')

    // Get existing bookings for this day
    const { data: existingItems } = await supabase
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
        start: (item.start_time as string).substring(0, 5),
        end: (item.end_time as string).substring(0, 5),
      }))

    // Get time blocks
    const { data: blocks } = await supabase
      .from('time_blocks')
      .select('start_time, end_time')
      .eq('professional_id', professionalId)
      .eq('block_date', dateStr)
      .eq('status', 'approved')

    const schedule = schedules.find(s => s.day_of_week === dayOfWeek)
    if (!schedule) continue

    // Find available slots
    const { parse: parseTime, addMinutes, isBefore, format: formatTime } = await import('date-fns')
    const schedStart = parseTime(schedule.start_time, 'HH:mm:ss', new Date())
    const schedEnd = parseTime(schedule.end_time, 'HH:mm:ss', new Date())

    const availableSlots: string[] = []
    let current = schedStart

    while (isBefore(addMinutes(current, treatment.duration_minutes), schedEnd) ||
           formatTime(addMinutes(current, treatment.duration_minutes), 'HH:mm') === formatTime(schedEnd, 'HH:mm')) {
      const slotStart = formatTime(current, 'HH:mm')
      const slotEnd = formatTime(addMinutes(current, treatment.duration_minutes), 'HH:mm')

      const hasConflict = bookedSlots.some(b => slotStart < b.end && slotEnd > b.start)
      const hasBlock = (blocks || []).some(b => {
        const bStart = b.start_time.substring(0, 5)
        const bEnd = b.end_time.substring(0, 5)
        return slotStart < bEnd && slotEnd > bStart
      })

      if (!hasConflict && !hasBlock) {
        availableSlots.push(slotStart)
      }

      current = addMinutes(current, 30) // 30 min intervals for suggestions
    }

    if (availableSlots.length > 0) {
      suggestions.push({
        date: dateStr,
        dayLabel,
        slots: availableSlots.slice(0, 4), // Max 4 slots per day
      })
    }
  }

  return {
    treatmentName: treatment.name,
    suggestions,
  }
}
