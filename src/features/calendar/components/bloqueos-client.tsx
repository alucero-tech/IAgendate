'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  requestTimeBlock,
  approveTimeBlock,
  rejectTimeBlock,
  deleteTimeBlock,
} from '@/features/calendar/services/time-block-actions'
import { Ban, Plus, CheckCircle2, XCircle, Clock, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

interface TimeBlock {
  id: string
  professional_id: string
  block_date: string
  start_time: string
  end_time: string
  reason: string
  status: string
  professionals?: { first_name: string; last_name: string }
}

interface Professional {
  id: string
  first_name: string
  last_name: string
  is_owner: boolean
}

interface Props {
  blocks: TimeBlock[]
  professionals: Professional[]
  isOwner: boolean
  currentProfessionalId: string
}

export function BloqueosClient({ blocks: initialBlocks, professionals, isOwner, currentProfessionalId }: Props) {
  const [blocks, setBlocks] = useState(initialBlocks)
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Form state
  const [blockDate, setBlockDate] = useState('')
  const [blockDateEnd, setBlockDateEnd] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [reason, setReason] = useState('')
  const [selectedProfId, setSelectedProfId] = useState(currentProfessionalId)

  async function handleSubmit() {
    if (!blockDate || !startTime || !endTime || !reason) return

    // Validar fecha desde <= fecha hasta
    if (blockDateEnd && blockDate > blockDateEnd) {
      alert('La fecha "desde" no puede ser posterior a la fecha "hasta"')
      return
    }

    // Validar hora inicio < hora fin
    if (startTime >= endTime) {
      alert('La hora de inicio debe ser anterior a la hora de fin')
      return
    }

    setLoading(true)

    const endDate = blockDateEnd || blockDate
    const dates: string[] = []
    const current = new Date(blockDate + 'T12:00:00')
    const last = new Date(endDate + 'T12:00:00')
    while (current <= last) {
      dates.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }

    let hasError = false
    for (const date of dates) {
      const result = await requestTimeBlock({
        professionalId: isOwner ? selectedProfId : currentProfessionalId,
        blockDate: date,
        startTime,
        endTime,
        reason,
        isOwner,
      })
      if (result.error) {
        alert(result.error)
        hasError = true
        break
      }
    }

    if (!hasError) {
      setDialogOpen(false)
      setBlockDate('')
      setBlockDateEnd('')
      setReason('')
      window.location.reload()
    }
    setLoading(false)
  }

  async function handleApprove(id: string) {
    setLoading(true)
    await approveTimeBlock(id)
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, status: 'approved' } : b))
    setLoading(false)
  }

  async function handleReject(id: string) {
    setLoading(true)
    await rejectTimeBlock(id)
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, status: 'rejected' } : b))
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta licencia?')) return
    setLoading(true)
    await deleteTimeBlock(id)
    setBlocks(prev => prev.filter(b => b.id !== id))
    setLoading(false)
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="h-3 w-3" /> Aprobado
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="h-3 w-3" /> Rechazado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <Clock className="h-3 w-3" /> Pendiente
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Ban className="h-8 w-8 text-bella-rose-500" />
          Licencias
        </h1>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-bella-rose-600 hover:bg-bella-rose-700">
              <Plus className="h-4 w-4 mr-2" /> Solicitar Licencia
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar licencia</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {isOwner && professionals.length > 1 && (
                <div className="space-y-2">
                  <Label>Profesional</Label>
                  <select
                    value={selectedProfId}
                    onChange={e => setSelectedProfId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {professionals.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha desde</Label>
                  <Input
                    type="date"
                    value={blockDate}
                    onChange={e => {
                      setBlockDate(e.target.value)
                      if (blockDateEnd && e.target.value > blockDateEnd) setBlockDateEnd('')
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha hasta</Label>
                  <Input
                    type="date"
                    value={blockDateEnd}
                    onChange={e => setBlockDateEnd(e.target.value)}
                    min={blockDate}
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hora inicio</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hora fin</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Input
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Ej: Turno médico, Día personal..."
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={loading || !blockDate || !reason}
                className="w-full bg-bella-rose-600 hover:bg-bella-rose-700"
              >
                {isOwner ? 'Crear licencia (aprobada)' : 'Solicitar licencia'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {blocks.length === 0 ? (
        <div className="text-center py-16">
          <Ban className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No hay licencias registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map(block => {
            const prof = block.professionals as { first_name: string; last_name: string } | undefined
            return (
              <div key={block.id} className="mesh-gradient-card rounded-2xl border border-border/50 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    {isOwner && prof && (
                      <p className="font-semibold">{prof.first_name} {prof.last_name}</p>
                    )}
                    <p className="text-sm">
                      {format(parseISO(block.block_date), "EEEE d 'de' MMMM yyyy", { locale: es })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {block.start_time.substring(0, 5)} - {block.end_time.substring(0, 5)}
                    </p>
                    <p className="text-sm mt-1">{block.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(block.status)}
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-3">
                  {isOwner && block.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(block.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => handleReject(block.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Rechazar
                      </Button>
                    </>
                  )}
                  {(isOwner || block.professional_id === currentProfessionalId) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={loading}
                      onClick={() => handleDelete(block.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
