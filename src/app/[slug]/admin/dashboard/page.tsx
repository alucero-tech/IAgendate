import { getCurrentProfessional } from '@/features/auth/services/auth-actions'
import { getDashboardStats, getOnboardingStatus } from '@/features/dashboard/services/dashboard-actions'
import { OnboardingChecklist } from '@/features/dashboard/components/onboarding-checklist'
import { Calendar, Clock, Users, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { DailySummary } from '@/features/ai-assistant/components/daily-summary'

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const professional = await getCurrentProfessional()
  if (!professional) return null

  const [stats, onboarding] = await Promise.all([
    getDashboardStats(professional.id, professional.is_owner),
    professional.is_owner ? getOnboardingStatus(professional.tenant_id) : null,
  ])

  const today = format(new Date(), 'yyyy-MM-dd')
  const nextTurnValue = stats.nextTurn
    ? stats.nextTurn.time + 'hs'
    : 'Sin turnos'
  const nextTurnSubtitle = stats.nextTurn
    ? stats.nextTurn.date === today
      ? stats.nextTurn.client
      : `${format(new Date(stats.nextTurn.date + 'T12:00:00'), 'EEE d MMM', { locale: es })} · ${stats.nextTurn.client}`
    : 'Todo libre'

  const revenueFormatted = stats.weeklyRevenue > 0
    ? `$${stats.weeklyRevenue.toLocaleString('es-AR')}`
    : '$0'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Hola, {professional.first_name}
        </h1>
        <p className="text-muted-foreground mt-1">
          {professional.is_owner
            ? 'Acá podés ver el resumen de tu negocio'
            : 'Acá podés ver tu agenda del día'}
        </p>
      </div>

      {/* Onboarding checklist — only for owner, only while setup is incomplete */}
      {professional.is_owner && onboarding && (
        <OnboardingChecklist
          slug={slug}
          hasTreatments={onboarding.hasTreatments}
          hasSchedules={onboarding.hasSchedules}
        />
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Turnos Hoy"
          value={String(stats.todayCount)}
          icon={<Calendar className="h-5 w-5 text-bella-rose-500" />}
          subtitle={stats.todayCount === 1 ? '1 turno' : `${stats.todayCount} turnos`}
        />
        <StatCard
          title="Próximo Turno"
          value={nextTurnValue}
          icon={<Clock className="h-5 w-5 text-bella-violet-500" />}
          subtitle={nextTurnSubtitle}
        />
        {professional.is_owner && (
          <>
            <StatCard
              title="Profesionales"
              value={String(stats.professionalCount)}
              icon={<Users className="h-5 w-5 text-bella-gold-500" />}
              subtitle="Activas"
            />
            <StatCard
              title="Recaudación"
              value={revenueFormatted}
              icon={<DollarSign className="h-5 w-5 text-green-500" />}
              subtitle="Esta semana"
            />
          </>
        )}
      </div>

      {/* AI Daily Summary - only for owner */}
      {professional.is_owner && <DailySummary />}
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  subtitle,
}: {
  title: string
  value: string
  icon: React.ReactNode
  subtitle: string
}) {
  return (
    <div className="mesh-gradient-card rounded-2xl border border-border/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        {icon}
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  )
}
