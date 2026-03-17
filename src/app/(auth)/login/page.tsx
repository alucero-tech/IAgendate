import Link from 'next/link'
import { LoginForm } from '@/features/auth/components/login-form'
import { Scissors } from 'lucide-react'
import { getStoreName } from '@/features/settings/services/settings-actions'

export default async function LoginPage() {
  const storeName = await getStoreName()

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-bella-rose-100 mb-4">
            <Scissors className="w-8 h-8 text-bella-rose-600" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">{storeName}</h1>
          <p className="mt-2 text-muted-foreground">
            Ingresá con tu nombre o celular
          </p>
        </div>

        {/* Login Form */}
        <div className="rounded-2xl border border-border/50 bg-white/80 backdrop-blur-sm p-8 shadow-sm">
          <LoginForm />
        </div>

        {/* Back link */}
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/" className="text-bella-rose-600 hover:underline">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  )
}
