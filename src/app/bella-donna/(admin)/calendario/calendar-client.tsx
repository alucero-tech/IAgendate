'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getWeekBookings, type CalendarBooking } from '@/features/calendar/services/calendar-actions'
import { ChevronLeft, ChevronRight, Calendar, Users, Clock, Phone, User, Scissors, X } from 'lucide-react'
import { format, addDays, startOfWeek, parseISO, isToday } from 'date-fns'
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
    return Math.max(durationMin / 60, 0.25) // mínimo 15 min = 0.25
  }

  function getBookingTop(booking: CalendarBooking) {
    const minutes = parseInt(booking.start_time.substring(3, 5))
    return (minutes / 60) * 100
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-8 w-8 text-bella-rose-500" />
          {isOwner ? 'Calendario Global' : 'Mi Calendario'}
        </h1>

        <div className="flex items-center gap-3">
          {/* Filtro de profesional (solo admin) */}
          {isOwner && professionals.length > 1 && (
            <Select value={filterProfessional} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[200px]">
                <Users className="h-4 w-4 mr-2" />
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

          {/* Navegación de semana */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[180px] text-center">
              {format(weekDays[0], "d MMM", { locale: es })} — {format(weekDays[6], "d MMM yyyy", { locale: es })}
            </span>
            <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className={`border rounded-xl overflow-auto bg-white/80 ${loading ? 'opacity-50' : ''}`}>
        <div className="min-w-[800px]">
          {/* Days header */}
          <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b sticky top-0 bg-white z-10">
            <div className="p-2 border-r" />
            {weekDays.map(day => (
              <div
                key={day.toISOString()}
                className={`p-2 text-center border-r last:border-r-0 ${
                  isToday(day) ? 'bg-bella-rose-50' : ''
                }`}
              >
                <p className="text-xs text-muted-foreground capitalize">
                  {format(day, 'EEE', { locale: es })}
                </p>
                <p className={`text-lg font-semibold ${
                  isToday(day) ? 'text-bella-rose-600' : ''
                }`}>
                  {format(day, 'd')}
                </p>
              </div>
            ))}
          </div>

          {/* Time slots */}
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-[80px_repeat(7,1fr)] border-b last:border-b-0">
              <div className="p-2 text-xs text-muted-foreground text-right pr-3 border-r">
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
                          className={`absolute rounded-md border px-1 py-0.5 text-xs overflow-hidden cursor-pointer hover:opacity-80 transition-opacity ${colors}`}
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
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-bella-rose-100 border border-bella-rose-300" />
          Confirmado
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-bella-violet-100 border border-bella-violet-300" />
          Reagendado
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-bella-gold-100 border border-bella-gold-300" />
          Pago pendiente
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
          Completado
        </div>
      </div>

      {/* Booking detail card */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setSelectedBooking(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl border border-bella-rose-100 w-full max-w-sm mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header with color */}
            <div className={`px-5 py-4 ${statusColors[selectedBooking.status]?.split(' ')[0] || 'bg-gray-100'}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">{selectedBooking.client_name}</h3>
                <button onClick={() => setSelectedBooking(null)} className="p-1 rounded-full hover:bg-black/10">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm opacity-80">
                {format(parseISO(selectedBooking.booking_date), "EEEE d 'de' MMMM", { locale: es })}
              </p>
            </div>

            {/* Content */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-bella-rose-500 flex-shrink-0" />
                <span className="font-medium">
                  {selectedBooking.start_time.substring(0, 5)} — {selectedBooking.end_time.substring(0, 5)}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Scissors className="h-4 w-4 text-bella-rose-500 flex-shrink-0" />
                <div>
                  <span className="font-medium">{selectedBooking.treatment_name}</span>
                  <span className="text-muted-foreground ml-1">({selectedBooking.category_name})</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-bella-rose-500 flex-shrink-0" />
                <span>{selectedBooking.professional_name}</span>
              </div>

              {selectedBooking.client_phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-bella-rose-500 flex-shrink-0" />
                  <a href={`tel:${selectedBooking.client_phone}`} className="text-bella-rose-600 hover:underline">
                    {selectedBooking.client_phone}
                  </a>
                </div>
              )}

              <div className="pt-2 border-t">
                <Badge className={`text-xs ${statusColors[selectedBooking.status] || ''}`}>
                  {selectedBooking.status === 'confirmed' && 'Confirmado'}
                  {selectedBooking.status === 'rescheduled' && 'Reagendado'}
                  {selectedBooking.status === 'pending_payment' && 'Pago pendiente'}
                  {selectedBooking.status === 'in_progress' && 'En curso'}
                  {selectedBooking.status === 'completed' && 'Completado'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
