'use client'

import { useMemo } from 'react'
import { format, addDays, startOfWeek, isToday, parseISO } from 'date-fns'
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

export function CalendarWeekView({ bookings, currentDate, filterProfessional, isOwner, onSelectBooking }: Props) {
  const weekStart = startOfWeek(parseISO(currentDate), { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  function getBookingsForDayAndHour(date: Date, hour: number) {
    const dateStr = format(date, 'yyyy-MM-dd')
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
    return Math.max(durationMin / 60, 0.25)
  }

  function getBookingTop(booking: CalendarBooking) {
    const minutes = parseInt(booking.start_time.substring(3, 5))
    return (minutes / 60) * 100
  }

  return (
    <div className="border rounded-xl overflow-auto bg-white/80">
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
                        onClick={() => onSelectBooking(booking)}
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
  )
}
