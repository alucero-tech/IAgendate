'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Phone, Calendar, Clock, ArrowLeft, CheckCircle, AlertTriangle, X,
  RefreshCw, Ban,
} from 'lucide-react'
import {
  getBookingsByPhone,
  cancelBookingByClient,
  getMultiServiceAvailableDays,
  getMultiServiceSlots,
  rescheduleBooking,
} from '@/features/booking/services/booking-actions'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

interface BookingData {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
  rescheduleCount: number
  total: number
  items: {
    id: string
    treatmentId: string
    treatmentName: string
    categoryName: string
    professionalName: string
    professionalId: string
    durationMinutes: number
    startTime: string
    endTime: string
  }[]
}

type Step =
  | 'phone'
  | 'bookings'
  | 'detail'
  | 'cancel-confirm'
  | 'cancelled'
  | 'reschedule-date'
  | 'reschedule-time'
  | 'reschedule-confirm'
  | 'rescheduled'

interface MyBookingPortalProps {
  storePhone: string
  storeName: string
  tenantId: string
}

export function MyBookingPortal({ storePhone, storeName, tenantId }: MyBookingPortalProps) {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [clientName, setClientName] = useState('')
  const [bookings, setBookings] = useState<BookingData[]>([])
  const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reschedule state
  const [availableDays, setAvailableDays] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([])
  const [selectedTime, setSelectedTime] = useState('')

  async function handleSearchPhone() {
    if (!phone.trim()) {
      setError('Ingresá tu número de celular')
      return
    }
    setLoading(true)
    setError(null)

    const result = await getBookingsByPhone(phone.trim())

    if ('error' in result) {
      setError(result.error as string)
      setLoading(false)
      return
    }

    setClientName(result.client!.name)
    setBookings(result.bookings!)

    if (result.bookings!.length === 1) {
      setSelectedBooking(result.bookings![0])
      setStep('detail')
    } else {
      setStep('bookings')
    }
    setLoading(false)
  }

  function handleSelectBooking(booking: BookingData) {
    setSelectedBooking(booking)
    setStep('detail')
  }

  // ---- Cancel flow ----
  async function handleCancelConfirm() {
    if (!selectedBooking) return
    setLoading(true)
    setError(null)

    const result = await cancelBookingByClient(selectedBooking.id, phone)

    if ('error' in result && result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setStep('cancelled')
    setLoading(false)
  }

  // ---- Reschedule flow ----
  async function handleStartReschedule() {
    if (!selectedBooking) return

    if (selectedBooking.rescheduleCount >= 1) {
      setError('Ya reagendaste este turno una vez. No es posible reagendar nuevamente.')
      return
    }

    setLoading(true)
    setError(null)

    const cartItems = selectedBooking.items.map(item => ({
      treatmentId: item.treatmentId,
      treatmentName: item.treatmentName,
      professionalId: item.professionalId,
      professionalName: item.professionalName,
      durationMinutes: item.durationMinutes,
      price: 0,
    }))

    const days = await getMultiServiceAvailableDays(cartItems, tenantId)
    setAvailableDays(days)
    setStep('reschedule-date')
    setLoading(false)
  }

  async function handleSelectDate(date: string) {
    setSelectedDate(date)
    setLoading(true)

    if (!selectedBooking) return

    const cartItems = selectedBooking.items.map(item => ({
      treatmentId: item.treatmentId,
      treatmentName: item.treatmentName,
      professionalId: item.professionalId,
      professionalName: item.professionalName,
      durationMinutes: item.durationMinutes,
      price: 0,
    }))

    const availableSlots = await getMultiServiceSlots(cartItems, date, tenantId)
    setSlots(availableSlots)
    setStep('reschedule-time')
    setLoading(false)
  }

  async function handleConfirmReschedule() {
    if (!selectedBooking) return
    setLoading(true)
    setError(null)

    const result = await rescheduleBooking(selectedBooking.id, selectedDate, selectedTime)

    if ('error' in result && result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setStep('rescheduled')
    setLoading(false)
  }

  const statusLabels: Record<string, string> = {
    confirmed: 'Confirmado',
    rescheduled: 'Reagendado',
    pending_payment: 'Pendiente de pago',
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-bella-rose-100 p-6 space-y-6">

      {/* ===== STEP: Phone ===== */}
      {step === 'phone' && (
        <>
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-bella-rose-100 rounded-full flex items-center justify-center mx-auto">
              <Phone className="w-7 h-7 text-bella-rose-600" />
            </div>
            <h2 className="text-xl font-bold">Mi Turno</h2>
            <p className="text-sm text-muted-foreground">
              Ingresá tu celular para ver tu reserva
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="phone">Número de celular</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Ej: 1155667788"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearchPhone() }}
            />
          </div>

          <Button
            onClick={handleSearchPhone}
            disabled={loading}
            className="w-full bg-bella-rose-600 hover:bg-bella-rose-700"
          >
            {loading ? 'Buscando...' : 'Ver mi turno'}
          </Button>
        </>
      )}

      {/* ===== STEP: Select booking (multiple) ===== */}
      {step === 'bookings' && (
        <>
          <div className="space-y-1">
            <button onClick={() => setStep('phone')} className="text-sm text-bella-rose-600 flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Volver
            </button>
            <h2 className="text-lg font-bold">Hola {clientName}</h2>
            <p className="text-sm text-muted-foreground">Tenés {bookings.length} turnos activos</p>
          </div>

          <div className="space-y-3">
            {bookings.map(b => (
              <button
                key={b.id}
                onClick={() => handleSelectBooking(b)}
                className="w-full text-left rounded-xl border border-border/50 p-4 hover:bg-bella-rose-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-bella-rose-500" />
                    <span className="font-semibold">
                      {format(parseISO(b.date), "EEEE d 'de' MMMM", { locale: es })}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {statusLabels[b.status] || b.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {b.startTime.substring(0, 5)} - {b.endTime.substring(0, 5)}
                </div>
                {b.items.map(item => (
                  <div key={item.id} className="text-sm bg-muted/30 rounded-lg px-3 py-1.5 mt-1">
                    <span className="font-medium">{item.treatmentName}</span>
                    <span className="text-xs text-muted-foreground ml-2">con {item.professionalName}</span>
                  </div>
                ))}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ===== STEP: Booking detail ===== */}
      {step === 'detail' && selectedBooking && (
        <>
          <div className="space-y-1">
            {bookings.length > 1 && (
              <button onClick={() => setStep('bookings')} className="text-sm text-bella-rose-600 flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Mis turnos
              </button>
            )}
            {bookings.length <= 1 && (
              <button onClick={() => setStep('phone')} className="text-sm text-bella-rose-600 flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Volver
              </button>
            )}
            <h2 className="text-lg font-bold">Tu turno</h2>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Booking card */}
          <div className="bg-muted/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-bella-rose-500" />
                <span className="font-semibold">
                  {format(parseISO(selectedBooking.date), "EEEE d 'de' MMMM", { locale: es })}
                </span>
              </div>
              <Badge variant="outline" className="text-xs">
                {statusLabels[selectedBooking.status] || selectedBooking.status}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {selectedBooking.startTime.substring(0, 5)} - {selectedBooking.endTime.substring(0, 5)}
            </div>

            <div className="border-t pt-3 space-y-2">
              {selectedBooking.items.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{item.treatmentName}</span>
                    <span className="text-xs text-muted-foreground ml-2">con {item.professionalName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.startTime.substring(0, 5)} - {item.endTime.substring(0, 5)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t pt-2 flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span>${selectedBooking.total.toLocaleString('es-AR')}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              onClick={handleStartReschedule}
              disabled={loading || selectedBooking.rescheduleCount >= 1}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {selectedBooking.rescheduleCount >= 1 ? 'Ya reagendaste este turno' : 'Reagendar'}
            </Button>

            <Button
              onClick={() => { setError(null); setStep('cancel-confirm') }}
              variant="outline"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Ban className="h-4 w-4 mr-2" />
              Cancelar turno
            </Button>
          </div>

          {selectedBooking.rescheduleCount >= 1 && (
            <p className="text-xs text-amber-600 text-center">
              Ya usaste tu reagendamiento gratuito. Si necesitás cambiar la fecha, contactanos.
            </p>
          )}
        </>
      )}

      {/* ===== STEP: Cancel confirmation ===== */}
      {step === 'cancel-confirm' && selectedBooking && (
        <>
          <div className="text-center space-y-3">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-red-700">¿Cancelar turno?</h2>
            <p className="text-sm text-muted-foreground">
              Tu turno del{' '}
              <span className="font-semibold">
                {format(parseISO(selectedBooking.date), "EEEE d 'de' MMMM", { locale: es })}
              </span>{' '}
              a las <span className="font-semibold">{selectedBooking.startTime.substring(0, 5)}hs</span>
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            <p className="font-semibold mb-1">Política de cancelación:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Podés cancelar hasta 48hs antes del turno</li>
              <li>La seña <span className="font-semibold">no se reembolsa</span></li>
              <li>Con menos de 48hs de anticipación, contactanos por WhatsApp</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => { setError(null); setStep('detail') }}
              variant="outline"
              className="flex-1"
            >
              No, volver
            </Button>
            <Button
              onClick={handleCancelConfirm}
              disabled={loading}
              variant="destructive"
              className="flex-1"
            >
              {loading ? 'Cancelando...' : 'Sí, cancelar'}
            </Button>
          </div>
        </>
      )}

      {/* ===== STEP: Cancelled success ===== */}
      {step === 'cancelled' && (
        <div className="text-center space-y-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <X className="w-7 h-7 text-red-600" />
          </div>
          <h2 className="text-xl font-bold">Turno cancelado</h2>
          <p className="text-sm text-muted-foreground">
            Tu turno fue cancelado exitosamente. La seña no será reembolsada según nuestra política.
          </p>
          <Button
            onClick={() => window.location.href = '/reservar'}
            className="w-full bg-bella-rose-600 hover:bg-bella-rose-700"
          >
            Reservar nuevo turno
          </Button>
        </div>
      )}

      {/* ===== RESCHEDULE: Select date ===== */}
      {step === 'reschedule-date' && (
        <>
          <div className="space-y-1">
            <button onClick={() => { setStep('detail'); setError(null) }} className="text-sm text-bella-rose-600 flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Volver
            </button>
            <h2 className="text-lg font-bold">Elegí nueva fecha</h2>
            <p className="text-sm text-muted-foreground">Próximos días disponibles</p>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-8">Buscando disponibilidad...</p>
          ) : availableDays.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay días disponibles en las próximas 2 semanas</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {availableDays.map(day => (
                <button
                  key={day}
                  onClick={() => handleSelectDate(day)}
                  className="rounded-xl border border-border/50 p-3 hover:bg-bella-rose-50 hover:border-bella-rose-300 transition-colors text-center"
                >
                  <p className="font-semibold text-sm">
                    {format(parseISO(day), 'EEEE', { locale: es })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(day), "d 'de' MMMM", { locale: es })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== RESCHEDULE: Select time ===== */}
      {step === 'reschedule-time' && (
        <>
          <div className="space-y-1">
            <button onClick={() => setStep('reschedule-date')} className="text-sm text-bella-rose-600 flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Volver
            </button>
            <h2 className="text-lg font-bold">Elegí horario</h2>
            <p className="text-sm text-muted-foreground">
              {format(parseISO(selectedDate), "EEEE d 'de' MMMM", { locale: es })}
            </p>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-8">Cargando horarios...</p>
          ) : slots.filter(s => s.available).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay horarios disponibles este día</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.filter(s => s.available).map(slot => (
                <button
                  key={slot.time}
                  onClick={() => { setSelectedTime(slot.time); setStep('reschedule-confirm') }}
                  className="rounded-xl border border-border/50 p-3 hover:bg-bella-rose-50 hover:border-bella-rose-300 transition-colors text-center font-medium text-sm"
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== RESCHEDULE: Confirm ===== */}
      {step === 'reschedule-confirm' && selectedBooking && (
        <>
          <div className="space-y-1">
            <button onClick={() => setStep('reschedule-time')} className="text-sm text-bella-rose-600 flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Volver
            </button>
            <h2 className="text-lg font-bold">Confirmar reagendamiento</h2>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="bg-muted/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Fecha anterior</span>
              <span className="line-through text-muted-foreground">
                {format(parseISO(selectedBooking.date), "d MMM yyyy", { locale: es })} {selectedBooking.startTime.substring(0, 5)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-bella-rose-600">Nueva fecha</span>
              <span className="font-semibold">
                {format(parseISO(selectedDate), "d MMM yyyy", { locale: es })} {selectedTime}
              </span>
            </div>
            <div className="border-t pt-2">
              {selectedBooking.items.map(item => (
                <div key={item.id} className="text-sm py-1">
                  <span className="font-medium">{item.treatmentName}</span>
                  <span className="text-xs text-muted-foreground ml-2">con {item.professionalName}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            Solo podés reagendar 1 vez. Después de confirmar, no podrás volver a cambiar la fecha.
          </div>

          <Button
            onClick={handleConfirmReschedule}
            disabled={loading}
            className="w-full bg-bella-rose-600 hover:bg-bella-rose-700"
          >
            {loading ? 'Reagendando...' : 'Confirmar reagendamiento'}
          </Button>
        </>
      )}

      {/* ===== RESCHEDULE: Done ===== */}
      {step === 'rescheduled' && (
        <div className="text-center space-y-4">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-green-700">Turno reagendado</h2>
          <p className="text-sm text-muted-foreground">
            Tu nuevo turno es el{' '}
            <span className="font-semibold">
              {format(parseISO(selectedDate), "EEEE d 'de' MMMM", { locale: es })}
            </span>{' '}
            a las <span className="font-semibold">{selectedTime}hs</span>
          </p>
          <Button
            onClick={() => window.location.href = '/reservar'}
            variant="outline"
            className="w-full"
          >
            Volver al inicio
          </Button>
        </div>
      )}
    </div>
  )
}
