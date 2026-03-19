import { getTenantBranding } from '@/features/settings/services/settings-actions'

/**
 * Layout raíz para todas las rutas de tenant: /[slug]/*
 * Inyecta las variables CSS de branding dinámico.
 *
 * Rutas cubiertas (según Matriz de Branding):
 *   - /[slug]/reservar       → Tenant ✓
 *   - /[slug]/admin/*        → Tenant ✓
 *   - /[slug]/mi-turno       → Tenant ✓
 *   - /[slug]/reagendar      → Tenant ✓
 *
 * Las rutas de plataforma (/, /login, /registro, /superadmin)
 * NO pasan por este layout y mantienen el branding de IAgendate.
 */
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const branding = await getTenantBranding(slug)

  return (
    <div
      style={{
        '--brand-primary': branding.primaryColor,
        '--brand-accent': branding.accentColor,
      } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
