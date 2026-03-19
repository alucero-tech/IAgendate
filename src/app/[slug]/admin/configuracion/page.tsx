import { getCurrentProfessional } from '@/features/auth/services/auth-actions'
import { getStoreSettings } from '@/features/settings/services/settings-actions'
import { getDepositPercentage } from '@/features/booking/services/booking-actions'
import { ConfiguracionClient } from '@/features/settings/components/configuracion-client'
import { redirect } from 'next/navigation'

export default async function ConfiguracionPage({ params }: { params: Promise<{ slug: string }> }) {
  const professional = await getCurrentProfessional()
  if (!professional?.is_owner) {
    const { slug } = await params
    redirect(`/${slug}/admin/dashboard`)
  }

  const [settings, depositPct] = await Promise.all([
    getStoreSettings(),
    getDepositPercentage(professional!.tenant_id),
  ])

  return <ConfiguracionClient initialSettings={settings} initialDepositPct={depositPct} />
}
