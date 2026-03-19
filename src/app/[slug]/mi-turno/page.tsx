import { MyBookingPortal } from '@/features/portal/components/my-booking-portal'
import { ContactButtons } from '@/shared/components/contact-buttons'
import { InstallBanner } from '@/shared/components/install-banner'
import { getStoreName } from '@/features/settings/services/settings-actions'
import { getStorePhone } from '@/features/booking/services/booking-actions'
import { getTenantId } from '@/lib/tenant'
import { notFound } from 'next/navigation'

export default async function MiTurnoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tenantId = await getTenantId(slug)
  if (!tenantId) notFound()

  const [storeName, storePhone] = await Promise.all([
    getStoreName(tenantId),
    getStorePhone(tenantId),
  ])

  return (
    <div className="min-h-screen mesh-gradient-bg relative overflow-hidden">
      {/* Blobs */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-bella-rose-300 rounded-full blur-[150px] opacity-20 animate-blob" />
      <div className="absolute bottom-0 right-1/4 w-[350px] h-[350px] bg-bella-violet-300 rounded-full blur-[150px] opacity-15 animate-blob animation-delay-2000" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-bella-rose-600">{storeName}</h1>
          <p className="text-muted-foreground mt-1">Consultá tu turno</p>
        </div>

        <MyBookingPortal storePhone={storePhone} storeName={storeName} tenantId={tenantId} />
      </div>

      <InstallBanner />
      <ContactButtons phone={storePhone} storeName={storeName} />
    </div>
  )
}
