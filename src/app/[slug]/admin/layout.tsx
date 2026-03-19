import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfessional } from '@/features/auth/services/auth-actions'
import { getStoreBranding } from '@/features/settings/services/settings-actions'
import { getStorePhone } from '@/features/booking/services/booking-actions'
import { Sidebar } from '@/shared/components/sidebar'
import { ContactButtons } from '@/shared/components/contact-buttons'
import { PushAutoRegister } from '@/shared/components/push-auto-register'
import { BiometricSetup } from '@/shared/components/biometric-setup'
import { PlanExpiryBanner } from '@/features/admin/components/plan-expiry-banner'

export default async function MainLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Si no hay sesión auth, redirigir a login
  if (!user) {
    redirect('/login')
  }

  const [professional, branding, storePhone] = await Promise.all([
    getCurrentProfessional(),
    getStoreBranding(),
    getStorePhone(),
  ])

  // Si hay sesión pero no tiene registro de profesional, cerrar sesión y redirigir
  if (!professional) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  // Leer plan_expires_at solo para owner (evita query innecesaria para otros roles)
  let planExpiresAt: string | null = null
  if (professional.is_owner) {
    const admin = createAdminClient()
    const { data: tenant } = await admin
      .from('tenants')
      .select('plan_expires_at')
      .eq('id', professional.tenant_id)
      .single()
    planExpiresAt = tenant?.plan_expires_at ?? null
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar
        professionalName={`${professional.first_name} ${professional.last_name}`}
        isOwner={professional.is_owner}
        role={(professional.role as 'professional' | 'manager' | 'owner') || (professional.is_owner ? 'owner' : 'professional')}
        storeName={branding.name}
        logoUrl={branding.logoUrl || undefined}
        slug={slug}
      />
      <main className="flex-1 overflow-auto">
        {professional.is_owner && (
          <PlanExpiryBanner planExpiresAt={planExpiresAt} slug={slug} />
        )}
        <div className="pt-16 lg:pt-0 px-4 pb-6 lg:p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <ContactButtons phone={storePhone} storeName={branding.name} />
      <PushAutoRegister professionalId={professional.id} />
      <BiometricSetup professionalId={professional.id} />
    </div>
  )
}
