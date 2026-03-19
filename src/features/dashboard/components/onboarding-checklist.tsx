import Link from 'next/link'
import { CheckCircle2, Circle, Scissors, Clock, Share2, UserCheck } from 'lucide-react'

interface Step {
  icon: React.ReactNode
  title: string
  description: React.ReactNode
  done: boolean
  href?: string
  cta?: string
}

interface OnboardingChecklistProps {
  slug: string
  hasTreatments: boolean
  hasSchedules: boolean
}

export function OnboardingChecklist({ slug, hasTreatments, hasSchedules }: OnboardingChecklistProps) {
  const allDone = hasTreatments && hasSchedules
  if (allDone) return null

  const steps: Step[] = [
    {
      icon: <UserCheck className="w-5 h-5" />,
      title: 'Cuenta creada',
      description: 'Tu sistema está listo.',
      done: true,
    },
    {
      icon: <Scissors className="w-5 h-5" />,
      title: 'Agregar servicios',
      description: 'Cargá los tratamientos que ofrecés para que las clientas puedan reservar.',
      done: hasTreatments,
      href: `/${slug}/admin/tratamientos`,
      cta: 'Ir a tratamientos →',
    },
    {
      icon: <Clock className="w-5 h-5" />,
      title: 'Configurar horarios',
      description: 'Definí los días y horarios de atención de cada profesional.',
      done: hasSchedules,
      href: `/${slug}/admin/configuracion`,
      cta: 'Ir a configuración →',
    },
    {
      icon: <Share2 className="w-5 h-5" />,
      title: 'Compartir tu link',
      description: (
        <>
          Enviá{' '}
          <span className="font-mono text-xs text-bella-rose-400 bg-muted px-1 py-0.5 rounded">
            iagendate.com/{slug}/reservar
          </span>{' '}
          a tus clientas.
        </>
      ),
      done: false,
      href: `/${slug}/reservar`,
      cta: 'Ver mi página →',
    },
  ]

  const completedCount = steps.filter(s => s.done).length

  return (
    <div className="mesh-gradient-card rounded-2xl border border-border/50 p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Primeros pasos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {completedCount} de {steps.length} completados
          </p>
        </div>
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                s.done ? 'bg-bella-rose-500' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
              step.done
                ? 'border-border/30 bg-muted/20 opacity-60'
                : 'border-bella-rose-500/20 bg-bella-rose-500/5'
            }`}
          >
            <div className={`mt-0.5 shrink-0 ${step.done ? 'text-bella-rose-500' : 'text-muted-foreground'}`}>
              {step.done ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-muted-foreground ${step.done ? 'opacity-50' : ''}`}>
                  {step.icon}
                </span>
                <p className={`text-sm font-medium ${step.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {step.title}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">{step.description}</p>
              {!step.done && step.href && (
                <Link
                  href={step.href}
                  className="inline-block mt-2 text-xs font-medium text-bella-rose-500 hover:text-bella-rose-400 transition-colors"
                >
                  {step.cta}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
