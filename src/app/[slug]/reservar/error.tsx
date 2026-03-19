'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function ReservarError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Reservar error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <AlertTriangle className="h-12 w-12 text-bella-rose-500 mx-auto" />
        <h2 className="text-xl font-semibold">Error al cargar la reserva</h2>
        <p className="text-muted-foreground">
          No pudimos cargar el formulario de reserva. Intentá de nuevo.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="default">
            Intentar de nuevo
          </Button>
          <Button onClick={() => window.location.href = '/'} variant="outline">
            Volver al inicio
          </Button>
        </div>
      </div>
    </div>
  )
}
