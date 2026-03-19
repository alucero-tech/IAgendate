import { getAllTenants } from '@/features/admin/services/superadmin-actions'
import { TenantActions } from '@/features/admin/components/tenant-actions'
import { format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, Clock, AlertTriangle, XCircle, Users } from 'lucide-react'

const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
}

const STATUS_BADGE: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  active: { label: 'Activo', className: 'bg-green-900/50 text-green-400 border border-green-800', icon: CheckCircle2 },
  suspended: { label: 'Suspendido', className: 'bg-red-900/50 text-red-400 border border-red-800', icon: XCircle },
  cancelled: { label: 'Cancelado', className: 'bg-gray-800 text-gray-400 border border-gray-700', icon: XCircle },
}

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return <span className="text-gray-500 text-xs">—</span>

  const date = new Date(expiresAt)
  const days = differenceInDays(date, new Date())
  const formatted = format(date, "d MMM yyyy", { locale: es })

  if (days < 0) {
    return (
      <span className="flex items-center gap-1 text-red-400 text-xs">
        <AlertTriangle className="w-3 h-3" />
        Vencido ({formatted})
      </span>
    )
  }
  if (days <= 7) {
    return (
      <span className="flex items-center gap-1 text-amber-400 text-xs">
        <Clock className="w-3 h-3" />
        {days}d ({formatted})
      </span>
    )
  }
  return <span className="text-gray-400 text-xs">{formatted}</span>
}

export default async function SuperadminPage() {
  const tenants = await getAllTenants()

  const stats = {
    total: tenants.length,
    active: tenants.filter(t => t.status === 'active').length,
    trial: tenants.filter(t => t.plan === 'trial').length,
    expiringSoon: tenants.filter(t => {
      if (!t.plan_expires_at) return false
      const days = differenceInDays(new Date(t.plan_expires_at), new Date())
      return days >= 0 && days <= 7
    }).length,
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Torre de Control</h2>
        <p className="text-gray-400 text-sm mt-1">Gestión global de todos los tenants</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total tenants', value: stats.total, color: 'text-white' },
          { label: 'Activos', value: stats.active, color: 'text-green-400' },
          { label: 'En trial', value: stats.trial, color: 'text-amber-400' },
          { label: 'Vencen pronto', value: stats.expiringSoon, color: 'text-red-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tenant table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold text-sm text-gray-200">Tenants ({tenants.length})</h3>
        </div>

        {tenants.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">
            No hay tenants registrados aún.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Negocio</th>
                  <th className="text-left px-4 py-3">Plan</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-left px-4 py-3">Vencimiento</th>
                  <th className="text-left px-4 py-3">Registrado</th>
                  <th className="text-left px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {tenants.map((tenant) => {
                  const badge = STATUS_BADGE[tenant.status] ?? STATUS_BADGE.suspended
                  const StatusIcon = badge.icon

                  return (
                    <tr key={tenant.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-200">{tenant.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs text-gray-500">/{tenant.slug}</span>
                          {tenant.mp_subscription_id && (
                            <span className="text-xs text-bella-violet-400 bg-bella-violet-900/20 px-1.5 py-0.5 rounded">
                              MP
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">{tenant.owner_email}</p>
                      </td>

                      <td className="px-4 py-4">
                        <span className="text-xs font-medium text-gray-300">
                          {PLAN_LABELS[tenant.plan] ?? tenant.plan}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.className}`}>
                          <StatusIcon className="w-3 h-3" />
                          {badge.label}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <ExpiryBadge expiresAt={tenant.plan_expires_at} />
                      </td>

                      <td className="px-4 py-4 text-xs text-gray-500">
                        {tenant.created_at
                          ? format(new Date(tenant.created_at), "d MMM yyyy", { locale: es })
                          : '—'}
                      </td>

                      <td className="px-4 py-4">
                        <TenantActions tenantId={tenant.id} status={tenant.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
