import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfessional } from '@/features/auth/services/auth-actions'
import { getActiveProfessionals } from '@/features/calendar/services/calendar-actions'
import { TurnosClient } from './turnos-client'

export default async function TurnosPage() {
  const professional = await getCurrentProfessional()
  if (!professional) return null

  const supabase = createAdminClient()

  let query = supabase
    .from('bookings')
    .select(`
      *,
      clients (first_name, last_name, phone, email),
      booking_items (
        id,
        treatment_id,
        professional_id,
        start_time,
        end_time,
        price,
        deposit_amount,
        is_addon,
        addon_status,
        referred_by,
        transfer_status,
        original_professional_id,
        treatments (name, duration_minutes, price, categories (name)),
        professionals!booking_items_professional_id_fkey (first_name, last_name)
      )
    `)
    .order('booking_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(100)

  const role = (professional.role as string) || (professional.is_owner ? 'owner' : 'professional')
  const hasGlobalAccess = role === 'owner' || role === 'manager'

  // Non-owner/manager professionals only see bookings where they are assigned
  if (!hasGlobalAccess) {
    // Get booking IDs where this professional has items
    const { data: itemBookingIds } = await supabase
      .from('booking_items')
      .select('booking_id')
      .eq('professional_id', professional.id)

    const bookingIds = (itemBookingIds || []).map(i => i.booking_id)

    // Also include legacy bookings assigned directly
    query = query.or(
      `professional_id.eq.${professional.id}` +
      (bookingIds.length > 0 ? `,id.in.(${bookingIds.join(',')})` : '')
    )
  }

  const { data: bookings } = await query
  const professionals = await getActiveProfessionals()

  return (
    <TurnosClient
      bookings={bookings || []}
      professionals={professionals}
      isOwner={professional.is_owner}
      role={role}
      currentProfessionalId={professional.id}
    />
  )
}
