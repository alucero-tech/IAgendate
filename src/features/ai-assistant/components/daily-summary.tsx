'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateDailySummary } from '@/features/ai-assistant/services/ai-actions'

export function DailySummary() {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    try {
      const result = await generateDailySummary()
      setSummary(result.summary)
    } catch {
      setSummary('No se pudo generar el resumen. Verificá la configuración de IA.')
    }
    setLoading(false)
  }

  return (
    <div className="mesh-gradient-card rounded-2xl border border-border/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-bella-violet-500" />
          Resumen del día
        </h2>
        <Button
          onClick={handleGenerate}
          disabled={loading}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" />
              {summary ? 'Regenerar' : 'Generar resumen'}
            </>
          )}
        </Button>
      </div>

      {summary && (
        <div className="bg-gradient-to-br from-bella-rose-50/50 to-bella-violet-50/50 rounded-xl p-4">
          <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
            {summary}
          </p>
        </div>
      )}

      {!summary && !loading && (
        <p className="text-sm text-muted-foreground">
          Hacé click en &quot;Generar resumen&quot; para obtener un análisis de tu día con IA.
        </p>
      )}
    </div>
  )
}
