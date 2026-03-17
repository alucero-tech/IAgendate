'use client'

import { useMemo } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isToday, isSameMonth, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { CalendarBooking } from '../services/calendar-actions'
import { statusDotColors } from './calendar-constants'

interface Props {
  bookings: CalendarBooking[]
  currentDate: string
  onSelectDay: (date: string) => void
  onSelectBooking: (booking: CalendarBooking) => void
}

export function CalendarMonthView({ bookings, currentDate, onSelectDay, onSelectBooking }: Props) {
  const monthDate = parseISO(currentDate)
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  // Build weeks array
  const weeks = useMemo(() => {
    const result: Date[][] = []
    let current = calendarStart
    while (current <= calendarEnd) {
      const week: Date[] = []
      for (let i = 0; i < 7; i++) {
        week.push(current)
        current = addDays(current, 1)
      }
      result.push(week)
    }
    return result
  }, [calendarStart.getTime(), calendarEnd.getTime()])

  // Group bookings by date
  const bookingsByDate = useMemo(() => {
    const map: Record<string, CalendarBooking[]> = {}
    for (const b of bookings) {
      if (!map[b.booking_date]) map[b.booking_date] = []
      map[b.booking_date].push(b)
    }
    return map
  }, [bookings])

  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  return (
    <div className="border rounded-xl overflow-hidden bg-white/80">
      {/* Day names header */}
      <div className="grid grid-cols-7 border-b bg-white">
        {dayNames.map(name => (
          <div key={name} className="p-2 text-center text-xs font-medium text-muted-foreground">
            {name}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
          {week.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const dayBookings = bookingsByDate[dateStr] || []
            const inMonth = isSameMonth(day, monthDate)
            const today = isToday(day)
            const hasBookings = dayBookings.length > 0

            return (
              <div
                key={dateStr}
                className={`min-h-[80px] sm:min-h-[100px] p-1 sm:p-1.5 border-r last:border-r-0 cursor-pointer hover:bg-gray-50 transition-colors ${
                  !inMonth ? 'bg-gray-50/50' : ''
                } ${today ? 'bg-bella-rose-50/40' : ''}`}
                onClick={() => onSelectDay(dateStr)}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-xs sm:text-sm font-medium inline-flex items-center justify-center ${
                    today
                      ? 'bg-bella-rose-600 text-white rounded-full w-6 h-6 sm:w-7 sm:h-7 text-[11px] sm:text-xs'
                      : !inMonth
                      ? 'text-muted-foreground/40'
                      : ''
                  }`}>
                    {format(day, 'd')}
                  </span>
                  {hasBookings && (
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      {dayBookings.length}
                    </span>
                  )}
                </div>

                {/* Booking chips - desktop */}
                <div className="hidden sm:block space-y-0.5">
                  {dayBookings.slice(0, 3).map(booking => {
                    const dotColor = statusDotColors[booking.status] || 'bg-gray-400'
                    return (
                      <div
                        key={booking.id}
                        className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] hover:bg-gray-100 cursor-pointer truncate"
                        onClick={(e) => { e.stopPropagation(); onSelectBooking(booking) }}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                        <span className="truncate">
                          {booking.start_time.slice(0, 5)} {booking.client_name.split(' ')[0]}
                        </span>
                      </div>
                    )
                  })}
                  {dayBookings.length > 3 && (
                    <p className="text-[10px] text-muted-foreground px-1">
                      +{dayBookings.length - 3} más
                    </p>
                  )}
                </div>

                {/* Booking dots - mobile */}
                {hasBookings && (
                  <div className="flex gap-0.5 flex-wrap sm:hidden mt-0.5">
                    {dayBookings.slice(0, 4).map(booking => {
                      const dotColor = statusDotColors[booking.status] || 'bg-gray-400'
                      return (
                        <div key={booking.id} className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                      )
                    })}
                    {dayBookings.length > 4 && (
                      <span className="text-[8px] text-muted-foreground">+{dayBookings.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
