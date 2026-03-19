import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================================
// CACHÉ EN MEMORIA: slug → { id, status }
// Se invalida con cada deploy (correcto para un SaaS que
// raramente cambia slugs). Para volumen alto, migrar a Redis.
// ============================================================
const tenantCache = new Map<string, { id: string; status: string } | null>()

async function resolveTenant(slug: string): Promise<{ id: string; status: string } | null> {
  if (tenantCache.has(slug)) return tenantCache.get(slug)!

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&select=id,status&limit=1`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      // Edge runtime: no cache propio de fetch, el Map lo maneja
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    tenantCache.set(slug, null)
    return null
  }

  const rows = await res.json() as Array<{ id: string; status: string }>
  const tenant = rows[0] ?? null
  tenantCache.set(slug, tenant)
  return tenant
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
const PLATFORM_ROUTES = new Set(['login', 'registro', 'superadmin', 'api'])

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
    // Tenant suspendido → página de cuenta suspendida
    const url = request.nextUrl.clone()
    url.pathname = '/cuenta-suspendida'
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
