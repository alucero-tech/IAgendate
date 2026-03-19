import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Must be authenticated
  if (!user) {
    redirect('/login')
  }

  // Must be the superadmin email
  const superadminEmail = process.env.SUPERADMIN_EMAIL
  if (!superadminEmail || user.email !== superadminEmail) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-bella-rose-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">IA</span>
          </div>
          <div>
            <h1 className="font-bold text-white">IAgendate</h1>
            <p className="text-xs text-gray-400">Panel de Superadmin</p>
          </div>
        </div>
        <span className="text-xs text-gray-500">{user.email}</span>
      </header>
      <main className="px-6 py-8 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  )
}
