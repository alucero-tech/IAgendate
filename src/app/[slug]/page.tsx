import Link from 'next/link'
import Image from 'next/image'
import { Scissors, Clock, MapPin, Phone, Instagram, CreditCard, CalendarCheck, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getStoreSettings, getStoreBranding } from '@/features/settings/services/settings-actions'
import { getAllTreatmentsGrouped, getStorePhone, getDepositPercentage } from '@/features/booking/services/booking-actions'
import { ContactButtons } from '@/shared/components/contact-buttons'
import { InstallBanner } from '@/shared/components/install-banner'

export default async function SalonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [branding, settings, categories, storePhone, depositPct] = await Promise.all([
    getStoreBranding(),
    getStoreSettings(),
    getAllTreatmentsGrouped(),
    getStorePhone(),
    getDepositPercentage(),
  ])

  const hasAddress = !!settings.address
  const hasPhone = !!settings.phone
  const hasInstagram = !!settings.instagram

  return (
    <div className="min-h-screen mesh-gradient-bg relative overflow-hidden">
      {/* Blobs decorativos */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-bella-rose-300 rounded-full blur-[150px] opacity-30 animate-blob" />
      <div className="absolute top-1/2 right-1/4 w-[350px] h-[350px] bg-bella-violet-300 rounded-full blur-[150px] opacity-25 animate-blob animation-delay-2000" />
      <div className="absolute bottom-0 left-1/2 w-[300px] h-[300px] bg-bella-gold-300 rounded-full blur-[150px] opacity-20 animate-blob animation-delay-4000" />

      {/* Header */}
      <header className="relative z-10 max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logoUrl && (
              <Image src={branding.logoUrl} alt={branding.name} width={48} height={48} className="w-12 h-12 rounded-xl object-contain" />
            )}
            <h1 className="text-2xl font-bold text-bella-rose-600">{branding.name}</h1>
          </div>
          <Link href="/login">
            <Button variant="outline" size="sm">Ingresar</Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 pb-24">
        {/* Hero */}
        <section className="text-center pt-8 pb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
            Tu espacio de
            <span className="block text-bella-rose-500">belleza y bienestar</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Reservá tu turno online de forma rápida y segura. Elegí el tratamiento, el día y la hora que más te convenga.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={`/${slug}/reservar`}>
              <Button size="lg" className="bg-bella-rose-600 hover:bg-bella-rose-700 text-white px-8 py-6 text-lg rounded-full shadow-lg shadow-bella-rose-200 w-full sm:w-auto">
                <CalendarCheck className="w-5 h-5 mr-2" />
                Reservar turno
              </Button>
            </Link>
            <Link href={`/${slug}/mi-turno`}>
              <Button size="lg" variant="outline" className="px-8 py-6 text-lg rounded-full w-full sm:w-auto">
                Consultar mi turno
              </Button>
            </Link>
          </div>
        </section>

        {/* Info del negocio */}
        {(hasAddress || hasPhone || hasInstagram) && (
          <section className="mb-12">
            <div className="mesh-gradient-card rounded-2xl border border-border/50 backdrop-blur-sm p-6">
              <div className="flex flex-wrap gap-6 justify-center text-sm">
                {hasAddress && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 text-bella-rose-500 shrink-0" />
                    <span>{settings.address}</span>
                  </div>
                )}
                {hasPhone && (
                  <a href={`tel:${settings.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <Phone className="w-4 h-4 text-bella-violet-500 shrink-0" />
                    <span>{settings.phone}</span>
                  </a>
                )}
                {hasInstagram && (
                  <a
                    href={`https://instagram.com/${settings.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Instagram className="w-4 h-4 text-bella-gold-500 shrink-0" />
                    <span>{settings.instagram.startsWith('@') ? settings.instagram : `@${settings.instagram}`}</span>
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Tratamientos */}
        {categories.length > 0 && (
          <section className="mb-12">
            <h3 className="text-2xl font-bold text-foreground mb-6 text-center">
              <Scissors className="w-6 h-6 inline-block text-bella-rose-500 mr-2 -mt-1" />
              Nuestros tratamientos
            </h3>

            <div className="space-y-6">
              {categories.map((category) => (
                <div key={category.id} className="mesh-gradient-card rounded-2xl border border-border/50 backdrop-blur-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-border/50 bg-white/30">
                    <h4 className="font-semibold text-foreground">{category.name}</h4>
                    {category.description && (
                      <p className="text-xs text-muted-foreground">{category.description}</p>
                    )}
                  </div>

                  <div className="divide-y divide-border/30">
                    {category.treatments.map((treatment) => (
                      <div key={treatment.id} className="px-5 py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm">{treatment.name}</p>
                          {treatment.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{treatment.description}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-bella-rose-600">${Math.round(treatment.price).toLocaleString('es-AR')}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                            <Clock className="w-3 h-3" />
                            {treatment.duration_minutes} min
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Info de reserva */}
        <section className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="mesh-gradient-card rounded-2xl p-5 border border-border/50 backdrop-blur-sm text-center">
              <CreditCard className="w-8 h-8 text-bella-gold-500 mx-auto mb-3" />
              <h4 className="font-semibold text-foreground mb-1">Seña del {depositPct}%</h4>
              <p className="text-xs text-muted-foreground">Confirmá tu turno con una seña por Mercado Pago o transferencia</p>
            </div>
            <div className="mesh-gradient-card rounded-2xl p-5 border border-border/50 backdrop-blur-sm text-center">
              <CalendarCheck className="w-8 h-8 text-bella-violet-500 mx-auto mb-3" />
              <h4 className="font-semibold text-foreground mb-1">Reagendá sin costo</h4>
              <p className="text-xs text-muted-foreground">Podés cambiar tu turno 1 vez sin perder la seña</p>
            </div>
            <div className="mesh-gradient-card rounded-2xl p-5 border border-border/50 backdrop-blur-sm text-center">
              <Clock className="w-8 h-8 text-bella-rose-400 mx-auto mb-3" />
              <h4 className="font-semibold text-foreground mb-1">Turnos en tiempo real</h4>
              <p className="text-xs text-muted-foreground">Solo ves los horarios realmente disponibles</p>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="text-center">
          <Link href={`/${slug}/reservar`}>
            <Button size="lg" className="bg-bella-rose-600 hover:bg-bella-rose-700 text-white px-10 py-6 text-lg rounded-full shadow-lg shadow-bella-rose-200">
              Reservar turno ahora
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8 text-muted-foreground text-sm border-t border-border/30">
        <p>&copy; {new Date().getFullYear()} {branding.name}. Todos los derechos reservados.</p>
        <p className="text-xs mt-1 opacity-60">Potenciado por IAgendate</p>
      </footer>

      <InstallBanner />
      {storePhone && <ContactButtons phone={storePhone} storeName={branding.name} />}
    </div>
  )
}
