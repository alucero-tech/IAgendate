'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  confirmTransferPayment,
  cancelBooking,
  confirmArrival,
  addOwnAddon,
  addReferralAddon,
  acceptReferralAddon,
  rejectReferralAddon,
  getTreatmentsForProfessional,
  finalizeTurn,
  markNoShow,
  revertNoShow,
  initiateTransfer,
  acceptTransfer,
  rejectTransfer,
  manualRefund,
} from '@/features/booking/services/booking-actions'
import { Clock, Calendar, User, Phone, CheckCircle, XCircle, DollarSign, Play, Plus, ArrowRight, CreditCard, Banknote, UserX, Repeat } from 'lucide-react'
import { format, parseISO, isToday, isFuture, isPast } from 'date-fns'
import { es } from 'date-fns/locale'

interface BookingItem {
  id: string
  treatment_id: string | null
  professional_id: string
  start_time: string
  end_time: string
  price: number
  deposit_amount: number
  is_addon?: boolean
  addon_status?: string
  referred_by?: string | null
  transfer_status?: string | null
  original_professional_id?: string | null
  treatments: { name: string; duration_minutes: number; price: number; categories: { name: string } } | null
  professionals: { first_name: string; last_name: string }
}

interface Booking {
  id: string
  booking_date: string
  start_time: string
  end_time: string
  status: string
  amount_total: number
  amount_paid: number
  reschedule_count: number
  final_payment_method?: string | null
  final_amount?: number | null
  clients: { first_name: string; last_name: string; phone: string; email: string | null }
  professionals?: { first_name: string; last_name: string } | null
  treatments?: { name: string; duration_minutes: number; price: number; categories: { name: string } } | null
  booking_items?: BookingItem[]
}

interface Professional {
  id: string
  first_name: string
  last_name: string
  is_owner: boolean
}

