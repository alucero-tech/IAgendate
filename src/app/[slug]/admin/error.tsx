'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Admin error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-md">
        <AlertTriangle className="h-12 w-12 text-bella-rose-500 mx-auto" />
        <h2 className="text-xl font-semibold">Error en el panel</h2>
        <p className="text-muted-foreground">
          Algo falló al cargar esta sección. Probá recargando.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="default">
            Recargar
          </Button>
          <Button onClick={() => window.location.href = '/bella-donna/dashboard'} variant="outline">
            Ir al dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
