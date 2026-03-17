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
import { ProfessionalForm } from '@/features/professionals/components/professional-form'
import { toggleProfessionalActive, updateProfessionalRole } from '@/features/professionals/services/professional-actions'
import { UserPlus, Users, Percent, Mail, Phone, Crown, Shield } from 'lucide-react'

interface Professional {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  commission_percentage: number
  is_owner: boolean
  role?: string
  active: boolean
}

export function ProfessionalsClient({ professionals }: { professionals: Professional[] }) {
  const [open, setOpen] = useState(false)
  const [editProfessional, setEditProfessional] = useState<Professional | null>(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-8 w-8 text-bella-rose-500" />
            Profesionales
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestioná el equipo de tu negocio
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-bella-rose-600 hover:bg-bella-rose-700">
              <UserPlus className="h-4 w-4 mr-2" />
              Agregar profesional
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva profesional</DialogTitle>
            </DialogHeader>
            <ProfessionalForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {professionals.map(prof => (
          <div
            key={prof.id}
            className="mesh-gradient-card rounded-2xl border border-border/50 p-6 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  {prof.first_name} {prof.last_name}
                  {prof.is_owner && <Crown className="h-4 w-4 text-bella-gold-500" />}
                  {prof.role === 'manager' && <Shield className="h-4 w-4 text-bella-violet-500" />}
                </h3>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <Mail className="h-3 w-3" />
                  {prof.email}
                </div>
                {prof.phone && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {prof.phone}
                  </div>
                )}
              </div>
              <Badge variant={prof.active ? 'default' : 'secondary'}>
                {prof.active ? 'Activa' : 'Inactiva'}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Percent className="h-4 w-4 text-bella-violet-500" />
              <span>Comisión: {prof.commission_percentage}%</span>
            </div>

            <div className="flex gap-2">
              {!prof.is_owner && (
                <>
                  <Dialog
                    open={editProfessional?.id === prof.id}
                    onOpenChange={(open) => !open && setEditProfessional(null)}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditProfessional(prof)}
                    >
                      Editar
                    </Button>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar profesional</DialogTitle>
                      </DialogHeader>
                      {editProfessional && (
                        <ProfessionalForm
                          professional={editProfessional}
                          onSuccess={() => setEditProfessional(null)}
                        />
                      )}
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleProfessionalActive(prof.id, !prof.active)}
                  >
                    {prof.active ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateProfessionalRole(
                      prof.id,
                      prof.role === 'manager' ? 'professional' : 'manager'
                    )}
                    title={prof.role === 'manager' ? 'Quitar rol de encargada' : 'Asignar como encargada'}
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    {prof.role === 'manager' ? 'Quitar encargada' : 'Hacer encargada'}
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {professionals.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p>No hay profesionales registradas</p>
          <p className="text-sm">Agregá la primera profesional para empezar</p>
        </div>
      )}
    </div>
  )
}
