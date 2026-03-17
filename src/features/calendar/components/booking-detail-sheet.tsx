'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Phone,
  MessageCircle,
  Mail,
  User,
  Scissors,
  Clock,
  CalendarDays,
  History,
  Plus,
  X,
  Loader2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { CalendarBooking, ClientHistoryBooking } from '../services/calendar-actions'
import { getClientBookingHistory } from '../services/calendar-actions'

interface Props {
  booking: CalendarBooking | null
  open: boolean
  onClose: () => void
}

function normalizePhoneForWhatsApp(phone: string): string {
  const clean = phone.replace(/[\s\-()]/g, '')
  if (clean.startsWith('+')) return clean.replace('+', '')
  if (clean.length === 10) return `549${clean}`
  return clean
}

function normalizePhoneForCall(phone: string): string {
  const clean = phone.replace(/[\s\-()]/g, '')
  if (clean.startsWith('+')) return clean
  if (clean.length === 10) return `+549${clean}`
  return `+${clean}`
}

const statusConfig: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Confirmado', color: 'bg-bella-rose-100 text-bella-rose-700' },
  rescheduled: { label: 'Reagendado', color: 'bg-bella-violet-100 text-bella-violet-700' },
  pending_payment: { label: 'Pago pendiente', color: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'En curso', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completado', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
}

export function BookingDetailSheet({ booking, open, onClose }: Props) {
  const [history, setHistory] = useState<ClientHistoryBooking[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    if (open && booking?.client_id) {
      setLoadingHistory(true)
      getClientBookingHistory(booking.client_id)
        .then(setHistory)
        .finally(() => setLoadingHistory(false))
    } else {
      setHistory([])
    }
  }, [open, booking?.client_id])

  if (!booking) return null

  const status = statusConfig[booking.status] || { label: booking.status, color: 'bg-gray-100 text-gray-700' }
  const dateLabel = format(parseISO(booking.booking_date), "EEEE d 'de' MMMM", { locale: es })
  const timeLabel = `${booking.start_time.slice(0, 5)} - ${booking.end_time.slice(0, 5)}`
  const waNumber = normalizePhoneForWhatsApp(booking.client_phone)
  const callNumber = normalizePhoneForCall(booking.client_phone)
  const waMessage = encodeURIComponent(`Hola ${booking.client_name.split(' ')[0]}, te escribimos de Bella Donna por tu turno del ${dateLabel}.`)

  // Filter out current booking from history
  const otherBookings = history.filter(h => h.id !== booking.booking_id)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Detalle del turno</SheetTitle>
        </SheetHeader>

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Client header */}
        <div className="px-5 pb-4 pt-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-bella-rose-100 flex items-center justify-center text-bella-rose-700 font-bold text-lg shrink-0">
              {booking.client_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg truncate">{booking.client_name}</h3>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {booking.client_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {booking.client_phone}
                  </span>
                )}
                {booking.client_email && (
                  <span className="flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{booking.client_email}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact actions */}
          {booking.client_phone && (
            <div className="flex gap-2 mt-3">
              <a
                href={`https://wa.me/${waNumber}?text=${waMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" className="w-full h-10 text-green-600 border-green-200 hover:bg-green-50">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
              </a>
              <a href={`tel:${callNumber}`} className="flex-1">
                <Button variant="outline" className="w-full h-10 text-bella-rose-600 border-bella-rose-200 hover:bg-bella-rose-50">
                  <Phone className="h-4 w-4 mr-2" />
                  Llamar
                </Button>
              </a>
            </div>
          )}
        </div>

        {/* Booking details */}
        <div className="border-t border-border px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Turno</h4>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <Scissors className="h-4 w-4 text-bella-violet-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{booking.treatment_name}</p>
                <p className="text-xs text-muted-foreground">{booking.category_name}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-bella-violet-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{booking.professional_name}</p>
                <p className="text-xs text-muted-foreground">Profesional</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CalendarDays className="h-4 w-4 text-bella-violet-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium capitalize">{dateLabel}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-bella-violet-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{timeLabel}</p>
              </div>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Historial del cliente
            </h4>
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : otherBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              Primer turno de este cliente
            </p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {otherBookings.map(h => {
                const hStatus = statusConfig[h.status]
                return (
                  <div key={h.id} className="flex items-center gap-3 py-1.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{h.treatment_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(h.booking_date), "d MMM", { locale: es })} · {h.start_time.slice(0, 5)} · {h.professional_name}
                      </p>
                    </div>
                    {hStatus && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${hStatus.color}`}>
                        {hStatus.label}
                      </span>
                    )}
                    <span className="text-xs font-medium shrink-0">
                      ${Math.round(h.amount_total).toLocaleString('es-AR')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-border px-5 py-4 pb-safe">
          <a href={`/reservar?phone=${encodeURIComponent(booking.client_phone)}`}>
            <Button className="w-full bg-bella-rose-600 hover:bg-bella-rose-700 h-11">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo turno para {booking.client_name.split(' ')[0]}
            </Button>
          </a>
        </div>
      </SheetContent>
    </Sheet>
  )
}
