import { tool } from 'ai'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { format, addDays, eachDayOfInterval, parse, addMinutes, isBefore } from 'date-fns'

export const findTreatment = tool({
  description: 'Busca un tratamiento por nombre para obtener su ID y datos necesarios para reservar.',
  inputSchema: z.object({
    query: z.string().describe('Nombre o parte del nombre del tratamiento'),
  }),
  execute: async ({ query }) => {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('treatments')
      .select('id, name, duration_minutes, price, category_id, categories (name)')
      .eq('active', true)
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(5)

    if (!data || data.length === 0) {
      return {
        error: `No encontré tratamientos con "${query}". Probá con otro nombre o usá listCategories para ver las categorías disponibles.`,
        treatments: [],
        found: false,
      }
    }

    return {
      treatments: data.map(t => ({
        id: t.id,
        name: t.name,
        durationMinutes: t.duration_minutes,
        price: t.price,
        category: (t.categories as unknown as { name: string })?.name || '',
      })),
    }
  },
})

export const findProfessionals = tool({
  description: 'Busca profesionales disponibles para un tratamiento específico.',
  inputSchema: z.object({
    treatmentId: z.string().describe('ID del tratamiento'),
  }),
  execute: async ({ treatmentId }) => {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('professional_treatments')
      .select('professional_id, professionals (id, first_name, last_name, active)')
      .eq('treatment_id', treatmentId)

    if (!data || data.length === 0) {
      return { professionals: [], message: 'No encontré profesionales asignadas a este tratamiento. Puede que el tratamiento no esté configurado correctamente.' }
    }

    const professionals = data
      .map(pt => pt.professionals as unknown as { id: string; first_name: string; last_name: string; active: boolean })
      .filter(p => p && p.active)
      .map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}` }))

    if (professionals.length === 0) {
      return { professionals: [], message: 'Las profesionales asignadas a este tratamiento no están activas en este momento.' }
    }

    return { professionals }
  },
})

export const checkAvailability = tool({
  description: 'Verifica disponibilidad de horarios para un profesional en una fecha específica.',
  inputSchema: z.object({
    professionalId: z.string().describe('ID del profesional'),
    treatmentId: z.string().describe('ID del tratamiento'),
    date: z.string().describe('Fecha en formato YYYY-MM-DD'),
  }),
  execute: async ({ professionalId, treatmentId, date }) => {
    const supabase = createAdminClient()

    // Get treatment duration
    const { data: treatment } = await supabase
      .from('treatments')
      .select('duration_minutes')
      .eq('id', treatmentId)
      .single()

    if (!treatment) return { error: 'Tratamiento no encontrado', slots: [] }

    const duration = treatment.duration_minutes

    // Get schedule for this day
    const dateObj = new Date(date + 'T12:00:00')
    const dayOfWeek = dateObj.getDay()

    const { data: schedule } = await supabase
      .from('schedules')
      .select('start_time, end_time')
      .eq('professional_id', professionalId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .single()

    if (!schedule) return { error: 'La profesional no trabaja ese día. Usá getAvailableDates para ver qué días tiene disponibles.', slots: [], available: false }

    // Get existing bookings
    const { data: existingItems } = await supabase
      .from('booking_items')
      .select('start_time, end_time, booking_id, bookings!inner(booking_date, status)')
      .eq('professional_id', professionalId)

    const bookedSlots = (existingItems || [])
      .filter((item: Record<string, unknown>) => {
        const booking = item.bookings as unknown as { booking_date: string; status: string }
        return booking.booking_date === date &&
          ['confirmed', 'rescheduled', 'pending_payment', 'in_progress'].includes(booking.status)
      })
      .map((item: Record<string, unknown>) => ({
        start_time: item.start_time as string,
        end_time: item.end_time as string,
      }))

    // Get time blocks
    const { data: blocks } = await supabase
      .from('time_blocks')
      .select('start_time, end_time')
      .eq('professional_id', professionalId)
      .eq('block_date', date)
      .eq('status', 'approved')

    // Calculate available slots
    const slots: string[] = []
    const schedStart = parse(schedule.start_time, 'HH:mm:ss', new Date())
    const schedEnd = parse(schedule.end_time, 'HH:mm:ss', new Date())

    let current = schedStart
    while (isBefore(addMinutes(current, duration), schedEnd) || format(addMinutes(current, duration), 'HH:mm') === format(schedEnd, 'HH:mm')) {
      const slotStart = format(current, 'HH:mm')
      const slotEnd = format(addMinutes(current, duration), 'HH:mm')

      const hasConflict = bookedSlots.some(booking => {
        const bStart = (booking.start_time as string).substring(0, 5)
        const bEnd = (booking.end_time as string).substring(0, 5)
        return slotStart < bEnd && slotEnd > bStart
      })

      const hasBlock = (blocks || []).some(block => {
        const bStart = block.start_time.substring(0, 5)
        const bEnd = block.end_time.substring(0, 5)
        return slotStart < bEnd && slotEnd > bStart
      })

      if (!hasConflict && !hasBlock) {
        slots.push(slotStart)
      }

      current = addMinutes(current, 15)
    }

    return { date, availableSlots: slots, totalAvailable: slots.length }
  },
})

export const getAvailableDates = tool({
  description: 'Obtiene las fechas disponibles en los próximos 14 días para un profesional.',
  inputSchema: z.object({
    professionalId: z.string().describe('ID del profesional'),
  }),
  execute: async ({ professionalId }) => {
    const supabase = createAdminClient()
    const today = new Date()
    const maxDate = addDays(today, 14)

    const { data: schedules } = await supabase
      .from('schedules')
      .select('day_of_week')
      .eq('professional_id', professionalId)
      .eq('is_active', true)

    if (!schedules || schedules.length === 0) {
      return { dates: [], message: 'La profesional no tiene horarios configurados.' }
    }

    const activeDays = new Set(schedules.map(s => s.day_of_week))
    const days = eachDayOfInterval({ start: today, end: maxDate })

    return {
      dates: days
        .filter(day => activeDays.has(day.getDay()))
        .map(day => format(day, 'yyyy-MM-dd')),
    }
  },
})

export const bookingTools = {
  findTreatment,
  findProfessionals,
  checkAvailability,
  getAvailableDates,
}
