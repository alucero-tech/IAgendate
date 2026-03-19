'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  getAllTreatmentsGrouped,
  getProfessionalsForTreatment,
  getMultiServiceAvailableDays,
  getMultiServiceSlots,
  createMultiBooking,
} from '../services/booking-actions'
import {
  Scissors,
  User,
  Calendar,
  Clock,
  CreditCard,
  ChevronLeft,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  ShoppingCart,
  Bell,
} from 'lucide-react'
import { usePushSubscription } from '@/shared/hooks/use-push-subscription'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

type Category = { id: string; name: string; description: string | null }
type Treatment = { id: string; name: string; description: string | null; duration_minutes: number; price: number; category_id: string }
type CategoryWithTreatments = Category & { treatments: Treatment[] }
type Professional = { id: string; first_name: string; last_name: string }
type Slot = { time: string; available: boolean }

type CartItem = {
  treatmentId: string
  treatmentName: string
  categoryName: string
  professionalId: string
  professionalName: string
  durationMinutes: number
  price: number
}

type Step = 'services' | 'professionals' | 'datetime' | 'info' | 'payment' | 'confirm' | 'success'

export function BookingWizard({ categories, depositPercentage = 50, transferAlias = '', tenantId, slug }: { categories: Category[]; depositPercentage?: number; transferAlias?: string; tenantId: string; slug: string }) {
  const [step, setStep] = useState<Step>('services')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // All treatments grouped
  const [groupedTreatments, setGroupedTreatments] = useState<CategoryWithTreatments[]>([])
  const [treatmentsLoaded, setTreatmentsLoaded] = useState(false)

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [pendingTreatment, setPendingTreatment] = useState<Treatment | null>(null)
  const [pendingCategoryName, setPendingCategoryName] = useState('')
  const [professionals, setProfessionals] = useState<Professional[]>([])

  // Which cart item needs a professional assignment
  const [assigningIndex, setAssigningIndex] = useState<number>(-1)

  // DateTime
  const [availableDays, setAvailableDays] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'mercadopago' | 'transfer'>('mercadopago')

  // Client info
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // Result
  const [bookingResult, setBookingResult] = useState<{
    bookingId: string
    depositAmount: number
    paymentMethod: string
  } | null>(null)

  // Push notifications
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, subscribe: pushSubscribe } = usePushSubscription()
  const [pushAsked, setPushAsked] = useState(false)

  // Load all treatments on first render
  async function loadTreatments() {
    if (treatmentsLoaded) return
    setLoading(true)
    const data = await getAllTreatmentsGrouped(tenantId)
    setGroupedTreatments(data)
    setTreatmentsLoaded(true)
    setLoading(false)
  }

  // Add treatment to cart (needs professional assignment)
  async function addTreatment(treatment: Treatment, categoryName: string) {
    setPendingTreatment(treatment)
    setPendingCategoryName(categoryName)
    setLoading(true)
    const profs = await getProfessionalsForTreatment(treatment.id, tenantId)
    setProfessionals(profs)
    setLoading(false)

    if (profs.length === 1) {
      // Auto-assign the only professional
      addToCart(treatment, categoryName, profs[0])
    } else if (profs.length === 0) {
      setError('No hay profesionales disponibles para este servicio')
    } else {
      setAssigningIndex(-1) // new item
      setStep('professionals')
    }
  }

  function addToCart(treatment: Treatment, categoryName: string, professional: Professional | 'any') {
    const isAny = professional === 'any'
    const newItem: CartItem = {
      treatmentId: treatment.id,
      treatmentName: treatment.name,
      categoryName,
      professionalId: isAny ? 'any' : professional.id,
      professionalName: isAny ? 'Cualquiera disponible' : `${professional.first_name} ${professional.last_name}`,
      durationMinutes: treatment.duration_minutes,
      price: treatment.price,
    }
    setCart(prev => [...prev, newItem])
    setPendingTreatment(null)
    setError(null)
    setStep('services')
  }

  function removeFromCart(index: number) {
    setCart(prev => prev.filter((_, i) => i !== index))
  }

  async function goToDateTime() {
    if (cart.length === 0) {
      setError('Agregá al menos un servicio')
      return
    }
    setLoading(true)
    setError(null)
    const days = await getMultiServiceAvailableDays(cart, tenantId)
    setAvailableDays(days)
    setSelectedDate(null)
    setSelectedTime(null)
    setLoading(false)
    setStep('datetime')
  }

  async function selectDate(dateStr: string) {
    setSelectedDate(dateStr)
    setSelectedTime(null)
    setLoading(true)
    const s = await getMultiServiceSlots(cart, dateStr, tenantId)
    setSlots(s)
    setLoading(false)
  }

  function selectTime(time: string) {
    setSelectedTime(time)
    setStep('info')
  }

  function goToPayment() {
    if (!firstName || !lastName || !phone) {
      setError('Completá nombre, apellido y celular')
      return
    }
    if (!/^\d{10}$/.test(phone)) {
      setError('El celular debe tener 10 dígitos (ej: 1122334455)')
      return
    }
    setError(null)
    setStep('payment')
  }

  function goToConfirm() {
    setError(null)
    setStep('confirm')
  }

  async function handleConfirm() {
    setLoading(true)
    setError(null)

    const result = await createMultiBooking({
      firstName,
      lastName,
      phone,
      email,
      date: selectedDate!,
      startTime: selectedTime!,
      paymentMethod,
      items: cart.map(item => ({
        treatmentId: item.treatmentId,
        professionalId: item.professionalId,
        durationMinutes: item.durationMinutes,
        price: item.price,
      })),
      tenantId,
      slug,
    })

    if ('error' in result && result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if ('success' in result && result.success) {
      const bookingData = {
        bookingId: result.bookingId!,
        depositAmount: result.depositAmount!,
        paymentMethod: result.paymentMethod!,
      }

      if (bookingData.paymentMethod === 'mercadopago') {
        try {
          const mpResponse = await fetch('/api/mercadopago', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: bookingData.bookingId }),
          })
          const mpData = await mpResponse.json()
          if (mpData.initPoint) {
            window.location.href = mpData.initPoint
            return
          }
        } catch {
          // fallback to success screen
        }
      }

      setBookingResult(bookingData)
      setStep('success')
    }
    setLoading(false)
  }

  function goBack() {
    const stepOrder: Step[] = ['services', 'professionals', 'datetime', 'info', 'payment', 'confirm']
    const currentIdx = stepOrder.indexOf(step)
    if (step === 'professionals') {
      setPendingTreatment(null)
      setStep('services')
    } else if (currentIdx > 0) {
      setStep(stepOrder[currentIdx - 1])
    }
  }

  const totalPrice = cart.reduce((sum, i) => sum + i.price, 0)
  const totalDeposit = cart.reduce((sum, i) => sum + Math.ceil(i.price * depositPercentage / 100), 0)
  const totalDuration = cart.reduce((sum, i) => sum + i.durationMinutes, 0)

  const stepNumber = {
    services: 1, professionals: 2, datetime: 3, info: 4, payment: 5, confirm: 6, success: 7
  }[step]

  // Load treatments on mount
  useEffect(() => {
    if (!treatmentsLoaded && step === 'services') {
      loadTreatments()
    }
  }, [treatmentsLoaded, step])

  return (
    <div className="space-y-6">
      {/* Progress */}
      {step !== 'success' && (
        <div className="flex items-center gap-2">
          {step !== 'services' && (
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1 flex gap-1">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  n <= stepNumber ? 'bg-bella-rose-500' : 'bg-border'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-bella-rose-500" />
        </div>
      )}

      {/* STEP 1: Selección de servicios (carrito) */}
      {step === 'services' && !loading && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Scissors className="h-5 w-5 text-bella-rose-500" />
            ¿Qué querés hacerte?
          </h2>
          <p className="text-sm text-muted-foreground">
            Podés agregar varios servicios a tu reserva
          </p>

          {/* Cart summary */}
          {cart.length > 0 && (
            <div className="rounded-xl border border-bella-rose-200 bg-bella-rose-50/50 p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-bella-rose-500" />
                Tu reserva ({cart.length} {cart.length === 1 ? 'servicio' : 'servicios'})
              </p>
              {cart.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{item.treatmentName}</span>
                    <span className="text-muted-foreground"> con {item.professionalName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">${item.price.toLocaleString('es-AR')}</span>
                    <button onClick={() => removeFromCart(idx)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <hr className="border-bella-rose-200" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Seña ({depositPercentage}%)</span>
                <span className="font-bold text-bella-rose-600">${totalDeposit.toLocaleString('es-AR')}</span>
              </div>
            </div>
          )}

          {/* Treatments grouped by category */}
          {groupedTreatments.map(cat => (
            <div key={cat.id} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {cat.name}
              </h3>
              <div className="grid gap-2">
                {cat.treatments.map(treat => {
                  const inCart = cart.some(c => c.treatmentId === treat.id)
                  return (
                    <button
                      key={treat.id}
                      onClick={() => !inCart && addTreatment(treat, cat.name)}
                      disabled={inCart}
                      className={`text-left rounded-xl border p-4 transition-colors ${
                        inCart
                          ? 'border-bella-rose-300 bg-bella-rose-50 opacity-60'
                          : 'border-border/50 bg-white/80 hover:border-bella-rose-300 hover:bg-bella-rose-50/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{treat.name}</p>
                            {inCart && <Badge variant="secondary" className="text-xs">Agregado</Badge>}
                          </div>
                          {treat.description && (
                            <p className="text-sm text-muted-foreground mt-1">{treat.description}</p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-semibold text-bella-rose-600">
                            ${treat.price.toLocaleString('es-AR')}
                          </p>
                          <p className="text-xs text-muted-foreground">{treat.duration_minutes} min</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {cart.length > 0 && (
            <Button
              onClick={goToDateTime}
              className="w-full bg-bella-rose-600 hover:bg-bella-rose-700 py-6"
            >
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Elegir día y horario
              </span>
            </Button>
          )}
        </div>
      )}

      {/* STEP 2: Elegir profesional para tratamiento pendiente */}
      {step === 'professionals' && !loading && pendingTreatment && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <User className="h-5 w-5 text-bella-violet-500" />
            ¿Con quién querés hacerte {pendingTreatment.name.toLowerCase()}?
          </h2>
          <div className="grid gap-3">
            <button
              onClick={() => addToCart(pendingTreatment, pendingCategoryName, 'any')}
              className="text-left rounded-xl border-2 border-dashed border-bella-violet-300 bg-bella-violet-50/30 backdrop-blur-sm p-4 hover:border-bella-violet-400 hover:bg-bella-violet-50/60 transition-colors"
            >
              <p className="font-medium text-bella-violet-700">Cualquiera disponible</p>
              <p className="text-xs text-muted-foreground mt-0.5">El sistema elige según disponibilidad</p>
            </button>
            {professionals.map(prof => (
              <button
                key={prof.id}
                onClick={() => addToCart(pendingTreatment, pendingCategoryName, prof)}
                className="text-left rounded-xl border border-border/50 bg-white/80 backdrop-blur-sm p-4 hover:border-bella-violet-300 hover:bg-bella-violet-50/50 transition-colors"
              >
                <p className="font-medium">{prof.first_name} {prof.last_name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: Fecha y Hora */}
      {step === 'datetime' && !loading && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-bella-violet-500" />
            Elegí día y horario
          </h2>

          {/* Summary badges */}
          <div className="flex flex-wrap gap-2">
            {cart.map((item, idx) => (
              <Badge key={idx} variant="secondary">
                {item.treatmentName} con {item.professionalName}
              </Badge>
            ))}
          </div>

          {/* Available days */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Días disponibles</p>
            <div className="flex flex-wrap gap-2">
              {availableDays.map(day => {
                const date = parseISO(day)
                const isSelected = selectedDate === day
                return (
                  <button
                    key={day}
                    onClick={() => selectDate(day)}
                    className={`rounded-xl border px-4 py-3 text-center transition-colors min-w-[90px] ${
                      isSelected
                        ? 'border-bella-rose-500 bg-bella-rose-50 text-bella-rose-700'
                        : 'border-border/50 bg-white/80 hover:border-bella-rose-300'
                    }`}
                  >
                    <p className="text-xs text-muted-foreground capitalize">
                      {format(date, 'EEE', { locale: es })}
                    </p>
                    <p className="font-semibold">{format(date, 'd')}</p>
                    <p className="text-xs capitalize">{format(date, 'MMM', { locale: es })}</p>
                  </button>
                )
              })}
            </div>
            {availableDays.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No hay días disponibles en las próximas 2 semanas para todos los servicios
              </p>
            )}
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horarios para el {format(parseISO(selectedDate), "d 'de' MMMM", { locale: es })}
              </p>
              <div className="flex flex-wrap gap-2">
                {slots.filter(s => s.available).map(slot => (
                  <button
                    key={slot.time}
                    onClick={() => selectTime(slot.time)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      selectedTime === slot.time
                        ? 'border-bella-rose-500 bg-bella-rose-50 text-bella-rose-700'
                        : 'border-border/50 bg-white/80 hover:border-bella-rose-300'
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
              {slots.filter(s => s.available).length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No hay horarios disponibles este día. Probá otro día.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 4: Datos personales */}
      {step === 'info' && !loading && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <User className="h-5 w-5 text-bella-violet-500" />
            Tus datos
          </h2>

          <div className="rounded-xl border border-border/50 bg-white/80 backdrop-blur-sm p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Celular *</Label>
              <Input
                id="phone"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="11 1234-5678"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (opcional)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
              />
            </div>
          </div>

          <Button
            onClick={goToPayment}
            className="w-full bg-bella-rose-600 hover:bg-bella-rose-700 py-6"
          >
            Elegir método de pago
          </Button>
        </div>
      )}

      {/* STEP 5: Método de pago */}
      {step === 'payment' && !loading && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-bella-gold-500" />
            ¿Cómo querés pagar la seña?
          </h2>
          <p className="text-sm text-muted-foreground">
            Seña a abonar: <span className="font-semibold text-bella-rose-600">${totalDeposit.toLocaleString('es-AR')}</span>
          </p>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => setPaymentMethod('mercadopago')}
              className={`rounded-xl border p-5 text-left transition-colors ${
                paymentMethod === 'mercadopago'
                  ? 'border-bella-rose-500 bg-bella-rose-50 ring-1 ring-bella-rose-500'
                  : 'border-border/50 bg-white/80 hover:border-bella-rose-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Tarjeta / Mercado Pago</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Débito, crédito o saldo MP · Confirmación automática</p>
                </div>
                {paymentMethod === 'mercadopago' && (
                  <CheckCircle2 className="h-5 w-5 text-bella-rose-500 shrink-0" />
                )}
              </div>
            </button>

            <button
              onClick={() => setPaymentMethod('transfer')}
              className={`rounded-xl border p-5 text-left transition-colors ${
                paymentMethod === 'transfer'
                  ? 'border-bella-rose-500 bg-bella-rose-50 ring-1 ring-bella-rose-500'
                  : 'border-border/50 bg-white/80 hover:border-bella-rose-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Transferencia bancaria</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Confirmación manual por el local</p>
                </div>
                {paymentMethod === 'transfer' && (
                  <CheckCircle2 className="h-5 w-5 text-bella-rose-500 shrink-0" />
                )}
              </div>
            </button>
          </div>

          {/* Bank details preview — only when transfer selected */}
          {paymentMethod === 'transfer' && (
            <div className="rounded-xl border border-bella-gold-200 bg-bella-gold-50 p-5 space-y-2">
              <p className="font-semibold text-sm text-bella-gold-800 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Datos para la transferencia
              </p>
              <p className="text-sm text-bella-gold-900">
                Monto: <span className="font-bold">${totalDeposit.toLocaleString('es-AR')}</span>
              </p>
              {transferAlias ? (
                <p className="text-sm text-bella-gold-900">
                  Alias / CBU: <span className="font-bold font-mono">{transferAlias}</span>
                </p>
              ) : (
                <p className="text-xs text-bella-gold-700">
                  El local te enviará los datos de transferencia al confirmar la reserva.
                </p>
              )}
              <p className="text-xs text-bella-gold-700 mt-1">
                Enviá el comprobante por WhatsApp para confirmar tu turno.
              </p>
            </div>
          )}

          <Button
            onClick={goToConfirm}
            className="w-full bg-bella-rose-600 hover:bg-bella-rose-700 py-6"
          >
            Revisar y confirmar
          </Button>
        </div>
      )}

      {/* STEP 6: Resumen */}
      {step === 'confirm' && !loading && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Confirmá tu reserva</h2>

          <div className="rounded-xl border border-border/50 bg-white/80 backdrop-blur-sm p-6 space-y-4">
            {/* Items detail */}
            {cart.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium">{item.treatmentName}</span>
                  <span className="font-semibold">${item.price.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>con {item.professionalName} · {item.durationMinutes} min</span>
                  <span>Seña ({depositPercentage}%): ${Math.ceil(item.price * depositPercentage / 100).toLocaleString('es-AR')}</span>
                </div>
                {idx < cart.length - 1 && <hr className="border-border mt-2" />}
              </div>
            ))}

            <hr className="border-border" />

            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha</span>
              <span className="font-medium">
                {selectedDate && format(parseISO(selectedDate), "EEEE d 'de' MMMM", { locale: es })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horario</span>
              <span className="font-medium">{selectedTime} hs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duración total</span>
              <span className="font-medium">{totalDuration} min</span>
            </div>

            <hr className="border-border" />

            <div className="flex justify-between">
              <span className="text-muted-foreground">Total servicios</span>
              <span className="font-semibold">${totalPrice.toLocaleString('es-AR')}</span>
            </div>
            <div className="flex justify-between text-bella-rose-600">
              <span className="font-medium">Seña a pagar ({depositPercentage}%)</span>
              <span className="font-bold">${totalDeposit.toLocaleString('es-AR')}</span>
            </div>

            <hr className="border-border" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nombre</span>
              <span>{firstName} {lastName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Celular</span>
              <span>{phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pago</span>
              <span>{paymentMethod === 'mercadopago' ? 'Tarjeta / Mercado Pago' : 'Transferencia bancaria'}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Podés reagendar tu turno 1 vez sin costo. Si reagendás una segunda vez, perdés la reserva.
          </p>

          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full bg-bella-rose-600 hover:bg-bella-rose-700 py-6 text-lg"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Procesando...
              </span>
            ) : (
              'Confirmar y pagar seña'
            )}
          </Button>
        </div>
      )}

      {/* STEP 7: Éxito */}
      {step === 'success' && bookingResult && (
        <div className="text-center space-y-6 py-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">¡Turno reservado!</h2>
            <p className="text-muted-foreground mt-2">
              {bookingResult.paymentMethod === 'mercadopago'
                ? 'Serás redirigida a Mercado Pago para completar el pago de la seña.'
                : 'Realizá la transferencia para confirmar tu turno.'}
            </p>
          </div>

          {bookingResult.paymentMethod === 'transfer' && (
            <div className="rounded-xl border border-bella-gold-200 bg-bella-gold-50 p-6 text-left space-y-2">
              <p className="font-semibold text-bella-gold-800">Datos para la transferencia:</p>
              <p className="text-sm">
                Monto: <span className="font-bold">${bookingResult.depositAmount.toLocaleString('es-AR')}</span>
              </p>
              <p className="text-xs text-bella-gold-700">
                Una vez realizada la transferencia, la dueña confirmará el pago y tu turno quedará confirmado.
              </p>
            </div>
          )}

          {/* Push notification prompt */}
          {pushSupported && !pushSubscribed && !pushAsked && (
            <div className="rounded-xl border border-bella-violet-200 bg-bella-violet-50 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-bella-violet-100 rounded-full flex items-center justify-center">
                  <Bell className="w-5 h-5 text-bella-violet-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-bella-violet-800">¿Querés recibir recordatorios?</p>
                  <p className="text-xs text-bella-violet-600">Te avisamos antes de tu turno</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-bella-violet-600 hover:bg-bella-violet-700 text-white"
                  onClick={async () => {
                    await pushSubscribe({ clientPhone: phone })
                    setPushAsked(true)
                  }}
                >
                  Sí, avisame
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-bella-violet-600"
                  onClick={() => setPushAsked(true)}
                >
                  Ahora no
                </Button>
              </div>
            </div>
          )}

          <Button
            onClick={() => window.location.href = '/'}
            variant="outline"
            className="mt-4"
          >
            Volver al inicio
          </Button>
        </div>
      )}
    </div>
  )
}
