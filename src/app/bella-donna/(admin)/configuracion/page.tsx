import { getCurrentProfessional } from '@/features/auth/services/auth-actions'
import { getStoreSettings } from '@/features/settings/services/settings-actions'
import { getDepositPercentage } from '@/features/booking/services/booking-actions'
import { ConfiguracionClient } from '@/features/settings/components/configuracion-client'
import { redirect } from 'next/navigation'

export default async function ConfiguracionPage() {
  const professional = await getCurrentProfessional()
  if (!professional?.is_owner) redirect('/bella-donna/dashboard')

  const [settings, depositPct] = await Promise.all([
    getStoreSettings(),
    getDepositPercentage(),
  ])

  return <ConfiguracionClient initialSettings={settings} initialDepositPct={depositPct} />
}
