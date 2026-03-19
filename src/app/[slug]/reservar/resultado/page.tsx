import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { InstallBanner } from '@/shared/components/install-banner'
import { getStoreName } from '@/features/settings/services/settings-actions'
import { getTenantId } from '@/lib/tenant'
import { notFound } from 'next/navigation'

export default async function ResultadoPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ status?: string; booking?: string }>
}) {
  const [{ slug }, params] = await Promise.all([routeParams, searchParams])
  const tenantId = await getTenantId(slug)
  if (!tenantId) notFound()
  const storeName = await getStoreName(tenantId)
  const status = params.status
  const bookingId = params.booking

  return (
    <div className="min-h-screen mesh-gradient-bg relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-bella-rose-300 rounded-full blur-[150px] opacity-20" />

      <div className="relative z-10 max-w-md mx-auto px-4 py-24 text-center space-y-6">
        <h1 className="text-2xl font-bold text-bella-rose-600">{storeName}</h1>

        {status === 'success' && (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">¡Turno confirmado!</h2>
            <p className="text-muted-foreground">
              Tu pago fue aprobado y tu turno ya está reservado. Te esperamos.
            </p>
          </>
        )}

        {status === 'failure' && (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold">Pago rechazado</h2>
            <p className="text-muted-foreground">
              No pudimos procesar tu pago. Podés intentar de nuevo o elegir otro medio de pago.
            </p>
          </>
        )}

        {status === 'pending' && (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-100">
              <Clock className="h-10 w-10 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold">Pago en proceso</h2>
            <p className="text-muted-foreground">
              Tu pago está siendo procesado. Te notificaremos cuando se confirme y tu turno quedará reservado.
            </p>
          </>
        )}

        {bookingId && (
          <p className="text-xs text-muted-foreground">
            Referencia: {bookingId.substring(0, 8)}
          </p>
        )}

        <div className="flex flex-col gap-3 pt-4">
          <Link href={`/${slug}/reservar`}>
            <Button className="w-full bg-bella-rose-600 hover:bg-bella-rose-700">
              Reservar otro turno
            </Button>
          </Link>
          <Link href={`/${slug}`}>
            <Button variant="outline" className="w-full">
              Volver al inicio
            </Button>
          </Link>
        </div>
      </div>

      <InstallBanner />
    </div>
  )
}
