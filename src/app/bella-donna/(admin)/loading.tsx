import { Loader2 } from 'lucide-react'

export default function AdminLoading() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-bella-rose-500 mx-auto" />
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    </div>
  )
}
