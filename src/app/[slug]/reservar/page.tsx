import { getPublicCategories, getStorePhone, getDepositPercentage, getTransferAlias } from '@/features/booking/services/booking-actions'
import { getStoreName } from '@/features/settings/services/settings-actions'
import { BookingWizard } from '@/features/booking/components/booking-wizard'
import { InstallBanner } from '@/shared/components/install-banner'
import { ContactButtons } from '@/shared/components/contact-buttons'
import { ChatWidget } from '@/features/ai-assistant/components/chat-widget'

export default async function ReservarPage() {
  const [categories, storeName, storePhone, depositPct, transferAlias] = await Promise.all([
    getPublicCategories(),
    getStoreName(),
    getStorePhone(),
    getDepositPercentage(),
    getTransferAlias(),
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
          <p className="text-muted-foreground mt-1">Reservá tu turno</p>
        </div>

        <BookingWizard categories={categories} depositPercentage={depositPct} transferAlias={transferAlias} />
      </div>

      <InstallBanner />
      <ContactButtons phone={storePhone} storeName={storeName} />
      <ChatWidget />
    </div>
  )
}
