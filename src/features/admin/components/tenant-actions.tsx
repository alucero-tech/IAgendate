'use client'

import { useState, useTransition } from 'react'
import { extendTenantPlan, suspendTenant, activateTenant } from '@/features/admin/services/superadmin-actions'
import { Button } from '@/components/ui/button'
import { Loader2, PauseCircle, PlayCircle, CalendarPlus } from 'lucide-react'

interface TenantActionsProps {
  tenantId: string
  status: string
}

export function TenantActions({ tenantId, status }: TenantActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState('')

  function handleAction(fn: () => Promise<{ success?: boolean; error?: string }>) {
    setFeedback('')
    startTransition(async () => {
      const result = await fn()
      setFeedback(result.error ? `Error: ${result.error}` : '✓')
      if (!result.error) setTimeout(() => setFeedback(''), 2000)
    })
  }

  return (
    <div className="flex items-center gap-2">
      {/* Extend +30 days */}
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs border-gray-700 text-gray-300 hover:bg-gray-700"
        disabled={isPending}
        onClick={() => handleAction(() => extendTenantPlan(tenantId, 30))}
      >
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CalendarPlus className="w-3 h-3" />}
        <span className="ml-1">+30d</span>
      </Button>

      {/* Suspend / Activate */}
      {status === 'active' ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-red-800 text-red-400 hover:bg-red-950"
          disabled={isPending}
          onClick={() => handleAction(() => suspendTenant(tenantId))}
        >
          <PauseCircle className="w-3 h-3 mr-1" />
          Suspender
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-green-800 text-green-400 hover:bg-green-950"
          disabled={isPending}
          onClick={() => handleAction(() => activateTenant(tenantId))}
        >
          <PlayCircle className="w-3 h-3 mr-1" />
          Activar
        </Button>
      )}

      {feedback && (
        <span className={`text-xs ${feedback.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
          {feedback}
        </span>
      )}
    </div>
  )
}
