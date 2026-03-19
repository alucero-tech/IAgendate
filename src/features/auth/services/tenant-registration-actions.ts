'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { tenantRegistrationSchema, tenantSlugSchema } from '@/shared/schemas/zod-schemas'
import { addDays } from 'date-fns'

// ========== SLUG AVAILABILITY ==========

export async function checkSlugAvailability(slug: string): Promise<{ available: boolean; error?: string }> {
  const v = tenantSlugSchema.safeParse(slug)
  if (!v.success) return { available: false, error: v.error.issues[0].message }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  return { available: !data }
}

// ========== ATOMIC TENANT REGISTRATION ==========

export async function registerTenant(input: {
  name: string
  slug: string
  ownerName: string
  email: string
  password: string
}): Promise<{ success?: boolean; slug?: string; error?: string }> {
  const parsed = tenantRegistrationSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { name, slug, ownerName, email, password } = parsed.data
  const supabase = createAdminClient()

  let authUserId: string | null = null
  let tenantId: string | null = null

  try {
    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      if (authError?.message.includes('already been registered')) {
        return { error: 'Este email ya está registrado. Intentá iniciar sesión.' }
      }
      return { error: authError?.message ?? 'Error al crear el usuario' }
    }

    authUserId = authData.user.id

    // 2. Create tenant (trial: 14 days)
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name,
        slug,
        plan: 'trial',
        status: 'active',
        plan_expires_at: addDays(new Date(), 14).toISOString(),
        owner_email: email,
      })
      .select('id')
      .single()

    if (tenantError || !tenant) {
      if (tenantError?.message.includes('unique')) {
        return { error: 'El slug ya está en uso. Elegí otro.' }
      }
      throw new Error(tenantError?.message ?? 'Error al crear el tenant')
    }

    tenantId = tenant.id

    // 3. Create owner professional
    const [firstName, ...lastParts] = ownerName.trim().split(' ')
    const lastName = lastParts.join(' ') || '-'

    const { error: profError } = await supabase.from('professionals').insert({
      user_id: authUserId,
      tenant_id: tenantId,
      first_name: firstName,
      last_name: lastName,
      email,
      is_owner: true,
      role: 'owner',
      commission_percentage: 0,
    })

    if (profError) throw new Error(profError.message)

    // 4. Initialize store_settings with business name
    await supabase.from('store_settings').insert([
      { tenant_id: tenantId, key: 'store_name', value: name },
      { tenant_id: tenantId, key: 'deposit_percentage', value: '50' },
      { tenant_id: tenantId, key: 'cancellation_policy', value: 'La seña no se devuelve si cancelás con menos de 24hs de anticipación.' },
    ])

    return { success: true, slug }
  } catch (err) {
    // Rollback on failure
    if (tenantId) {
      await supabase.from('professionals').delete().eq('tenant_id', tenantId)
      await supabase.from('store_settings').delete().eq('tenant_id', tenantId)
      await supabase.from('tenants').delete().eq('id', tenantId)
    }
    if (authUserId) {
      await supabase.auth.admin.deleteUser(authUserId)
    }

    const message = err instanceof Error ? err.message : 'Error inesperado'
    return { error: message }
  }
}
