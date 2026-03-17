import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Record<string, unknown>)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Rutas protegidas (dashboard, admin)
  const protectedPaths = ['/bella-donna/dashboard', '/bella-donna/calendario', '/bella-donna/liquidaciones', '/bella-donna/metricas', '/bella-donna/bloqueos', '/bella-donna/configuracion', '/bella-donna/turnos', '/bella-donna/profesionales', '/bella-donna/tratamientos']
  const isProtectedRoute = protectedPaths.some(p => pathname.startsWith(p))

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Si ya está logueado y va a login, redirigir a dashboard
  // Solo si no viene de un redirect (evitar loop)
  const referer = request.headers.get('referer') || ''
  const isRedirectLoop = referer.includes('/bella-donna/dashboard') || referer.includes('/bella-donna/calendario')
  if (pathname === '/login' && user && !isRedirectLoop) {
    const url = request.nextUrl.clone()
    url.pathname = '/bella-donna/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
