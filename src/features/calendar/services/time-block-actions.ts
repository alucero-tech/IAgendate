'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { uuidSchema } from '@/shared/schemas/zod-schemas'

const timeBlockSchema = z.object({
  professionalId: z.string().uuid(),
  blockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().min(1, 'Motivo requerido'),
})

export async function getTimeBlockRequests(status?: string) {
  const supabase = createAdminClient()

  let query = supabase
    .from('time_blocks')
    .select('*, professionals (first_name, last_name)')
    .order('block_date', { ascending: false })
    .limit(50)

  if (status) {
    query = query.eq('status', status)
  }

  const { data } = await query
  return data || []
}

export async function getMyTimeBlocks(professionalId: string) {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('professional_id', professionalId)
    .order('block_date', { ascending: false })
    .limit(30)

  return data || []
}

export async function requestTimeBlock(input: {
  professionalId: string
  blockDate: string
  startTime: string
  endTime: string
  reason: string
  isOwner?: boolean
}) {
  const parsed = timeBlockSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Validar hora inicio < hora fin
  if (parsed.data.startTime >= parsed.data.endTime) {
    return { error: 'La hora de inicio debe ser anterior a la hora de fin' }
  }

  const supabase = createAdminClient()

  const { error } = await supabase.from('time_blocks').insert({
    professional_id: parsed.data.professionalId,
    block_date: parsed.data.blockDate,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    reason: parsed.data.reason,
    status: input.isOwner ? 'approved' : 'pending',
  })

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/bloqueos')
  return { success: true }
}

export async function approveTimeBlock(blockId: string) {
  const v = uuidSchema.safeParse(blockId)
  if (!v.success) return { error: v.error.issues[0].message }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('time_blocks')
    .update({ status: 'approved' })
    .eq('id', blockId)

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/bloqueos')
  revalidatePath('/bella-donna/calendario')
  return { success: true }
}

export async function rejectTimeBlock(blockId: string) {
  const v = uuidSchema.safeParse(blockId)
  if (!v.success) return { error: v.error.issues[0].message }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('time_blocks')
    .update({ status: 'rejected' })
    .eq('id', blockId)

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/bloqueos')
  return { success: true }
}

export async function deleteTimeBlock(blockId: string) {
  const v = uuidSchema.safeParse(blockId)
  if (!v.success) return { error: v.error.issues[0].message }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('time_blocks')
    .delete()
    .eq('id', blockId)

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/bloqueos')
  revalidatePath('/bella-donna/calendario')
  return { success: true }
}
