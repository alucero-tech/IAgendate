'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { TreatmentForm } from '@/features/treatments/components/treatment-form'
import { CategoryForm } from '@/features/treatments/components/category-form'
import { toggleTreatmentActive } from '@/features/treatments/services/treatment-actions'
import { Scissors, Plus, FolderPlus, Clock, DollarSign, Pencil, Bot } from 'lucide-react'

interface Treatment {
  id: string
  category_id: string
  name: string
  description: string | null
  ai_context: string | null
  duration_minutes: number
  price: number
  active: boolean
}

interface Category {
  id: string
  name: string
  description: string | null
  active: boolean
  treatments: Treatment[]
}

interface Props {
  categories: Category[]
  categoriesSimple: { id: string; name: string }[]
}

export function TreatmentsClient({ categories, categoriesSimple }: Props) {
  const [catOpen, setCatOpen] = useState(false)
  const [treatOpen, setTreatOpen] = useState(false)
  const [editTreatment, setEditTreatment] = useState<Treatment | null>(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Scissors className="h-8 w-8 text-bella-rose-500" />
            Tratamientos
          </h1>
          <p className="text-muted-foreground mt-1">
            Especialidades y servicios de tu negocio
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FolderPlus className="h-4 w-4 mr-2" />
                Nueva especialidad
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva especialidad</DialogTitle>
              </DialogHeader>
              <CategoryForm onSuccess={() => setCatOpen(false)} />
            </DialogContent>
          </Dialog>

          <Dialog open={treatOpen} onOpenChange={setTreatOpen}>
            <DialogTrigger asChild>
              <Button className="bg-bella-rose-600 hover:bg-bella-rose-700">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo tratamiento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo tratamiento</DialogTitle>
              </DialogHeader>
              <TreatmentForm
                categories={categoriesSimple}
                onSuccess={() => setTreatOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Categories with treatments */}
      {categories.map(cat => (
        <div key={cat.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">{cat.name}</h2>
            {cat.description && (
              <span className="text-sm text-muted-foreground">— {cat.description}</span>
            )}
            <Badge variant={cat.active ? 'default' : 'secondary'} className="ml-2">
              {cat.treatments.length} tratamientos
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cat.treatments.map(treat => (
              <div
                key={treat.id}
                className={`rounded-xl border p-4 space-y-2 ${
                  treat.active
                    ? 'border-border/50 bg-white/50'
                    : 'border-border/30 bg-muted/30 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-medium">{treat.name}</h3>
                  <Badge variant={treat.active ? 'outline' : 'secondary'} className="text-xs">
                    {treat.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                {treat.description && (
                  <p className="text-sm text-muted-foreground">{treat.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {treat.duration_minutes} min
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-bella-rose-600">
                    <DollarSign className="h-3.5 w-3.5" />
                    {treat.price.toLocaleString('es-AR')}
                  </span>
                </div>
                {!treat.ai_context && (
                  <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 rounded-md px-2 py-1">
                    <Bot className="h-3 w-3" />
                    Sin contexto IA — el chatbot no podrá describir este tratamiento
                  </div>
                )}
                {treat.ai_context && (
                  <div className="flex items-center gap-1 text-xs text-emerald-600">
                    <Bot className="h-3 w-3" />
                    Contexto IA cargado
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setEditTreatment(treat)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => toggleTreatmentActive(treat.id, !treat.active)}
                  >
                    {treat.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {cat.treatments.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-xl">
              No hay tratamientos en esta especialidad
            </p>
          )}
        </div>
      ))}

      {categories.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Scissors className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p>No hay especialidades creadas</p>
          <p className="text-sm">Creá la primera especialidad para empezar a agregar tratamientos</p>
        </div>
      )}

      {/* Edit treatment dialog */}
      <Dialog open={!!editTreatment} onOpenChange={(open) => { if (!open) setEditTreatment(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar tratamiento</DialogTitle>
          </DialogHeader>
          {editTreatment && (
            <TreatmentForm
              categories={categoriesSimple}
              treatment={editTreatment}
              onSuccess={() => setEditTreatment(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
