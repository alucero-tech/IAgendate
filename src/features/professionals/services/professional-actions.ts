'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  updateProfessionalRoleSchema,
  toggleActiveSchema,
  toggleScheduleDaySchema,
  assignTreatmentsSchema,
} from '@/shared/schemas/zod-schemas'

const professionalSchema = z.object({
  firstName: z.string().min(2, 'Nombre requerido'),
  lastName: z.string().min(2, 'Apellido requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().regex(/^\d{10}$/, 'El celular debe tener 10 dígitos').optional().or(z.literal('')),
  commissionPercentage: z.coerce.number().min(0).max(100),
})

export async function getProfessionals() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('professionals')
    .select('*')
    .order('first_name')

  if (error) throw new Error(error.message)
  return data
}

export async function getProfessionalById(id: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('professionals')
    .select(`
      *,
      schedules (*),
      professional_treatments (
        id,
        treatment_id,
        treatments (id, name, category_id, categories (name))
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function createProfessional(formData: FormData) {
  const raw = {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string,
    commissionPercentage: formData.get('commissionPercentage') as string,
  }

  const parsed = professionalSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = createAdminClient()

  // 1. Crear usuario en Supabase Auth (contraseña temporal)
  const tempPassword = `Bella${Date.now().toString(36)}!`
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: tempPassword,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message.includes('already')) {
      return { error: 'Ya existe un usuario con ese email' }
    }
    return { error: authError.message }
  }

  // 2. Crear registro en professionals
  const { error: profError } = await supabase.from('professionals').insert({
    user_id: authData.user.id,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    commission_percentage: parsed.data.commissionPercentage,
    is_owner: false,
  })

  if (profError) {
    return { error: profError.message }
  }

  revalidatePath('/bella-donna/profesionales')
  return { success: true, tempPassword }
}

export async function updateProfessional(id: string, formData: FormData) {
  const raw = {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string,
    commissionPercentage: formData.get('commissionPercentage') as string,
  }

  const parsed = professionalSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('professionals')
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      commission_percentage: parsed.data.commissionPercentage,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/profesionales')
  return { success: true }
}

export async function updateProfessionalRole(id: string, role: 'professional' | 'manager') {
  const parsed = updateProfessionalRoleSchema.safeParse({ id, role })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = createAdminClient()

  // Cannot change owner role
  const { data: prof } = await supabase
    .from('professionals')
    .select('is_owner')
    .eq('id', id)
    .single()

  if (prof?.is_owner) return { error: 'No se puede cambiar el rol de la dueña' }

  const { error } = await supabase
    .from('professionals')
    .update({ role })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/profesionales')
  revalidatePath('/')
  return { success: true }
}

export async function toggleProfessionalActive(id: string, active: boolean) {
  const parsed = toggleActiveSchema.safeParse({ id, active })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('professionals')
    .update({ active })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/profesionales')
  return { success: true }
}

const scheduleSchema = z.object({
  dayOfWeek: z.coerce.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
})

export async function upsertSchedule(professionalId: string, formData: FormData) {
  const raw = {
    dayOfWeek: formData.get('dayOfWeek') as string,
    startTime: formData.get('startTime') as string,
    endTime: formData.get('endTime') as string,
  }

  const parsed = scheduleSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('schedules')
    .upsert(
      {
        professional_id: professionalId,
        day_of_week: parsed.data.dayOfWeek,
        start_time: parsed.data.startTime,
        end_time: parsed.data.endTime,
        is_active: true,
      },
      { onConflict: 'professional_id,day_of_week' }
    )

  if (error) return { error: error.message }

  revalidatePath(`/bella-donna/profesionales/${professionalId}`)
  return { success: true }
}

export async function toggleScheduleDay(professionalId: string, dayOfWeek: number, isActive: boolean) {
  const parsed = toggleScheduleDaySchema.safeParse({ professionalId, dayOfWeek, isActive })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('schedules')
    .update({ is_active: isActive })
    .eq('professional_id', professionalId)
    .eq('day_of_week', dayOfWeek)

  if (error) return { error: error.message }

  revalidatePath(`/bella-donna/profesionales/${professionalId}`)
  return { success: true }
}

export async function assignTreatments(professionalId: string, treatmentIds: string[]) {
  const parsed = assignTreatmentsSchema.safeParse({ professionalId, treatmentIds })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()

  // Borrar asignaciones actuales
  await supabase
    .from('professional_treatments')
    .delete()
    .eq('professional_id', professionalId)

  // Insertar nuevas
  if (treatmentIds.length > 0) {
    const rows = treatmentIds.map(treatmentId => ({
      professional_id: professionalId,
      treatment_id: treatmentId,
    }))

    const { error } = await supabase
      .from('professional_treatments')
      .insert(rows)

    if (error) return { error: error.message }
  }

  revalidatePath(`/bella-donna/profesionales/${professionalId}`)
  return { success: true }
}
