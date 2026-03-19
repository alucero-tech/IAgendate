import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfessional } from '@/features/auth/services/auth-actions'
import { redirect } from 'next/navigation'
import { format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, Clock, AlertTriangle, MessageCircle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const PLAN_LABELS: Record<string, string> = {
  trial: 'Período de prueba',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
}

const PLAN_COLORS: Record<string, string> = {
  trial: 'text-amber-600',
  starter: 'text-bella-violet-600',
  pro: 'text-bella-rose-600',
  business: 'text-bella-gold-600',
}

export default async function SuscripcionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const professional = await getCurrentProfessional()

  if (!professional?.is_owner) {
    redirect(`/${slug}/admin/dashboard`)
  }

  const supabase = createAdminClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, plan, status, plan_expires_at, mp_subscription_id, owner_email')
    .eq('slug', slug)
    .single()

  if (!tenant) redirect(`/${slug}/admin/dashboard`)

  const expiresAt = tenant.plan_expires_at ? new Date(tenant.plan_expires_at) : null
  const daysLeft = expiresAt ? differenceInDays(expiresAt, new Date()) : null
  const isExpired = daysLeft !== null && daysLeft < 0
  const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7

  const waMessage = encodeURIComponent(
    `Hola, quiero gestionar mi suscripción de IAgendate (/${slug}). Email: ${tenant.owner_email}`
  )
  const waLink = `https://wa.me/5491100000000?text=${waMessage}` // TODO: número real

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">Suscripción</h1>
        <p className="text-muted-foreground text-sm mt-1">Estado de tu plan en IAgendate</p>
      </div>

      {/* Status card */}
      <div className="mesh-gradient-card rounded-2xl border border-border/50 p-6 space-y-4">
        {/* Plan header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-bella-rose-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-bella-rose-600" />
            </div>
            <div>
              <p className="font-semibold text-lg">
                Plan{' '}
                <span className={PLAN_COLORS[tenant.plan] || 'text-foreground'}>
                  {PLAN_LABELS[tenant.plan] || tenant.plan}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">/{slug}</p>
            </div>
          </div>

          {isExpired ? (
            <span className="flex items-center gap-1.5 bg-red-100 text-red-700 text-xs font-medium px-3 py-1.5 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" />
              Vencido
            </span>
          ) : isExpiringSoon ? (
            <span className="flex items-center gap-1.5 bg-amber-100 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full">
              <Clock className="w-3.5 h-3.5" />
              Vence pronto
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-medium px-3 py-1.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Activo
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border/50" />

        {/* Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Estado</p>
            <p className="font-medium capitalize">{tenant.status}</p>
          </div>
          {expiresAt && (
            <div>
              <p className="text-muted-foreground mb-1">
                {isExpired ? 'Venció el' : 'Vence el'}
              </p>
              <p className={`font-medium ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : ''}`}>
                {format(expiresAt, "d 'de' MMMM yyyy", { locale: es })}
                {daysLeft !== null && daysLeft >= 0 && (
                  <span className="text-muted-foreground font-normal ml-1">
                    ({daysLeft === 0 ? 'hoy' : `en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`})
                  </span>
                )}
              </p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground mb-1">Email admin</p>
            <p className="font-medium">{tenant.owner_email}</p>
          </div>
          {tenant.mp_subscription_id && (
            <div>
              <p className="text-muted-foreground mb-1">ID Suscripción MP</p>
              <p className="font-mono text-xs">{tenant.mp_subscription_id.substring(0, 12)}...</p>
            </div>
          )}
        </div>
      </div>

      {/* Alert for expiring/expired */}
      {(isExpired || isExpiringSoon) && (
        <div className={`rounded-2xl border p-5 ${isExpired ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${isExpired ? 'text-red-500' : 'text-amber-500'}`} />
            <div>
              <p className={`font-semibold text-sm ${isExpired ? 'text-red-700' : 'text-amber-700'}`}>
                {isExpired
                  ? 'Tu plan ha vencido. Renovalo para seguir usando el sistema.'
                  : `Tu plan vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}. Renovalo antes de que se bloquee el acceso.`}
              </p>
              <div className="flex gap-3 mt-3">
                <a href={waLink} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="bg-bella-rose-600 hover:bg-bella-rose-700">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Renovar ahora
                  </Button>
                </a>
                <Link href="/planes">
                  <Button size="sm" variant="outline">Ver planes</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      {!isExpired && (
        <div className="rounded-2xl border border-border/50 p-5 space-y-3">
          <h3 className="font-semibold text-sm">¿Cómo funciona la renovación?</h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Contactanos por WhatsApp o seleccioná tu plan en la página de planes.</li>
            <li>Procesamos el pago. El sistema se actualiza automáticamente.</li>
            <li>Seguís usando IAgendate sin interrupciones.</li>
          </ol>
          <a href={waLink} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="mt-2">
              <MessageCircle className="w-4 h-4 mr-2" />
              Contactar soporte
            </Button>
          </a>
        </div>
      )}
    </div>
  )
}
