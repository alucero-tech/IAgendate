'use client'

import { format, isToday, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { CalendarBooking } from '../services/calendar-actions'
import { HOURS, statusColors } from './calendar-constants'

interface Props {
  bookings: CalendarBooking[]
  currentDate: string
  filterProfessional: string
  isOwner: boolean
  onSelectBooking: (booking: CalendarBooking) => void
}

export function CalendarDayView({ bookings, currentDate, filterProfessional, isOwner, onSelectBooking }: Props) {
  const date = parseISO(currentDate)
  const dateStr = format(date, 'yyyy-MM-dd')
  const today = isToday(date)

  function getBookingsForHour(hour: number) {
    return bookings.filter(b => {
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
    return Math.max(durationMin / 60, 0.5)
  }

  function getBookingTop(booking: CalendarBooking) {
    const minutes = parseInt(booking.start_time.substring(3, 5))
    return (minutes / 60) * 100
  }

  return (
    <div className="border rounded-xl overflow-auto bg-white/80">
      {/* Day header */}
      <div className="border-b sticky top-0 bg-white z-10 px-4 py-3 flex items-center gap-3">
        <div className={`text-center ${today ? 'text-bella-rose-600' : ''}`}>
          <p className="text-xs text-muted-foreground capitalize">
            {format(date, 'EEEE', { locale: es })}
          </p>
          <p className={`text-2xl font-bold ${today ? 'bg-bella-rose-600 text-white rounded-full w-10 h-10 flex items-center justify-center mx-auto' : ''}`}>
            {format(date, 'd')}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(date, "MMMM yyyy", { locale: es })}
          </p>
        </div>
      </div>

      {/* Time slots */}
      {HOURS.map(hour => {
        const hourBookings = getBookingsForHour(hour)
        return (
          <div key={hour} className="flex border-b last:border-b-0">
            <div className="w-16 sm:w-20 p-2 text-xs text-muted-foreground text-right pr-3 border-r shrink-0">
              {hour.toString().padStart(2, '0')}:00
            </div>
            <div className={`flex-1 relative min-h-[70px] ${today ? 'bg-bella-rose-50/20' : ''}`}>
              {hourBookings.map((booking, idx) => {
                const height = getBookingHeight(booking)
                const top = getBookingTop(booking)
                const colors = statusColors[booking.status] || 'bg-gray-100 border-gray-300 text-gray-800'
                const total = hourBookings.length
                const widthPercent = total > 1 ? 100 / total : 100
                const leftPercent = total > 1 ? idx * widthPercent : 0

                return (
                  <div
                    key={booking.id}
                    className={`absolute rounded-lg border px-3 py-1.5 text-sm overflow-hidden cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all ${colors}`}
                    style={{
                      top: `${top}%`,
                      height: `${height * 70}px`,
                      minHeight: '32px',
                      left: `calc(${leftPercent}% + 4px)`,
                      width: `calc(${widthPercent}% - 8px)`,
                    }}
                    onClick={() => onSelectBooking(booking)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{booking.client_name}</span>
                      <span className="text-xs opacity-70 shrink-0">
                        {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                      </span>
                    </div>
                    <p className="truncate opacity-75 text-xs">{booking.treatment_name}</p>
                    {isOwner && filterProfessional === 'all' && (
                      <p className="truncate opacity-60 text-xs">{booking.professional_name}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
