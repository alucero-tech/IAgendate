import Link from 'next/link'
import Image from 'next/image'
import { Scissors, Clock, CreditCard, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getStoreBranding } from '@/features/settings/services/settings-actions'
import { InstallBanner } from '@/shared/components/install-banner'

export default async function HomePage() {
  const branding = await getStoreBranding()

  return (
    <div className="min-h-screen mesh-gradient-bg relative overflow-hidden">
      {/* Blobs decorativos */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-bella-rose-300 rounded-full blur-[150px] opacity-30 animate-blob" />
      <div className="absolute top-1/2 right-1/4 w-[350px] h-[350px] bg-bella-violet-300 rounded-full blur-[150px] opacity-25 animate-blob animation-delay-2000" />
      <div className="absolute bottom-0 left-1/2 w-[300px] h-[300px] bg-bella-gold-300 rounded-full blur-[150px] opacity-20 animate-blob animation-delay-4000" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          {branding.logoUrl && (
            <Image src={branding.logoUrl} alt={branding.name} width={40} height={40} className="w-10 h-10 rounded-lg object-contain" />
          )}
          <h1 className="text-2xl font-bold text-bella-rose-600">
            {branding.name}
          </h1>
        </div>
        <Link href="/login">
          <Button variant="outline" size="sm">
            Ingresar
          </Button>
        </Link>
      </header>

      {/* Hero */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 pt-16 pb-24 text-center">
        <h2 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
          Reservá tu turno
          <span className="block text-bella-rose-500">en segundos</span>
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          Elegí tu tratamiento, seleccioná el horario que te quede mejor y confirmá con el pago. Así de fácil.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/reservar">
            <Button size="lg" className="bg-bella-rose-600 hover:bg-bella-rose-700 text-white px-10 py-6 text-lg rounded-full shadow-lg shadow-bella-rose-200 w-full sm:w-auto">
              Reservar turno
            </Button>
          </Link>
          <Link href="/mi-turno">
            <Button size="lg" variant="outline" className="px-8 py-6 text-lg rounded-full w-full sm:w-auto">
              Consultar mi turno
            </Button>
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
          <FeatureCard
            icon={<Scissors className="w-8 h-8 text-bella-rose-500" />}
            title="Elegí tu tratamiento"
            description="Todas las especialidades disponibles para vos"
          />
          <FeatureCard
            icon={<Calendar className="w-8 h-8 text-bella-violet-500" />}
            title="Horarios en tiempo real"
            description="Solo ves los turnos realmente disponibles"
          />
          <FeatureCard
            icon={<CreditCard className="w-8 h-8 text-bella-gold-500" />}
            title="Pagá la seña online"
            description="Seña por Mercado Pago o transferencia"
          />
          <FeatureCard
            icon={<Clock className="w-8 h-8 text-bella-rose-400" />}
            title="Reagendá si necesitás"
            description="Podés cambiar tu turno 1 vez sin costo"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8 text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} {branding.name}. Todos los derechos reservados.</p>
        <p className="text-xs mt-1 opacity-60">Potenciado por IAgendate</p>
      </footer>

      <InstallBanner />
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="mesh-gradient-card rounded-2xl p-6 border border-border/50 backdrop-blur-sm">
      <div className="mb-4">{icon}</div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
