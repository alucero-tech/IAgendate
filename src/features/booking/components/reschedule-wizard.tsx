'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Phone, Calendar, Clock, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react'
import {
  getBookingsByPhone,
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

type Step = 'phone' | 'bookings' | 'date' | 'time' | 'confirm' | 'done' | 'blocked'

export function RescheduleWizard({ tenantId }: { tenantId: string }) {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [clientName, setClientName] = useState('')
  const [bookings, setBookings] = useState<BookingData[]>([])
  const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null)
  const [availableDays, setAvailableDays] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([])
  const [selectedTime, setSelectedTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setStep('bookings')
    setLoading(false)
  }

  async function handleSelectBooking(booking: BookingData) {
    if (booking.rescheduleCount >= 1) {
      setSelectedBooking(booking)
      setStep('blocked')
      return
    }

    setSelectedBooking(booking)
    setLoading(true)

    // Get available days based on the professionals in the booking items
    const cartItems = booking.items.map(item => ({
      treatmentId: item.treatmentId,
      treatmentName: item.treatmentName,
      professionalId: item.professionalId,
      professionalName: item.professionalName,
      durationMinutes: item.durationMinutes,
      price: 0,
    }))

    // We need treatment IDs - fetch them via the booking items
    // For now, use getAvailableDays per professional
    const days = await getMultiServiceAvailableDays(cartItems, tenantId)
    setAvailableDays(days)
    setStep('date')
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
    setStep('time')
    setLoading(false)
  }

  async function handleSelectTime(time: string) {
    setSelectedTime(time)
    setStep('confirm')
  }

  async function handleConfirm() {
    if (!selectedBooking) return
    setLoading(true)
    setError(null)

    const result = await rescheduleBooking(selectedBooking.id, selectedDate, selectedTime)

    if ('error' in result && result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setStep('done')
    setLoading(false)
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-bella-rose-100 p-6 space-y-6">
      {/* Step: Phone */}
      {step === 'phone' && (
        <>
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-bella-rose-100 rounded-full flex items-center justify-center mx-auto">
              <Phone className="w-7 h-7 text-bella-rose-600" />
            </div>
            <h2 className="text-xl font-bold">Reagendar turno</h2>
            <p className="text-sm text-muted-foreground">Ingresá tu celular para ver tus turnos</p>
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
            {loading ? 'Buscando...' : 'Buscar mis turnos'}
          </Button>
        </>
      )}

      {/* Step: Select booking */}
      {step === 'bookings' && (
        <>
          <div className="space-y-1">
            <button onClick={() => setStep('phone')} className="text-sm text-bella-rose-600 flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Volver
            </button>
            <h2 className="text-lg font-bold">Hola {clientName}</h2>
            <p className="text-sm text-muted-foreground">Seleccioná el turno que querés reagendar</p>
          </div>

          <div className="space-y-3">
            {bookings.map(b => (
              <button
                key={b.id}
                onClick={() => handleSelectBooking(b)}
                disabled={loading}
                className="w-full text-left rounded-xl border border-border/50 p-4 hover:bg-bella-rose-50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-bella-rose-500" />
                    <span className="font-semibold">
                      {format(parseISO(b.date), "EEEE d 'de' MMMM", { locale: es })}
                    </span>
                  </div>
                  <Badge variant={b.rescheduleCount >= 1 ? 'destructive' : 'outline'} className="text-xs">
                    {b.rescheduleCount >= 1 ? 'Ya reagendado' : b.status === 'rescheduled' ? 'Reagendado' : 'Confirmado'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Clock className="h-3.5 w-3.5" />
                  {b.startTime.substring(0, 5)} - {b.endTime.substring(0, 5)}
                </div>
                {b.items.map(item => (
                  <div key={item.id} className="text-sm bg-muted/30 rounded-lg px-3 py-1.5 mb-1">
                    <span className="text-muted-foreground">{item.categoryName}:</span>{' '}
                    <span className="font-medium">{item.treatmentName}</span>
                    <span className="text-xs text-muted-foreground ml-2">con {item.professionalName}</span>
                  </div>
                ))}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step: Blocked (already rescheduled) */}
      {step === 'blocked' && (
        <>
          <div className="text-center space-y-3">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-red-700">No podés reagendar</h2>
            <p className="text-sm text-muted-foreground">
              Ya reagendaste este turno una vez. No es posible reagendar nuevamente.
              <br />
              <span className="font-semibold text-red-600">Perdés la reserva y la seña.</span>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Si necesitás ayuda, contactanos por teléfono.
            </p>
          </div>
          <Button
            onClick={() => { setStep('bookings'); setSelectedBooking(null) }}
            variant="outline"
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver a mis turnos
          </Button>
        </>
      )}

      {/* Step: Select date */}
      {step === 'date' && (
        <>
          <div className="space-y-1">
            <button onClick={() => { setStep('bookings'); setSelectedBooking(null) }} className="text-sm text-bella-rose-600 flex items-center gap-1">
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

      {/* Step: Select time */}
      {step === 'time' && (
        <>
          <div className="space-y-1">
            <button onClick={() => setStep('date')} className="text-sm text-bella-rose-600 flex items-center gap-1">
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
                  onClick={() => handleSelectTime(slot.time)}
                  className="rounded-xl border border-border/50 p-3 hover:bg-bella-rose-50 hover:border-bella-rose-300 transition-colors text-center font-medium text-sm"
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && selectedBooking && (
        <>
          <div className="space-y-1">
            <button onClick={() => setStep('time')} className="text-sm text-bella-rose-600 flex items-center gap-1">
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
            onClick={handleConfirm}
            disabled={loading}
            className="w-full bg-bella-rose-600 hover:bg-bella-rose-700"
          >
            {loading ? 'Reagendando...' : 'Confirmar reagendamiento'}
          </Button>
        </>
      )}

      {/* Step: Done */}
      {step === 'done' && (
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
