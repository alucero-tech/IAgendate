'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createCategory } from '../services/treatment-actions'
import { FolderPlus } from 'lucide-react'

interface CategoryFormProps {
  onSuccess?: () => void
}

export function CategoryForm({ onSuccess }: CategoryFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const result = await createCategory(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess?.()
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Nombre de la especialidad</Label>
        <Input
          id="name"
          name="name"
          placeholder="Ej: Colorimetría, Corte, Uñas..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción (opcional)</Label>
        <Input
          id="description"
          name="description"
          placeholder="Breve descripción..."
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-bella-violet-600 hover:bg-bella-violet-700"
      >
        {loading ? 'Creando...' : (
          <span className="flex items-center gap-2"><FolderPlus className="h-4 w-4" /> Crear especialidad</span>
        )}
      </Button>
    </form>
  )
}
