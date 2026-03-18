import { getCurrentProfessional } from '@/features/auth/services/auth-actions'
import { getSettlements } from '@/features/metrics/services/metrics-actions'
import { LiquidacionesClient } from '@/features/metrics/components/liquidaciones-client'
import { redirect } from 'next/navigation'

export default async function LiquidacionesPage() {
  const professional = await getCurrentProfessional()
  if (!professional) redirect('/login')

  const role = (professional.role as string) || (professional.is_owner ? 'owner' : 'professional')
  const hasGlobalAccess = role === 'owner' || role === 'manager'

  const settlements = await getSettlements(
    hasGlobalAccess ? undefined : professional.id
  )

  return (
    <LiquidacionesClient
      settlements={settlements}
      isOwner={professional.is_owner}
      role={role}
      currentProfessionalId={professional.id}
    />
  )
}
