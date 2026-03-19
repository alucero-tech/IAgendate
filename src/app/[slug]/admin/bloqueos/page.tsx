import { getCurrentProfessional } from '@/features/auth/services/auth-actions'
import { getTimeBlockRequests, getMyTimeBlocks } from '@/features/calendar/services/time-block-actions'
import { getActiveProfessionals } from '@/features/calendar/services/calendar-actions'
import { BloqueosClient } from '@/features/calendar/components/bloqueos-client'
import { redirect } from 'next/navigation'

export default async function BloqueosPage() {
  const professional = await getCurrentProfessional()
  if (!professional) redirect('/login')

  const role = (professional.role as string) || (professional.is_owner ? 'owner' : 'professional')
  const hasGlobalAccess = role === 'owner' || role === 'manager'

  const blocks = hasGlobalAccess
    ? await getTimeBlockRequests()
    : await getMyTimeBlocks(professional.id)

  const professionals = hasGlobalAccess
    ? await getActiveProfessionals()
    : [{ id: professional.id, first_name: professional.first_name, last_name: professional.last_name, is_owner: professional.is_owner }]

  return (
    <BloqueosClient
      blocks={blocks}
      professionals={professionals}
      isOwner={professional.is_owner}
      currentProfessionalId={professional.id}
    />
  )
}
