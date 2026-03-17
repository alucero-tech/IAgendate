'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createTreatment, updateTreatment } from '../services/treatment-actions'
import { Plus, Save } from 'lucide-react'

interface TreatmentFormProps {
  categories: { id: string; name: string }[]
  treatment?: {
    id: string
    category_id: string
    name: string
    description: string | null
    duration_minutes: number
    price: number
    ai_context: string | null
  }
  onSuccess?: () => void
}

export function TreatmentForm({ categories, treatment, onSuccess }: TreatmentFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [categoryId, setCategoryId] = useState(treatment?.category_id || '')
  const isEdit = !!treatment

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    formData.set('categoryId', categoryId)

    const result = isEdit
      ? await updateTreatment(treatment.id, formData)
      : await createTreatment(formData)

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
        <Label>Categoría</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccioná una categoría" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Nombre del tratamiento</Label>
        <Input
          id="name"
          name="name"
          defaultValue={treatment?.name}
          placeholder="Ej: Balayage completo"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción (opcional)</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={treatment?.description || ''}
          placeholder="Descripción del tratamiento..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="aiContext">
          Contexto para la IA
          <span className="text-xs text-muted-foreground ml-1">(lo que el chatbot le dice a tus clientes)</span>
        </Label>
        <Textarea
          id="aiContext"
          name="aiContext"
          defaultValue={treatment?.ai_context || ''}
          placeholder={"Describí el servicio como se lo explicarías a un cliente por WhatsApp:\n• ¿Qué incluye?\n• ¿Para quién es ideal?\n• ¿Cuánto dura el resultado?\n• ¿Preparación previa o cuidados después?"}
          rows={5}
        />
        <p className="text-xs text-muted-foreground">
          Si este campo está vacío, el chatbot solo podrá decir el nombre y la duración del servicio. No va a inventar información.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="durationMinutes">Duración (minutos)</Label>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={15}
            step={15}
            defaultValue={treatment?.duration_minutes ?? 60}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Precio ($)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min={1}
            step={100}
            defaultValue={treatment?.price}
            placeholder="25000"
            required
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading || !categoryId}
        className="w-full bg-bella-rose-600 hover:bg-bella-rose-700"
      >
        {loading ? 'Guardando...' : isEdit ? (
          <span className="flex items-center gap-2"><Save className="h-4 w-4" /> Guardar cambios</span>
        ) : (
          <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Agregar tratamiento</span>
        )}
      </Button>
    </form>
  )
}
