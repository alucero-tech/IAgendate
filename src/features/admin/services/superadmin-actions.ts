'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { addDays } from 'date-fns'
import { uuidSchema } from '@/shared/schemas/zod-schemas'
import { z } from 'zod'

// ── Guard: only superadmin can call these actions ─────────────────────────────

async function assertSuperadmin(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const superadminEmail = process.env.SUPERADMIN_EMAIL
  if (!user || !superadminEmail || user.email !== superadminEmail) {
    throw new Error('Acceso denegado')
  }
}

// ── Extend plan ───────────────────────────────────────────────────────────────

const extendPlanSchema = z.object({
  tenantId: uuidSchema,
  days: z.number().int().min(1).max(365),
})

export async function extendTenantPlan(
  tenantId: string,
  days: number
): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertSuperadmin()
    const parsed = extendPlanSchema.safeParse({ tenantId, days })
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const supabase = createAdminClient()

    // Get current plan_expires_at to extend from
    const { data: tenant } = await supabase
      .from('tenants')
      .select('plan_expires_at')
      .eq('id', tenantId)
      .single()

    const baseDate = tenant?.plan_expires_at && new Date(tenant.plan_expires_at) > new Date()
      ? new Date(tenant.plan_expires_at)
      : new Date()

    const newExpiry = addDays(baseDate, days).toISOString()

    const { error } = await supabase
      .from('tenants')
      .update({ plan_expires_at: newExpiry, status: 'active' })
      .eq('id', tenantId)

    if (error) return { error: error.message }

    revalidatePath('/superadmin')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado' }
  }
}

// ── Suspend tenant ────────────────────────────────────────────────────────────

export async function suspendTenant(tenantId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertSuperadmin()
    const v = uuidSchema.safeParse(tenantId)
    if (!v.success) return { error: v.error.issues[0].message }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('tenants')
      .update({ status: 'suspended' })
      .eq('id', tenantId)

    if (error) return { error: error.message }

    revalidatePath('/superadmin')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado' }
  }
}

// ── Activate tenant ───────────────────────────────────────────────────────────

export async function activateTenant(tenantId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    await assertSuperadmin()
    const v = uuidSchema.safeParse(tenantId)
    if (!v.success) return { error: v.error.issues[0].message }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('tenants')
      .update({ status: 'active' })
      .eq('id', tenantId)

    if (error) return { error: error.message }

    revalidatePath('/superadmin')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado' }
  }
}

// ── List all tenants ──────────────────────────────────────────────────────────

export async function getAllTenants() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, slug, name, plan, status, plan_expires_at, owner_email, mp_subscription_id, created_at')
    .order('created_at', { ascending: false })

  if (error) return []
  return data ?? []
}

// ── Recent webhook logs ───────────────────────────────────────────────────────

export async function getRecentWebhookLogs(limit = 20) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('webhook_logs')
    .select('id, event_type, event_id, tenant_id, status, error_message, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  return data ?? []
}
