/**
 * Tenant utilities — fuente única de verdad para resolución de paths y tenant_id.
 *
 * USO:
 *   import { getTenantPath, getTenantId } from '@/lib/tenant'
 *
 *   // En server actions (reemplaza los 65 revalidatePath hardcodeados):
 *   revalidatePath(getTenantPath(slug, '/admin/turnos'))
 *
 *   // En server actions para filtrar queries con admin client:
 *   const tenantId = await getTenantId(slug)
 *   const { data } = await supabase.from('bookings').select('*').eq('tenant_id', tenantId)
 *
 * MIGRACIÓN FUTURA a subdominios:
 *   Solo cambia la función getTenantPath(). El resto del código no cambia.
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ========== PATH RESOLVER ==========

/**
 * Construye el path de una ruta admin para un tenant dado.
 * Hoy: /[slug]/admin/[path]  →  mañana: cambiar solo esta función para subdominios.
 *
 * @param slug  - El slug del tenant (ej: 'bella-donna')
 * @param path  - El path relativo (ej: '/turnos', '/calendario')
 * @returns     - El path completo (ej: '/bella-donna/admin/turnos')
 */
export function getTenantPath(slug: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `/${slug}/admin${normalizedPath}`
}

/**
 * Construye el path de una ruta pública para un tenant dado.
 *
 * @param slug  - El slug del tenant (ej: 'bella-donna')
 * @param path  - El path relativo (ej: '/reservar', '/mi-turno')
 * @returns     - El path completo (ej: '/bella-donna/reservar')
 */
export function getTenantPublicPath(slug: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `/${slug}${normalizedPath}`
}

// ========== TENANT ID RESOLVER ==========

// Cache en memoria por proceso (se limpia con cada deploy)
const tenantCache = new Map<string, string>()

/**
 * Resuelve el UUID del tenant a partir del slug.
 * Cachea el resultado en memoria para evitar queries repetidas.
 *
 * @param slug - El slug del tenant (ej: 'bella-donna')
 * @returns    - El UUID del tenant, o null si no existe
 */
export async function getTenantId(slug: string): Promise<string | null> {
  if (tenantCache.has(slug)) {
    return tenantCache.get(slug)!
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (data?.id) {
    tenantCache.set(slug, data.id)
  }

  return data?.id ?? null
}

/**
 * Resuelve los datos completos del tenant a partir del slug.
 * Útil para el middleware y onboarding.
 */
export async function getTenant(slug: string): Promise<{
  id: string
  slug: string
  name: string
  plan: string
  status: string
  planExpiresAt: string | null
} | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('tenants')
    .select('id, slug, name, plan, status, plan_expires_at')
    .eq('slug', slug)
    .single()

  if (!data) return null

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    plan: data.plan,
    status: data.status,
    planExpiresAt: data.plan_expires_at,
  }
}

// ========== CONSTANTE TEMPORARIA (mientras se completa la migración de routing) ==========
// Durante la transición single-tenant → multi-tenant, las server actions
// siguen usando el slug de Bella Donna directamente.
// Se elimina cuando el routing dinámico esté implementado (Fase 3).
export const BELLA_DONNA_SLUG = 'bella-donna'
