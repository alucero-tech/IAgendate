import { format } from 'date-fns'
import { getCurrentProfessional } from '@/features/auth/services/auth-actions'
import {
  getWeekBookings,
  getActiveProfessionals,
} from '@/features/calendar/services/calendar-actions'
import { CalendarClient } from './calendar-client'

export default async function CalendarioPage() {
  const professional = await getCurrentProfessional()
  if (!professional) return null

  const today = format(new Date(), 'yyyy-MM-dd')

  const role = (professional.role as string) || (professional.is_owner ? 'owner' : 'professional')
  const hasGlobalAccess = role === 'owner' || role === 'manager'

  // Owner/manager see global calendar, professional sees own only
  const bookings = await getWeekBookings(
    today,
    hasGlobalAccess ? undefined : professional.id
  )

  const professionals = hasGlobalAccess
    ? await getActiveProfessionals()
    : [{ id: professional.id, first_name: professional.first_name, last_name: professional.last_name, is_owner: professional.is_owner }]

  return (
    <CalendarClient
      initialBookings={bookings}
      professionals={professionals}
      currentProfessionalId={professional.id}
      isOwner={professional.is_owner}
      initialDate={today}
    />
  )
}
