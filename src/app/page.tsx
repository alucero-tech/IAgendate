import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Calendar,
  CreditCard,
  Users,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Smartphone,
  Bell,
  Zap,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'IAgendate — Sistema de turnos para negocios de servicios',
  description:
    'Tus clientes reservan solos, pagan la seña online y reciben recordatorios automáticos. Gestión completa de turnos, profesionales y pagos para cualquier negocio basado en agenda.',
  keywords: ['reservas online', 'sistema turnos', 'gestión agenda', 'turnos online', 'cobrar seña', 'negocios de servicios'],
  openGraph: {
    title: 'IAgendate — Terminá con el caos de WhatsApp',
    description:
      'Sin caos de WhatsApp. Tus clientes reservan 24/7, pagan la seña y vos solo atendés.',
    url: 'https://iagendate.vercel.app',
    siteName: 'IAgendate',
    locale: 'es_AR',
    type: 'website',
    images: [
      {
        url: 'https://iagendate.vercel.app/icons/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'IAgendate — Turnos online para tu negocio',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'IAgendate — Terminá con el caos de WhatsApp',
    description: 'Sin caos de WhatsApp. Turnos 24/7, seña online y recordatorios automáticos.',
  },
  metadataBase: new URL('https://iagendate.vercel.app'),
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#030711] relative overflow-hidden text-slate-50">
      {/* Mesh gradient blobs — electric blue/cyan */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600 rounded-full blur-[200px] opacity-10 animate-blob" />
      <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-cyan-500 rounded-full blur-[200px] opacity-8 animate-blob animation-delay-2000" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-800 rounded-full blur-[200px] opacity-10 animate-blob animation-delay-4000" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto border-b border-slate-800/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold text-white">IAgendate</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Funciones</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">Cómo funciona</a>
          <a href="#pricing" className="hover:text-white transition-colors">Precios</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-800">
              Ingresar
            </Button>
          </Link>
          <Link href="/registro">
            <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-5 shadow-lg shadow-blue-500/25">
              Activar mi negocio
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-28 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-950/60 border border-blue-800/60 text-blue-400 text-sm px-4 py-1.5 rounded-full mb-8 backdrop-blur-sm">
          <Zap className="w-3.5 h-3.5" />
          Para peluquerías, estéticas, masajistas, consultorios y más
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
          Tu negocio,
          <span className="block bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
            sin caos de WhatsApp
          </span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Tus clientes reservan solos, pagan la seña online y reciben recordatorios automáticos.
          Vos solo atendés. Sin idas y vueltas, sin turnos perdidos, sin plata que se escapa.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/registro">
            <Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white px-10 py-6 text-lg rounded-full shadow-xl shadow-blue-500/30 w-full sm:w-auto group transition-all hover:shadow-blue-500/50">
              Activar mi negocio
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link href="/bella-donna/reservar">
            <Button size="lg" variant="outline" className="px-8 py-6 text-lg rounded-full w-full sm:w-auto border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-600">
              Ver demo en vivo
            </Button>
          </Link>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Configuración en 5 minutos · Soporte por WhatsApp
        </p>

        {/* Social proof */}
        <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {['✂️', '💆', '💅', '🩺'].map((emoji, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-sm">
                  {emoji}
                </div>
              ))}
            </div>
            <span>+50 negocios activos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-cyan-500" />
            <span>99.9% uptime</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-blue-400" />
            <span>Pagos seguros con Mercado Pago</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Todo lo que tu negocio necesita
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Diseñado para negocios de servicios argentinos que trabajan con turnos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon={<Calendar className="w-5 h-5 text-blue-400" />}
            iconBg="bg-blue-950/80 border-blue-800/50"
            title="Reservas 24/7"
            description="Tus clientes reservan desde el celular a cualquier hora, sin llamadas ni mensajes de WhatsApp."
          />
          <FeatureCard
            icon={<CreditCard className="w-5 h-5 text-cyan-400" />}
            iconBg="bg-cyan-950/80 border-cyan-800/50"
            title="Seña online garantizada"
            description="Cobrás la seña automáticamente por Mercado Pago o transferencia. Sin ausentismo, sin plata perdida."
          />
          <FeatureCard
            icon={<Users className="w-5 h-5 text-blue-300" />}
            iconBg="bg-blue-950/80 border-blue-800/50"
            title="Gestión de equipo"
            description="Cada profesional ve solo su agenda. Comisiones, liquidaciones y rendimiento individual automatizados."
          />
          <FeatureCard
            icon={<Bell className="w-5 h-5 text-cyan-400" />}
            iconBg="bg-cyan-950/80 border-cyan-800/50"
            title="Recordatorios automáticos"
            description="Notificaciones push que eliminan los no-shows. Tus clientes reciben aviso antes de cada turno."
          />
          <FeatureCard
            icon={<BarChart3 className="w-5 h-5 text-blue-400" />}
            iconBg="bg-blue-950/80 border-blue-800/50"
            title="Métricas en tiempo real"
            description="Dashboard con ingresos, servicios más vendidos y rendimiento por profesional. Sabés cuánto ganás."
          />
          <FeatureCard
            icon={<Smartphone className="w-5 h-5 text-cyan-400" />}
            iconBg="bg-cyan-950/80 border-cyan-800/50"
            title="App instalable (PWA)"
            description="Tus clientes instalan la app sin ir a la App Store. Funciona en cualquier celular, sin fricción."
          />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative z-10 max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            En 5 minutos estás operativo
          </h2>
          <p className="text-slate-400 text-lg">Sin instalaciones ni conocimientos técnicos.</p>
        </div>

        <div className="space-y-4">
          {[
            {
              step: '01',
              title: 'Activás tu negocio',
              desc: 'Registrás tu negocio con nombre y URL única (ej: iagendate.vercel.app/mi-negocio). En 5 minutos.',
            },
            {
              step: '02',
              title: 'Cargás tus servicios',
              desc: 'Agregás servicios, precios, duraciones y asignás profesionales a cada uno.',
            },
            {
              step: '03',
              title: 'Compartís el link',
              desc: 'Mandás el link por Instagram, WhatsApp o lo ponés en tu bio. Tus clientes hacen el resto solos.',
            },
            {
              step: '04',
              title: 'Gestionás todo desde el dashboard',
              desc: 'Calendarios, liquidaciones, bloqueos, métricas. Todo en un solo lugar, desde tu celular.',
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-6 items-start bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm hover:border-slate-700 transition-colors">
              <div className="text-3xl font-black text-slate-700 shrink-0 w-12 text-right font-mono">{step}</div>
              <div>
                <h3 className="font-semibold text-white text-lg mb-1">{title}</h3>
                <p className="text-slate-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 max-w-3xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Precio simple y transparente</h2>
          <p className="text-slate-400 text-lg">Sin sorpresas. Sin comisiones por reserva. Sin letra chica.</p>
        </div>

        <div className="max-w-sm mx-auto">
          <PricingCard
            plan="Acceso total"
            price="$50.000"
            period="/ mes"
            features={[
              'Profesionales ilimitados',
              'Reservas y turnos ilimitados',
              'Seña online (Mercado Pago o transferencia)',
              'Calendario día / semana / mes',
              'Liquidaciones automáticas',
              'Métricas y rendimiento',
              'Recordatorios automáticos (push)',
              'App instalable (PWA)',
              'Soporte por WhatsApp',
            ]}
            cta="Activar mi negocio"
            href="/registro"
            highlight
          />
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Si tu sistema te ahorra 5 horas de WhatsApp a la semana, ya se pagó solo.
        </p>
      </section>

      {/* CTA Final */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="bg-gradient-to-b from-slate-900 to-slate-900/80 border border-slate-800 rounded-3xl p-12 relative overflow-hidden">
          {/* Glow interior */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-cyan-600/10 rounded-3xl" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Dejá de perder clientes por el caos de WhatsApp
            </h2>
            <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
              Cada turno que coordinás por chat es tiempo y plata que perdés.
              Activá tu negocio hoy y empezá a recibir reservas en automático.
            </p>
            <Link href="/registro">
              <Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white px-12 py-6 text-xl rounded-full shadow-xl shadow-blue-500/30 group transition-all hover:shadow-blue-500/50">
                Activar mi negocio ahora
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <p className="mt-4 text-sm text-slate-500">Configuración en 5 minutos · Soporte por WhatsApp</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 mt-8">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Calendar className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-white">IAgendate</span>
            <span className="text-slate-600">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-white transition-colors">Ingresar</Link>
            <Link href="/registro" className="hover:text-white transition-colors">Registrarse</Link>
            {process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP && (
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP}`}
                className="hover:text-white transition-colors"
              >
                Soporte
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  iconBg,
  title,
  description,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
  description: string
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm hover:border-slate-700 hover:bg-slate-900/80 transition-all group">
      <div className={`w-10 h-10 rounded-xl border ${iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  )
}

function PricingCard({
  plan,
  price,
  period,
  features,
  cta,
  href,
  highlight,
}: {
  plan: string
  price: string
  period: string
  features: string[]
  cta: string
  href: string
  highlight: boolean
}) {
  return (
    <div className={`rounded-2xl p-8 border relative overflow-hidden ${
      highlight
        ? 'border-blue-600/60 bg-gradient-to-b from-blue-950/60 to-slate-900/80 shadow-xl shadow-blue-500/10'
        : 'border-slate-800 bg-slate-900/60'
    }`}>
      {highlight && (
        <>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-blue-500/70 to-transparent" />
          <div className="text-xs font-semibold text-blue-400 bg-blue-950/80 border border-blue-800/60 px-3 py-1 rounded-full inline-block mb-4">
            Más popular
          </div>
        </>
      )}
      <h3 className="text-lg font-semibold text-white mb-2">{plan}</h3>
      <div className="flex items-baseline gap-1 mb-6">
        <span className="text-4xl font-black text-white">{price}</span>
        {period && <span className="text-slate-400">{period}</span>}
      </div>
      <ul className="space-y-3 mb-8">
        {features.map(f => (
          <li key={f} className="flex items-center gap-2.5 text-sm text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <Link href={href}>
        <Button
          className={`w-full rounded-full ${
            highlight
              ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
          variant={highlight ? 'default' : 'outline'}
        >
          {cta}
        </Button>
      </Link>
    </div>
  )
}
