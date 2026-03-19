import Link from 'next/link'
import { TenantRegistrationForm } from '@/features/auth/components/tenant-registration-form'

export const metadata = {
  title: 'Crear mi sistema — IAgendate',
  description: 'Registrá tu negocio y empezá a recibir reservas online en 2 minutos.',
}

export default function RegistroPage() {
  return (
    <div className="min-h-screen bg-[#030711] relative overflow-hidden text-slate-50">
      {/* Blobs dark tech */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[200px] opacity-10 animate-blob" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500 rounded-full blur-[200px] opacity-8 animate-blob animation-delay-2000" />

      <div className="relative z-10 max-w-md mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block mb-6">
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-white">IAgendate</span>
            </div>
          </Link>
          <p className="text-slate-400 text-sm">Sistema de reservas para tu negocio</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl backdrop-blur-sm p-8 shadow-xl">
          <TenantRegistrationForm />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-6">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 hover:underline font-medium transition-colors">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
