import Link from 'next/link'
import { PauseCircle, MessageCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CuentaSuspendidaPageProps {
  searchParams: Promise<{ slug?: string }>
}

export const metadata = {
  title: 'Cuenta en pausa — IAgendate',
  robots: 'noindex',
}

export default async function CuentaSuspendidaPage({ searchParams }: CuentaSuspendidaPageProps) {
  const { slug } = await searchParams

  const waNumber = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '5491100000000'
  const waText = encodeURIComponent(
    `Hola, quiero reactivar mi cuenta de IAgendate${slug ? ` (/${slug})` : ''}. ¿Pueden ayudarme?`
  )
  const waLink = `https://wa.me/${waNumber}?text=${waText}`

  return (
    <div className="min-h-screen bg-[#030711] relative overflow-hidden text-slate-50 flex items-center justify-center px-4">
      {/* Blobs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-600 rounded-full blur-[200px] opacity-8 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-amber-500 rounded-full blur-[200px] opacity-6 pointer-events-none" />

      <div className="relative z-10 max-w-md w-full text-center space-y-8">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <PauseCircle className="w-10 h-10 text-amber-400" />
          </div>
        </div>

        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2 justify-center">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-400">IAgendate</span>
        </Link>

        {/* Message */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-white">
            Tu cuenta está en pausa
          </h1>
          <p className="text-slate-400 leading-relaxed">
            {slug
              ? <>El acceso a <span className="font-mono text-slate-300 text-sm">/{slug}</span> está temporalmente suspendido.</>
              : 'El acceso a tu sistema está temporalmente suspendido.'
            }
            {' '}Tus datos están seguros — solo necesitás renovar tu plan para continuar.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="block">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base">
              <MessageCircle className="w-5 h-5 mr-2" />
              Reactivar mi cuenta
            </Button>
          </a>

          <Link href={`/planes${slug ? `?slug=${slug}` : ''}`} className="block">
            <Button variant="outline" className="w-full h-11 border-slate-700 text-slate-300 hover:bg-slate-800">
              Ver planes disponibles
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        {/* Reassurance */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-left space-y-2">
          <p className="text-xs font-medium text-slate-300">¿Qué pasa con mis datos?</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Toda tu información — clientes, turnos, tratamientos y configuración — está guardada y protegida.
            Al reactivar el plan, tu sistema vuelve exactamente como lo dejaste.
          </p>
        </div>

        <Link href="/login" className="block text-xs text-slate-600 hover:text-slate-400 transition-colors">
          ← Volver al login
        </Link>
      </div>
    </div>
  )
}
