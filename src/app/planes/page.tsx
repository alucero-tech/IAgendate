import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Clock, Zap, Building2, MessageCircle } from 'lucide-react'

interface PlanesPageProps {
  searchParams: Promise<{ slug?: string }>
}

const PLANES = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$X',
    period: '/mes',
    description: 'Para negocios pequeños que están empezando',
    features: ['Hasta 3 profesionales', 'Reservas online ilimitadas', 'Calendario', 'Notificaciones push'],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$Y',
    period: '/mes',
    description: 'El plan más popular para negocios en crecimiento',
    features: ['Hasta 8 profesionales', 'Todo lo de Starter', 'Asistente IA', 'Liquidaciones automáticas', 'Métricas avanzadas'],
    highlight: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$Z',
    period: '/mes',
    description: 'Para cadenas y salones con múltiples sucursales',
    features: ['Profesionales ilimitados', 'Todo lo de Pro', 'White-label', 'Soporte prioritario', 'Onboarding dedicado'],
    highlight: false,
  },
]

export default async function PlanesPage({ searchParams }: PlanesPageProps) {
  const { slug } = await searchParams

  const waMessage = encodeURIComponent(
    `Hola, quiero renovar mi plan de IAgendate${slug ? ` para el negocio /${slug}` : ''}. ¿Pueden ayudarme?`
  )
  const waNumber = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '5491100000000'
  const waLink = `https://wa.me/${waNumber}?text=${waMessage}`

  return (
    <div className="min-h-screen mesh-gradient-bg relative overflow-hidden">
      {/* Blobs */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-bella-rose-300 rounded-full blur-[150px] opacity-20 animate-blob" />
      <div className="absolute bottom-0 right-1/4 w-[350px] h-[350px] bg-bella-violet-300 rounded-full blur-[150px] opacity-15 animate-blob animation-delay-2000" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <Clock className="w-4 h-4" />
            {slug ? `El plan de /${slug} ha vencido` : 'Tu período de prueba ha vencido'}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Elegí tu plan para continuar
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Todos tus datos están seguros. Suscribite para volver a acceder a tu sistema de reservas.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {PLANES.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl border p-6 flex flex-col ${
                plan.highlight
                  ? 'border-bella-rose-400 bg-white shadow-xl shadow-bella-rose-100 relative'
                  : 'border-border/50 mesh-gradient-card backdrop-blur-sm'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-bella-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Más popular
                  </span>
                </div>
              )}

              <div className="mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className={`w-5 h-5 ${plan.highlight ? 'text-bella-rose-500' : 'text-bella-violet-500'}`} />
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
              </div>

              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <Button
                  className={`w-full ${
                    plan.highlight
                      ? 'bg-bella-rose-600 hover:bg-bella-rose-700 text-white'
                      : 'variant-outline'
                  }`}
                  variant={plan.highlight ? 'default' : 'outline'}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Contratar {plan.name}
                </Button>
              </a>
            </div>
          ))}
        </div>

        {/* Help text */}
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            ¿Necesitás más información?{' '}
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="text-bella-rose-600 hover:underline font-medium">
              Escribinos por WhatsApp
            </a>
          </p>
          {slug && (
            <p className="text-xs text-muted-foreground">
              Una vez confirmado el pago, tu acceso a{' '}
              <span className="font-mono text-bella-rose-600">/{slug}</span> se reactivará automáticamente.
            </p>
          )}
          <Link href="/login" className="inline-block text-xs text-muted-foreground hover:underline">
            ← Volver al login
          </Link>
        </div>
      </div>
    </div>
  )
}
