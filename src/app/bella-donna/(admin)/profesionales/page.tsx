import { getProfessionals } from '@/features/professionals/services/professional-actions'
import { getCurrentProfessional } from '@/features/auth/services/auth-actions'
import { getPendingSettlementsByProfessional } from '@/features/metrics/services/metrics-actions'
import { ProfessionalsClient } from './professionals-client'
import { redirect } from 'next/navigation'

export default async function ProfesionalesPage() {
  const currentUser = await getCurrentProfessional()
  if (!currentUser) redirect('/login')

  const professionals = await getProfessionals()
  const isOwner = currentUser.is_owner
  const pendingSettlements = isOwner ? await getPendingSettlementsByProfessional() : {}

  return (
    <ProfessionalsClient
      professionals={professionals}
      isOwner={isOwner}
      pendingSettlements={pendingSettlements}
    />
  )
}
