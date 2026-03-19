import { Loader2 } from 'lucide-react'

export default function MiTurnoLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-bella-rose-500 mx-auto" />
        <p className="text-sm text-muted-foreground">Cargando tu turno...</p>
      </div>
    </div>
  )
}
