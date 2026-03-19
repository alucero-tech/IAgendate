import Link from 'next/link'
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react'
import { differenceInDays } from 'date-fns'

interface PlanExpiryBannerProps {
  planExpiresAt: string | null
  slug: string
}

export function PlanExpiryBanner({ planExpiresAt, slug }: PlanExpiryBannerProps) {
  if (!planExpiresAt) return null

  const expiresAt = new Date(planExpiresAt)
  const daysLeft = differenceInDays(expiresAt, new Date())

  // Solo mostrar entre 0 y 7 días (el middleware bloquea si ya expiró)
  if (daysLeft > 7 || daysLeft < 0) return null

  const isLastDay = daysLeft === 0
  const urgency = daysLeft <= 2 ? 'high' : 'medium'

  return (
    <div className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-sm ${
      urgency === 'high'
        ? 'bg-red-950/60 border-b border-red-800/50 text-red-200'
        : 'bg-amber-950/60 border-b border-amber-800/40 text-amber-200'
    }`}>
      <div className="flex items-center gap-2 min-w-0">
        {urgency === 'high'
          ? <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          : <Clock className="w-4 h-4 shrink-0 text-amber-400" />
        }
        <span className="truncate">
          {isLastDay
            ? 'Tu plan vence hoy. Renovalo para no perder el acceso.'
            : `Tu plan vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}. Renovalo para no interrumpir el servicio.`
          }
        </span>
      </div>
      <Link
        href={`/${slug}/admin/suscripcion`}
        className={`shrink-0 flex items-center gap-1 font-medium text-xs underline-offset-2 hover:underline ${
          urgency === 'high' ? 'text-red-300' : 'text-amber-300'
        }`}
      >
        Ver suscripción
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
