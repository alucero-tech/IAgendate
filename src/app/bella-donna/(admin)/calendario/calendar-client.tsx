'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getWeekBookings, type CalendarBooking } from '@/features/calendar/services/calendar-actions'
import { BookingDetailSheet } from '@/features/calendar/components/booking-detail-sheet'
import { ChevronLeft, ChevronRight, Calendar, Users } from 'lucide-react'
import { format, addDays, startOfWeek, isToday } from 'date-fns'
import { es } from 'date-fns/locale'

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7:00 a 20:00

const statusColors: Record<string, string> = {
  confirmed: 'bg-bella-rose-100 border-bella-rose-300 text-bella-rose-800',
  rescheduled: 'bg-bella-violet-100 border-bella-violet-300 text-bella-violet-800',
  pending_payment: 'bg-bella-gold-100 border-bella-gold-300 text-bella-gold-800',
  in_progress: 'bg-blue-100 border-blue-300 text-blue-800',
  completed: 'bg-green-100 border-green-300 text-green-800',
}

interface Props {
  initialBookings: CalendarBooking[]
  professionals: { id: string; first_name: string; last_name: string; is_owner: boolean }[]
  currentProfessionalId: string
  isOwner: boolean
  initialDate: string
}

export function CalendarClient({
  initialBookings,
  professionals,
  isOwner,
  initialDate,
}: Props) {
  const [bookings, setBookings] = useState(initialBookings)
  const [currentDate, setCurrentDate] = useState(initialDate)
  const [filterProfessional, setFilterProfessional] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null)

  const weekStart = startOfWeek(new Date(currentDate), { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const filteredBookings = useMemo(() => {
    if (filterProfessional === 'all') return bookings
    return bookings.filter(b => b.professional_id === filterProfessional)
  }, [bookings, filterProfessional])

  async function navigateWeek(direction: 'prev' | 'next') {
    setLoading(true)
    const newDate = format(
      addDays(new Date(currentDate), direction === 'next' ? 7 : -7),
      'yyyy-MM-dd'
    )
    setCurrentDate(newDate)

    const profId = filterProfessional === 'all' ? undefined : filterProfessional
    const newBookings = await getWeekBookings(newDate, isOwner ? profId : undefined)
    setBookings(newBookings)
    setLoading(false)
  }

  async function handleFilterChange(profId: string) {
    setFilterProfessional(profId)
    if (isOwner) {
      setLoading(true)
      const newBookings = await getWeekBookings(
        currentDate,
        profId === 'all' ? undefined : profId
      )
      setBookings(newBookings)
      setLoading(false)
    }
  }

  function getBookingsForDayAndHour(date: Date, hour: number) {
    const dateStr = format(date, 'yyyy-MM-dd')
    return filteredBookings.filter(b => {
      if (b.booking_date !== dateStr) return false
      const startHour = parseInt(b.start_time.substring(0, 2))
      return startHour === hour
    })
  }

  function getBookingHeight(booking: CalendarBooking) {
    const startParts = booking.start_time.split(':').map(Number)
    const endParts = booking.end_time.split(':').map(Number)
    const startMin = startParts[0] * 60 + startParts[1]
    const endMin = endParts[0] * 60 + endParts[1]
    const durationMin = endMin - startMin
    return Math.max(durationMin / 60, 0.25)
  }

  function getBookingTop(booking: CalendarBooking) {
    const minutes = parseInt(booking.start_time.substring(3, 5))
    return (minutes / 60) * 100
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-bella-rose-500 shrink-0" />
            <span className="truncate">{isOwner ? 'Calendario Global' : 'Mi Calendario'}</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Professional filter */}
          {isOwner && professionals.length > 1 && (
            <Select value={filterProfessional} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
                <Users className="h-4 w-4 mr-1.5" />
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las profesionales</SelectItem>
                {professionals.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Week navigation */}
          <div className="flex items-center gap-1 ml-auto">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateWeek('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs sm:text-sm font-medium min-w-[140px] sm:min-w-[180px] text-center">
              {format(weekDays[0], "d MMM", { locale: es })} — {format(weekDays[6], "d MMM yyyy", { locale: es })}
            </span>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateWeek('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className={`border rounded-xl overflow-auto bg-white/80 ${loading ? 'opacity-50' : ''}`}>
        <div className="min-w-[800px]">
          {/* Days header */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] sm:grid-cols-[80px_repeat(7,1fr)] border-b sticky top-0 bg-white z-10">
            <div className="p-2 border-r" />
            {weekDays.map(day => (
              <div
                key={day.toISOString()}
                className={`p-1.5 sm:p-2 text-center border-r last:border-r-0 ${
                  isToday(day) ? 'bg-bella-rose-50' : ''
                }`}
              >
                <p className="text-[10px] sm:text-xs text-muted-foreground capitalize">
                  {format(day, 'EEE', { locale: es })}
                </p>
                <p className={`text-base sm:text-lg font-semibold ${
                  isToday(day) ? 'text-bella-rose-600' : ''
                }`}>
                  {format(day, 'd')}
                </p>
              </div>
            ))}
          </div>

          {/* Time slots */}
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] sm:grid-cols-[80px_repeat(7,1fr)] border-b last:border-b-0">
              <div className="p-1.5 sm:p-2 text-[10px] sm:text-xs text-muted-foreground text-right pr-2 sm:pr-3 border-r">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {weekDays.map(day => {
                const dayBookings = getBookingsForDayAndHour(day, hour)
                return (
                  <div
                    key={day.toISOString()}
                    className={`relative min-h-[60px] border-r last:border-r-0 ${
                      isToday(day) ? 'bg-bella-rose-50/30' : ''
                    }`}
                  >
                    {dayBookings.map((booking, idx) => {
                      const height = getBookingHeight(booking)
                      const top = getBookingTop(booking)
                      const colors = statusColors[booking.status] || 'bg-gray-100 border-gray-300 text-gray-800'
                      const total = dayBookings.length
                      const widthPercent = total > 1 ? 100 / total : 100
                      const leftPercent = total > 1 ? idx * widthPercent : 0

                      return (
                        <div
                          key={booking.id}
                          className={`absolute rounded-md border px-1 py-0.5 text-[10px] sm:text-xs overflow-hidden cursor-pointer hover:opacity-80 active:scale-[0.97] transition-all ${colors}`}
                          style={{
                            top: `${top}%`,
                            height: `${height * 60}px`,
                            minHeight: '20px',
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                          }}
                          onClick={() => setSelectedBooking(booking)}
                        >
                          <p className="font-medium truncate">{booking.client_name}</p>
                          <p className="truncate opacity-75">{booking.treatment_name}</p>
                          {isOwner && filterProfessional === 'all' && (
                            <p className="truncate opacity-60">{booking.professional_name}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 sm:gap-3 text-[10px] sm:text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-bella-rose-100 border border-bella-rose-300" />
          Confirmado
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-bella-violet-100 border border-bella-violet-300" />
          Reagendado
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-bella-gold-100 border border-bella-gold-300" />
          Pago pendiente
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-green-100 border border-green-300" />
          Completado
        </div>
      </div>

      {/* Booking Detail Sheet */}
      <BookingDetailSheet
        booking={selectedBooking}
        open={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
      />
    </div>
  )
}
