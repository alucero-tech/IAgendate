import { getProfessionals } from '@/features/professionals/services/professional-actions'
import { ProfessionalsClient } from './professionals-client'

export default async function ProfesionalesPage() {
  const professionals = await getProfessionals()

  return <ProfessionalsClient professionals={professionals} />
}
