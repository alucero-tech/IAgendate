import Link from 'next/link'
import { TenantRegistrationForm } from '@/features/auth/components/tenant-registration-form'

export const metadata = {
  title: 'Crear mi sistema — IAgendate',
  description: 'Registrá tu negocio y empezá a recibir reservas online en 2 minutos.',
}

export default function RegistroPage() {
  return (
    <div className="min-h-screen mesh-gradient-bg relative overflow-hidden">
      {/* Blobs */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-bella-rose-300 rounded-full blur-[150px] opacity-25 animate-blob" />
      <div className="absolute bottom-0 right-1/4 w-[350px] h-[350px] bg-bella-violet-300 rounded-full blur-[150px] opacity-20 animate-blob animation-delay-2000" />

      <div className="relative z-10 max-w-md mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block mb-6">
            <h1 className="text-3xl font-bold text-bella-rose-600">IAgendate</h1>
          </Link>
          <p className="text-muted-foreground text-sm">Sistema de reservas para tu negocio</p>
        </div>

        {/* Card */}
        <div className="mesh-gradient-card rounded-2xl border border-border/50 backdrop-blur-sm p-8">
          <TenantRegistrationForm />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-bella-rose-600 hover:underline font-medium">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
