'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createProfessional, updateProfessional } from '../services/professional-actions'
import { UserPlus, Save } from 'lucide-react'

interface ProfessionalFormProps {
  professional?: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
    commission_percentage: number
  }
  onSuccess?: () => void
}

export function ProfessionalForm({ professional, onSuccess }: ProfessionalFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isEdit = !!professional

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    setTempPassword(null)

    const result = isEdit
      ? await updateProfessional(professional.id, formData)
      : await createProfessional(formData)

    if ('error' in result && result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if ('tempPassword' in result) {
      const pwd = (result as { tempPassword?: string }).tempPassword
      if (pwd) setTempPassword(pwd)
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

      {tempPassword && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          <p className="font-semibold">Profesional creada exitosamente</p>
          <p className="mt-1">Contraseña temporal: <code className="bg-green-100 px-2 py-0.5 rounded">{tempPassword}</code></p>
          <p className="text-xs mt-1">Compartí esta contraseña con la profesional para que pueda ingresar.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Nombre</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={professional?.first_name}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Apellido</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={professional?.last_name}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={professional?.email}
          required
          disabled={isEdit}
        />
        {!isEdit && (
          <p className="text-xs text-muted-foreground">
            Se creará una cuenta con este email. La profesional recibirá una contraseña temporal.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Teléfono</Label>
        <Input
          id="phone"
          name="phone"
          defaultValue={professional?.phone || ''}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="commissionPercentage">Comisión (%)</Label>
        <Input
          id="commissionPercentage"
          name="commissionPercentage"
          type="number"
          min={0}
          max={100}
          step={0.5}
          defaultValue={professional?.commission_percentage ?? 70}
          required
        />
        <p className="text-xs text-muted-foreground">
          Porcentaje que se lleva la profesional. Ej: 70 = la profesional se lleva el 70%.
        </p>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-bella-rose-600 hover:bg-bella-rose-700"
      >
        {loading ? (
          'Guardando...'
        ) : isEdit ? (
          <span className="flex items-center gap-2"><Save className="h-4 w-4" /> Guardar cambios</span>
        ) : (
          <span className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Agregar profesional</span>
        )}
      </Button>
    </form>
  )
}
