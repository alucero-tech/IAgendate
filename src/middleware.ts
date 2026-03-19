import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================================
// CACHÉ EN MEMORIA: slug → { id, status, plan_expires_at }
// TTL de 5 minutos para plan_expires_at (detecta vencimiento rápido).
// Se invalida con cada deploy. Para volumen alto, migrar a Redis.
// ============================================================
type TenantCacheEntry = {
  id: string
  status: string
  plan_expires_at: string | null
  cachedAt: number
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

const tenantCache = new Map<string, TenantCacheEntry | null>()

async function resolveTenant(slug: string): Promise<TenantCacheEntry | null> {
  const cached = tenantCache.get(slug)
  if (cached !== undefined) {
    // Revalidar si el entry expiró (para detectar cambios en plan_expires_at)
    if (cached === null || Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached
    }
    tenantCache.delete(slug)
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&select=id,status,plan_expires_at&limit=1`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    tenantCache.set(slug, null)
    return null
  }

  const rows = await res.json() as Array<{ id: string; status: string; plan_expires_at: string | null }>
  const row = rows[0] ?? null
  const tenant = row ? { ...row, cachedAt: Date.now() } : null
  tenantCache.set(slug, tenant)
  return tenant
}

/**
 * Verifica si el plan del tenant está activo (no vencido).
 * Usado por layouts de admin para el "portero de suscripciones".
 */
export function isTenantPlanActive(planExpiresAt: string | null): boolean {
  if (!planExpiresAt) return true // sin fecha = sin límite (plan legacy)
  return new Date(planExpiresAt) > new Date()
}

// Segmentos que corresponden a rutas admin (sin /admin/ prefix, patrón actual de Phase 2)
// Phase 3 agregará `/[slug]/admin/[path]` — este array se mantiene para backward compat
const ADMIN_SUBPATHS = new Set([
  'dashboard', 'calendario', 'turnos', 'profesionales',
  'tratamientos', 'bloqueos', 'liquidaciones', 'metricas', 'configuracion',
  'admin', // prefix de Phase 3: /[slug]/admin/...
])

function isAdminPath(segments: string[]): boolean {
  // Pattern actual:  /[slug]/dashboard → segments[1] = 'dashboard'
  // Pattern Phase 3: /[slug]/admin/dashboard → segments[1] = 'admin'
  return segments.length >= 2 && ADMIN_SUBPATHS.has(segments[1])
}

// Rutas que no tienen tenant (plataforma global)
const PLATFORM_ROUTES = new Set(['login', 'registro', 'superadmin', 'api', 'planes', 'cuenta-suspendida'])

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const segments = pathname.split('/').filter(Boolean) // ['bella-donna', 'dashboard', ...]

  // ── 1. Rutas de plataforma: sin tenant, pasar directo ──────────────────
  if (segments.length === 0 || PLATFORM_ROUTES.has(segments[0])) {
    return await handleAuth(request, null, pathname)
  }

  const slug = segments[0]

  // ── 2. Resolver tenant desde caché/BD ──────────────────────────────────
  const tenant = await resolveTenant(slug)

  if (!tenant) {
    // Slug no existe → 404
    return NextResponse.rewrite(new URL('/not-found', request.url))
  }

  if (tenant.status !== 'active') {
    // Tenant suspendido/cancelado → página de cuenta suspendida
    const url = request.nextUrl.clone()
    url.pathname = '/cuenta-suspendida'
    url.searchParams.set('slug', slug)
    return NextResponse.redirect(url)
  }

  // ── Plan expirado: solo bloquea rutas admin ─────────────────────────────
  if (isAdminPath(segments) && !isTenantPlanActive(tenant.plan_expires_at)) {
    const url = request.nextUrl.clone()
    url.pathname = '/planes'
    url.searchParams.set('slug', slug)
    return NextResponse.redirect(url)
  }

  // ── 3. Inyectar headers de tenant en TODAS las requests ────────────────
  // Los Server Components y Server Actions leen estos headers para
  // saber a qué tenant pertenece la request, sin tocar la BD.
  const response = await handleAuth(request, tenant.id, pathname, isAdminPath(segments), slug)
  response.headers.set('x-tenant-id', tenant.id)
  response.headers.set('x-tenant-slug', slug)
  return response
}

// ── Auth: reutiliza cliente Supabase SSR con manejo de cookies ─────────────
async function handleAuth(
  request: NextRequest,
  tenantId: string | null,
  pathname: string,
  isAdmin = false,
  slug = ''
) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Record<string, unknown>)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ── Rutas admin: requieren sesión ────────────────────────────────────────
  if (isAdmin && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // ── /login con sesión activa → redirigir a dashboard del tenant ──────────
  if (pathname === '/login' && user && slug) {
    const url = request.nextUrl.clone()
    url.pathname = `/${slug}/admin/dashboard`
    return NextResponse.redirect(url)
  }

  // ── /login global (sin slug) con sesión activa → Bella Donna ────────────
  if (pathname === '/login' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/bella-donna/admin/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
