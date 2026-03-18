'use client'

import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getWeekBookings,
  getDayBookings,
  getMonthBookings,
  type CalendarBooking,
} from '@/features/calendar/services/calendar-actions'
import { BookingDetailSheet } from '@/features/calendar/components/booking-detail-sheet'
import { CalendarWeekView } from '@/features/calendar/components/calendar-week-view'
import { CalendarDayView } from '@/features/calendar/components/calendar-day-view'
import { CalendarMonthView } from '@/features/calendar/components/calendar-month-view'
import { ChevronLeft, ChevronRight, Calendar, Users } from 'lucide-react'
import { format, addDays, addMonths, startOfWeek, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

// Parse date string without timezone shift
function toDate(dateStr: string): Date {
  return parseISO(dateStr)
}

type ViewMode = 'day' | 'week' | 'month'

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

  const [view, setView] = useState<ViewMode>('week')
  const [initialized, setInitialized] = useState(false)

  // On mount, detect mobile and switch to day view + fetch day bookings
  useEffect(() => {
    if (!initialized && window.innerWidth < 768) {
      setView('day')
      fetchBookings(initialDate, 'day', 'all')
    }
    setInitialized(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredBookings = useMemo(() => {
    if (filterProfessional === 'all') return bookings
    return bookings.filter(b => b.professional_id === filterProfessional)
  }, [bookings, filterProfessional])

  // Fetch bookings when view or date changes
  async function fetchBookings(date: string, viewMode: ViewMode, profId?: string) {
    setLoading(true)
    const pid = isOwner ? (profId === 'all' ? undefined : profId) : undefined
    let data: CalendarBooking[]
    switch (viewMode) {
      case 'day':
        data = await getDayBookings(date, pid)
        break
      case 'month':
        data = await getMonthBookings(date, pid)
        break
      default:
        data = await getWeekBookings(date, pid)
    }
    setBookings(data)
    setLoading(false)
  }

  async function navigate(direction: 'prev' | 'next') {
    const d = toDate(currentDate)
    let newDate: string
    switch (view) {
      case 'day':
        newDate = format(addDays(d, direction === 'next' ? 1 : -1), 'yyyy-MM-dd')
        break
      case 'month':
        newDate = format(addMonths(d, direction === 'next' ? 1 : -1), 'yyyy-MM-dd')
        break
      default:
        newDate = format(addDays(d, direction === 'next' ? 7 : -7), 'yyyy-MM-dd')
    }
    setCurrentDate(newDate)
    await fetchBookings(newDate, view, filterProfessional)
  }

  async function goToToday() {
    const today = format(new Date(), 'yyyy-MM-dd')
    setCurrentDate(today)
    await fetchBookings(today, view, filterProfessional)
  }

  async function changeView(newView: ViewMode) {
    setView(newView)
    await fetchBookings(currentDate, newView, filterProfessional)
  }

  async function handleFilterChange(profId: string) {
    setFilterProfessional(profId)
    if (isOwner) {
      await fetchBookings(currentDate, view, profId)
    }
  }

  // When month view day is clicked, switch to day view
  async function handleMonthDayClick(dateStr: string) {
    setCurrentDate(dateStr)
    setView('day')
    await fetchBookings(dateStr, 'day', filterProfessional)
  }

  // Date label depends on view
  function getDateLabel(): string {
    const d = toDate(currentDate)
    switch (view) {
      case 'day':
        return format(d, "EEEE d 'de' MMMM", { locale: es })
      case 'month':
        return format(d, 'MMMM yyyy', { locale: es })
      default: {
        const ws = startOfWeek(d, { weekStartsOn: 1 })
        const we = addDays(ws, 6)
        return `${format(ws, 'd MMM', { locale: es })} — ${format(we, "d MMM yyyy", { locale: es })}`
      }
    }
  }

  const viewLabels: Record<ViewMode, string> = { day: 'Día', week: 'Semana', month: 'Mes' }

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

        {/* Controls row */}
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

          {/* View selector */}
          <div className="flex rounded-lg border border-border overflow-hidden h-9">
            {(['day', 'week', 'month'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => changeView(v)}
                className={`px-3 text-xs sm:text-sm font-medium transition-colors ${
                  view === v
                    ? 'bg-bella-rose-600 text-white'
                    : 'bg-white text-muted-foreground hover:bg-gray-50'
                } ${v !== 'day' ? 'border-l border-border' : ''}`}
              >
                {viewLabels[v]}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs sm:text-sm px-2.5"
              onClick={goToToday}
            >
              Hoy
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigate('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs sm:text-sm font-medium min-w-[120px] sm:min-w-[200px] text-center capitalize">
              {getDateLabel()}
            </span>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigate('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className={loading ? 'opacity-50 pointer-events-none' : ''}>
        {view === 'week' && (
          <CalendarWeekView
            bookings={filteredBookings}
            currentDate={currentDate}
            filterProfessional={filterProfessional}
            isOwner={isOwner}
            onSelectBooking={setSelectedBooking}
          />
        )}
        {view === 'day' && (
          <CalendarDayView
            bookings={filteredBookings}
            currentDate={currentDate}
            filterProfessional={filterProfessional}
            isOwner={isOwner}
            onSelectBooking={setSelectedBooking}
          />
        )}
        {view === 'month' && (
          <CalendarMonthView
            bookings={filteredBookings}
            currentDate={currentDate}
            onSelectDay={handleMonthDayClick}
            onSelectBooking={setSelectedBooking}
          />
        )}
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