interface Treatment {
  id: string
  name: string
  duration_minutes: number
  price: number
  categories: { name: string }
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending_payment: { label: 'Pago pendiente', variant: 'secondary' },
  confirmed: { label: 'Confirmado', variant: 'default' },
  in_progress: { label: 'En curso', variant: 'default' },
  rescheduled: { label: 'Reagendado', variant: 'outline' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  completed: { label: 'Completado', variant: 'default' },
  no_show: { label: 'No asistió', variant: 'destructive' },
}

interface Props {
  bookings: Booking[]
  professionals: Professional[]
  isOwner: boolean
  role?: string
  currentProfessionalId: string
}

export function TurnosClient({ bookings, professionals, isOwner, role = 'professional', currentProfessionalId }: Props) {
  const isManager = role === 'manager'
  const hasAdminAccess = isOwner || isManager
  const [loading, setLoading] = useState<string | null>(null)

  // Addon dialog state
  const [addonDialog, setAddonDialog] = useState<{ bookingId: string; step: 'choose' | 'own' | 'refer' } | null>(null)
  const [availableTreatments, setAvailableTreatments] = useState<Treatment[]>([])
  const [loadingTreatments, setLoadingTreatments] = useState(false)

  // Referral acceptance dialog state
  const [referralDialog, setReferralDialog] = useState<{ itemId: string; clientName: string; referredByName: string } | null>(null)
  const [referralTreatments, setReferralTreatments] = useState<Treatment[]>([])

  // Transfer dialog state
  const [transferDialog, setTransferDialog] = useState<{ itemId: string; bookingId: string } | null>(null)

  // Finalize dialog state
  const [finalizeDialog, setFinalizeDialog] = useState<Booking | null>(null)

  const todayBookings = bookings.filter(b =>
    isToday(parseISO(b.booking_date)) && !['cancelled', 'in_progress'].includes(b.status)
  )
  const upcomingBookings = bookings.filter(b =>
    isFuture(parseISO(b.booking_date)) && !['cancelled'].includes(b.status)
  )
  const inProgressBookings = bookings.filter(b => b.status === 'in_progress')
  const pendingPayment = bookings.filter(b => b.status === 'pending_payment')
  const pastBookings = bookings.filter(b =>
    isPast(parseISO(b.booking_date)) && !isToday(parseISO(b.booking_date))
  )

  async function handleConfirmPayment(bookingId: string) {
    setLoading(bookingId)
    await confirmTransferPayment(bookingId)
    window.location.reload()
  }

  async function handleCancel(bookingId: string) {
    setLoading(bookingId)
    if (isManager) {
      // Manager does manual refund
      if (!confirm('¿Registrar devolución manual? Se notificará a la dueña.')) {
        setLoading(null)
        return
      }
      await manualRefund(bookingId, currentProfessionalId)
    } else {
      await cancelBooking(bookingId, true)
    }
    window.location.reload()
  }

  async function handleConfirmArrival(bookingId: string) {
    setLoading(bookingId)
    await confirmArrival(bookingId)
    window.location.reload()
  }

  async function handleNoShow(bookingId: string) {
    if (!confirm('¿Confirmar que la clienta no asistió?')) return
    setLoading(bookingId)
    await markNoShow(bookingId)
    window.location.reload()
  }

  async function handleRevertNoShow(bookingId: string) {
    if (!confirm('¿Confirmar que la clienta SÍ asistió? Se revertirá la ausencia.')) return
    setLoading(bookingId)
    await revertNoShow(bookingId)
    window.location.reload()
  }

  async function handleTransferTo(targetProfId: string) {
    if (!transferDialog) return
    setLoading('transfer')
    await initiateTransfer(transferDialog.itemId, targetProfId)
    setTransferDialog(null)
    setLoading(null)
    window.location.reload()
  }

  async function handleAcceptTransfer(itemId: string) {
    setLoading('transfer')
    await acceptTransfer(itemId)
    window.location.reload()
  }

  async function handleRejectTransfer(itemId: string) {
    setLoading('transfer')
    await rejectTransfer(itemId)
    window.location.reload()
  }

  async function openAddonDialog(bookingId: string) {
    setAddonDialog({ bookingId, step: 'choose' })
  }

  async function handleChooseOwn() {
    if (!addonDialog) return
    setLoadingTreatments(true)
    setAddonDialog({ ...addonDialog, step: 'own' })
    const treatments = await getTreatmentsForProfessional(currentProfessionalId)
    setAvailableTreatments(treatments)
    setLoadingTreatments(false)
  }

  async function handleAddOwnAddon(treatmentId: string) {
    if (!addonDialog) return
    setLoading('addon')
    await addOwnAddon(addonDialog.bookingId, treatmentId, currentProfessionalId)
    setAddonDialog(null)
    setLoading(null)
    window.location.reload()
  }

  async function handleReferTo(targetProfId: string) {
    if (!addonDialog) return
    setLoading('addon')
    await addReferralAddon(addonDialog.bookingId, currentProfessionalId, targetProfId)
    setAddonDialog(null)
    setLoading(null)
    window.location.reload()
  }

  async function openReferralDialog(itemId: string, clientName: string, referredById: string) {
    const prof = professionals.find(p => p.id === referredById)
    const referredByName = prof ? `${prof.first_name} ${prof.last_name}` : 'Profesional'
    setReferralDialog({ itemId, clientName, referredByName })
    setLoadingTreatments(true)
    const treatments = await getTreatmentsForProfessional(currentProfessionalId)
    setReferralTreatments(treatments)
    setLoadingTreatments(false)
  }

  async function handleAcceptReferral(treatmentId: string) {
    if (!referralDialog) return
    setLoading('referral')
    await acceptReferralAddon(referralDialog.itemId, treatmentId)
    setReferralDialog(null)
    setLoading(null)
    window.location.reload()
  }

  async function handleRejectReferral() {
    if (!referralDialog) return
    setLoading('referral')
    await rejectReferralAddon(referralDialog.itemId)
    setReferralDialog(null)
    setLoading(null)
    window.location.reload()
  }

  async function handleFinalize(paymentMethod: 'cash' | 'transfer') {
    if (!finalizeDialog) return
    setLoading('finalize')
    const result = await finalizeTurn(finalizeDialog.id, paymentMethod)
    if (result.error) {
      alert(result.error)
      setLoading(null)
      return
    }
    setFinalizeDialog(null)
    setLoading(null)
    window.location.reload()
  }

  function BookingCard({ booking }: { booking: Booking }) {
    const status = statusLabels[booking.status] || { label: booking.status, variant: 'secondary' as const }
    const items = booking.booking_items || []
    const hasItems = items.length > 0
    const originalItems = items.filter(i => !i.is_addon)
    const addonItems = items.filter(i => i.is_addon)
    const hasPendingReferrals = items.some(i => i.addon_status === 'pending_acceptance')

    return (
      <div className={`rounded-xl border p-4 space-y-3 ${
        booking.status === 'in_progress'
          ? 'border-blue-300 bg-blue-50/50'
          : 'border-border/50 bg-white/80'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">
              {booking.clients.first_name} {booking.clients.last_name}
            </p>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" />
              {booking.clients.phone}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 1 && (
              <Badge variant="outline" className="text-xs">{items.length} servicios</Badge>
            )}
            <Badge
              variant={status.variant}
              className={booking.status === 'in_progress' ? 'bg-blue-600 text-white' : ''}
            >
              {status.label}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {format(parseISO(booking.booking_date), "d MMM yyyy", { locale: es })}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
          </div>
        </div>

        {/* Booking items */}
        {hasItems ? (
          <div className="space-y-2">
            {/* Original items */}
            {originalItems.map((item) => {
              const isPendingTransfer = item.transfer_status === 'pending_transfer'
              const isMyPendingTransfer = isPendingTransfer && item.professional_id === currentProfessionalId
              return (
                <div key={item.id} className={`text-sm rounded-lg px-3 py-2 ${
                  isPendingTransfer ? 'bg-violet-50 border border-violet-200' : 'bg-muted/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      {isPendingTransfer && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 mb-1 bg-violet-100 text-violet-700">
                          Transferencia pendiente
                        </Badge>
                      )}
                      <div>
                        <span className="text-muted-foreground">{item.treatments?.categories.name}:</span>{' '}
                        <span className="font-medium">{item.treatments?.name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <User className="h-3 w-3" />
                        {item.professionals.first_name} {item.professionals.last_name}
                        <span className="mx-1">·</span>
                        {item.start_time.substring(0, 5)} - {item.end_time.substring(0, 5)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">${item.price.toLocaleString('es-AR')}</span>
                      {isOwner && !isPendingTransfer && ['confirmed', 'rescheduled'].includes(booking.status) && (
                        <button
                          onClick={() => setTransferDialog({ itemId: item.id, bookingId: booking.id })}
                          className="text-violet-600 hover:text-violet-800 p-1"
                          title="Transferir a otra profesional"
                        >
                          <Repeat className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Accept/Reject for target professional */}
                  {isMyPendingTransfer && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-violet-200">
                      <Button
                        size="sm"
                        onClick={() => handleAcceptTransfer(item.id)}
                        disabled={loading !== null}
                        className="bg-green-600 hover:bg-green-700 text-xs"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Aceptar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectTransfer(item.id)}
                        disabled={loading !== null}
                        className="text-red-600 hover:text-red-700 text-xs"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Rechazar
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Addon items */}
            {addonItems.map((item) => {
              const isMyPendingReferral = item.addon_status === 'pending_acceptance' && item.professional_id === currentProfessionalId
              return (
                <div key={item.id} className={`text-sm rounded-lg px-3 py-2 ${
                  item.addon_status === 'pending_acceptance'
                    ? 'bg-amber-50 border border-amber-200'
                    : 'bg-green-50 border border-green-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {item.referred_by ? 'Derivado' : 'Extra'}
                        </Badge>
                        {item.treatments ? (
                          <>
                            <span className="text-muted-foreground">{item.treatments.categories.name}:</span>{' '}
                            <span className="font-medium">{item.treatments.name}</span>
                          </>
                        ) : (
                          <span className="text-amber-600 text-xs">Pendiente de carga</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <User className="h-3 w-3" />
                        {item.professionals.first_name} {item.professionals.last_name}
                        {item.addon_status === 'pending_acceptance' && !isMyPendingReferral && (
                          <Badge variant="secondary" className="text-xs ml-1 px-1.5 py-0 bg-amber-100 text-amber-700">
                            Esperando confirmación
                          </Badge>
                        )}
                      </div>
                    </div>
                    {item.price > 0 && (
                      <span className="font-medium text-sm">${item.price.toLocaleString('es-AR')}</span>
                    )}
                  </div>
                  {/* Receptora actions for pending referral */}
                  {isMyPendingReferral && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-amber-200">
                      <Button
                        size="sm"
                        onClick={() => openReferralDialog(
                          item.id,
                          `${booking.clients.first_name} ${booking.clients.last_name}`,
                          item.referred_by || ''
                        )}
                        disabled={loading !== null}
                        className="bg-green-600 hover:bg-green-700 text-xs"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Cargar servicio
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          setLoading('referral')
                          await rejectReferralAddon(item.id)
                          window.location.reload()
                        }}
                        disabled={loading !== null}
                        className="text-red-600 hover:text-red-700 text-xs"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Rechazar
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Totals */}
            <div className="flex items-center justify-between text-sm pt-1 border-t">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">${booking.amount_total.toLocaleString('es-AR')}</span>
            </div>
            {booking.amount_paid > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Seña pagada</span>
                <span className="text-green-600">-${booking.amount_paid.toLocaleString('es-AR')}</span>
              </div>
            )}
            {booking.amount_paid > 0 && (
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Saldo</span>
                <span>${(booking.amount_total - booking.amount_paid).toLocaleString('es-AR')}</span>
              </div>
            )}
          </div>
        ) : (
          /* Legacy booking without items */
          <>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                {booking.professionals?.first_name || 'Sin asignar'}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />
                ${booking.amount_total.toLocaleString('es-AR')}
              </div>
            </div>
            {booking.treatments && (
              <p className="text-sm">
                <span className="text-muted-foreground">{booking.treatments.categories.name}:</span>{' '}
                <span className="font-medium">{booking.treatments.name}</span>
              </p>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          {booking.status === 'pending_payment' && (
            <Button
              size="sm"
              onClick={() => handleConfirmPayment(booking.id)}
              disabled={loading === booking.id}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Confirmar pago
            </Button>
          )}
          {['confirmed', 'rescheduled'].includes(booking.status) && (() => {
            const bookingDateTime = new Date(`${booking.booking_date}T${booking.end_time}`)
            const isOverdue = isPast(bookingDateTime)
            return (
              <>
                {!isOverdue && (
                  <Button
                    size="sm"
                    onClick={() => handleConfirmArrival(booking.id)}
                    disabled={loading === booking.id}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Play className="h-3.5 w-3.5 mr-1" />
                    Confirmar llegada
                  </Button>
                )}
                {isOverdue && (
                  <Button
                    size="sm"
                    onClick={() => handleNoShow(booking.id)}
                    disabled={loading === booking.id}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <UserX className="h-3.5 w-3.5 mr-1" />
                    No asistió
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCancel(booking.id)}
                  disabled={loading === booking.id}
                  className="text-red-600 hover:text-red-700"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Cancelar
                </Button>
              </>
            )
          })()}
          {booking.status === 'in_progress' && (
            <>
              <Button
                size="sm"
                onClick={() => openAddonDialog(booking.id)}
                disabled={loading !== null}
                className="bg-bella-rose-600 hover:bg-bella-rose-700"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Agregar servicio
              </Button>
              <Button
                size="sm"
                onClick={() => setFinalizeDialog(booking)}
                disabled={loading !== null || hasPendingReferrals}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Finalizar turno
              </Button>
              {hasPendingReferrals && (
                <p className="text-xs text-amber-600 w-full">
                  Hay derivaciones pendientes — no se puede finalizar aún
                </p>
              )}
            </>
          )}
          {booking.status === 'no_show' && isOwner && (
            <Button
              size="sm"
              onClick={() => handleRevertNoShow(booking.id)}
              disabled={loading === booking.id}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Revertir — Sí asistió
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Clock className="h-8 w-8 text-bella-rose-500" />
          Turnos
        </h1>
        <p className="text-muted-foreground mt-1">Gestión de reservas</p>
      </div>

      <Tabs defaultValue={inProgressBookings.length > 0 ? 'en-curso' : 'hoy'}>
        <TabsList className="flex-wrap">
          {inProgressBookings.length > 0 && (
            <TabsTrigger value="en-curso" className="text-blue-600">
              En curso ({inProgressBookings.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="hoy">
            Hoy ({todayBookings.length})
          </TabsTrigger>
          <TabsTrigger value="pendientes">
            Pago pendiente ({pendingPayment.length})
          </TabsTrigger>
          <TabsTrigger value="proximos">
            Próximos ({upcomingBookings.length})
          </TabsTrigger>
          <TabsTrigger value="pasados">
            Pasados ({pastBookings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="en-curso" className="space-y-3 mt-4">
          {inProgressBookings.map(b => <BookingCard key={b.id} booking={b} />)}
          {inProgressBookings.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No hay turnos en curso</p>
          )}
        </TabsContent>

        <TabsContent value="hoy" className="space-y-3 mt-4">
          {todayBookings.map(b => <BookingCard key={b.id} booking={b} />)}
          {todayBookings.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No hay turnos para hoy</p>
          )}
        </TabsContent>

        <TabsContent value="pendientes" className="space-y-3 mt-4">
          {pendingPayment.map(b => <BookingCard key={b.id} booking={b} />)}
          {pendingPayment.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No hay pagos pendientes</p>
          )}
        </TabsContent>

        <TabsContent value="proximos" className="space-y-3 mt-4">
          {upcomingBookings.map(b => <BookingCard key={b.id} booking={b} />)}
          {upcomingBookings.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No hay turnos próximos</p>
          )}
        </TabsContent>

        <TabsContent value="pasados" className="space-y-3 mt-4">
          {pastBookings.map(b => <BookingCard key={b.id} booking={b} />)}
          {pastBookings.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No hay turnos pasados</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Agregar servicio */}
      <Dialog open={addonDialog !== null} onOpenChange={(open) => { if (!open) setAddonDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {addonDialog?.step === 'choose' && 'Agregar servicio'}
              {addonDialog?.step === 'own' && 'Seleccioná el tratamiento'}
              {addonDialog?.step === 'refer' && 'Derivar a profesional'}
            </DialogTitle>
          </DialogHeader>

          {addonDialog?.step === 'choose' && (
            <div className="space-y-3 pt-2">
              <Button
                className="w-full justify-start h-auto py-4 bg-bella-rose-50 hover:bg-bella-rose-100 text-bella-rose-800 border border-bella-rose-200"
                variant="outline"
                onClick={handleChooseOwn}
              >
                <div className="text-left">
                  <p className="font-semibold">Es mío</p>
                  <p className="text-xs text-muted-foreground">Yo hago el servicio adicional</p>
                </div>
              </Button>
              <Button
                className="w-full justify-start h-auto py-4 bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200"
                variant="outline"
                onClick={() => addonDialog && setAddonDialog({ ...addonDialog, step: 'refer' })}
              >
                <div className="text-left">
                  <p className="font-semibold">Derivo a otra profesional</p>
                  <p className="text-xs text-muted-foreground">Otra profesional hace el servicio</p>
                </div>
              </Button>
            </div>
          )}

          {addonDialog?.step === 'own' && (
            <div className="space-y-2 pt-2 max-h-80 overflow-y-auto">
              {loadingTreatments ? (
                <p className="text-center text-muted-foreground py-8">Cargando tratamientos...</p>
              ) : availableTreatments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No tenés tratamientos asignados</p>
              ) : (
                availableTreatments.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleAddOwnAddon(t.id)}
                    disabled={loading === 'addon'}
                    className="w-full text-left rounded-lg border border-border/50 p-3 hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.categories.name} · {t.duration_minutes} min
                        </p>
                      </div>
                      <span className="font-semibold text-sm">${t.price.toLocaleString('es-AR')}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {addonDialog?.step === 'refer' && (
            <div className="space-y-2 pt-2">
              {professionals
                .filter(p => p.id !== currentProfessionalId)
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleReferTo(p.id)}
                    disabled={loading === 'addon'}
                    className="w-full text-left rounded-lg border border-border/50 p-3 hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{p.first_name} {p.last_name}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              {professionals.filter(p => p.id !== currentProfessionalId).length === 0 && (
                <p className="text-center text-muted-foreground py-8">No hay otras profesionales activas</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Finalizar turno */}
      <Dialog open={finalizeDialog !== null} onOpenChange={(open) => { if (!open) setFinalizeDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar turno</DialogTitle>
          </DialogHeader>

          {finalizeDialog && (
            <div className="space-y-4 pt-2">
              {/* Summary */}
              <div className="space-y-2">
                <p className="font-medium text-sm text-muted-foreground">Resumen</p>
                {(finalizeDialog.booking_items || []).map(item => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {item.is_addon && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {item.referred_by ? 'Derivado' : 'Extra'}
                        </Badge>
                      )}
                      <span>{item.treatments?.name || 'Servicio'}</span>
                    </div>
                    <span className="font-medium">${item.price.toLocaleString('es-AR')}</span>
                  </div>
                ))}
                <div className="border-t pt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">${finalizeDialog.amount_total.toLocaleString('es-AR')}</span>
                  </div>
                  {finalizeDialog.amount_paid > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Seña pagada</span>
                      <span className="text-green-600">-${finalizeDialog.amount_paid.toLocaleString('es-AR')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-lg pt-1">
                    <span>Saldo a cobrar</span>
                    <span>${(finalizeDialog.amount_total - finalizeDialog.amount_paid).toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </div>

              {/* Warning: addons without treatment */}
              {(finalizeDialog.booking_items || []).some(item => item.is_addon && !item.treatment_id) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                  Hay extras/derivaciones sin tratamiento cargado. Se facturarán a $0.
                </div>
              )}

              {/* Payment method */}
              <div className="space-y-2">
                <p className="font-medium text-sm text-muted-foreground">Método de pago del saldo</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleFinalize('cash')}
                    disabled={loading === 'finalize'}
                    variant="outline"
                    className="h-auto py-4 flex flex-col gap-1 hover:bg-green-50 hover:border-green-300"
                  >
                    <Banknote className="h-6 w-6 text-green-600" />
                    <span className="font-semibold">Efectivo</span>
                  </Button>
                  <Button
                    onClick={() => handleFinalize('transfer')}
                    disabled={loading === 'finalize'}
                    variant="outline"
                    className="h-auto py-4 flex flex-col gap-1 hover:bg-blue-50 hover:border-blue-300"
                  >
                    <CreditCard className="h-6 w-6 text-blue-600" />
                    <span className="font-semibold">Transferencia</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Dialog: Cargar servicio de derivación */}
      <Dialog open={referralDialog !== null} onOpenChange={(open) => { if (!open) setReferralDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cargar servicio derivado</DialogTitle>
          </DialogHeader>

          {referralDialog && (
            <div className="space-y-3 pt-2">
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-sm">
                <p><span className="font-semibold">{referralDialog.referredByName}</span> te derivó a <span className="font-semibold">{referralDialog.clientName}</span></p>
                <p className="text-muted-foreground text-xs mt-1">Elegí qué tratamiento vas a realizarle</p>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {loadingTreatments ? (
                  <p className="text-center text-muted-foreground py-8">Cargando tratamientos...</p>
                ) : referralTreatments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No tenés tratamientos asignados</p>
                ) : (
                  referralTreatments.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleAcceptReferral(t.id)}
                      disabled={loading === 'referral'}
                      className="w-full text-left rounded-lg border border-border/50 p-3 hover:bg-muted/50 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{t.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.categories.name} · {t.duration_minutes} min
                          </p>
                        </div>
                        <span className="font-semibold text-sm">${t.price.toLocaleString('es-AR')}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <Button
                variant="outline"
                onClick={handleRejectReferral}
                disabled={loading === 'referral'}
                className="w-full text-red-600 hover:text-red-700"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Rechazar derivación
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Dialog: Transferir turno a otra profesional */}
      <Dialog open={transferDialog !== null} onOpenChange={(open) => { if (!open) setTransferDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir a otra profesional</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {professionals
              .filter(p => p.id !== currentProfessionalId)
              .map(p => (
                <button
                  key={p.id}
                  onClick={() => handleTransferTo(p.id)}
                  disabled={loading === 'transfer'}
                  className="w-full text-left rounded-lg border border-border/50 p-3 hover:bg-violet-50 hover:border-violet-300 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{p.first_name} {p.last_name}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            {professionals.filter(p => p.id !== currentProfessionalId).length === 0 && (
              <p className="text-center text-muted-foreground py-8">No hay otras profesionales activas</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
