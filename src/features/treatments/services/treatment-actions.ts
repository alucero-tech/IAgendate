'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const categorySchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  description: z.string().optional(),
})

const treatmentSchema = z.object({
  categoryId: z.string().uuid('Categoría requerida'),
  name: z.string().min(2, 'Nombre requerido'),
  description: z.string().optional(),
  aiContext: z.string().optional(),
  durationMinutes: z.coerce.number().min(15, 'Mínimo 15 minutos'),
  price: z.coerce.number().min(1, 'El precio debe ser mayor a 0'),
})

export async function getCategories() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*, treatments (*)')
    .order('display_order')

  if (error) throw new Error(error.message)
  return data
}

export async function getCategoriesSimple() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .eq('active', true)
    .order('display_order')

  if (error) throw new Error(error.message)
  return data
}

export async function getAllTreatments() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('treatments')
    .select('*, categories (name)')
    .eq('active', true)
    .order('name')

  if (error) throw new Error(error.message)
  return data
}

export async function createCategory(formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    description: formData.get('description') as string,
  }

  const parsed = categorySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('categories').insert({
    name: parsed.data.name,
    description: parsed.data.description || null,
  })

  if (error) {
    if (error.message.includes('duplicate')) {
      return { error: 'Ya existe una categoría con ese nombre' }
    }
    return { error: error.message }
  }

  revalidatePath('/bella-donna/tratamientos')
  return { success: true }
}

export async function updateCategory(id: string, formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    description: formData.get('description') as string,
  }

  const parsed = categorySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('categories')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/tratamientos')
  return { success: true }
}

export async function toggleCategoryActive(id: string, active: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('categories')
    .update({ active })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/tratamientos')
  return { success: true }
}

export async function createTreatment(formData: FormData) {
  const raw = {
    categoryId: formData.get('categoryId') as string,
    name: formData.get('name') as string,
    description: formData.get('description') as string,
    aiContext: formData.get('aiContext') as string,
    durationMinutes: formData.get('durationMinutes') as string,
    price: formData.get('price') as string,
  }

  const parsed = treatmentSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('treatments').insert({
    category_id: parsed.data.categoryId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    ai_context: parsed.data.aiContext || null,
    duration_minutes: parsed.data.durationMinutes,
    price: parsed.data.price,
  })

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/tratamientos')
  return { success: true }
}

export async function updateTreatment(id: string, formData: FormData) {
  const raw = {
    categoryId: formData.get('categoryId') as string,
    name: formData.get('name') as string,
    description: formData.get('description') as string,
    aiContext: formData.get('aiContext') as string,
    durationMinutes: formData.get('durationMinutes') as string,
    price: formData.get('price') as string,
  }

  const parsed = treatmentSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('treatments')
    .update({
      category_id: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      ai_context: parsed.data.aiContext || null,
      duration_minutes: parsed.data.durationMinutes,
      price: parsed.data.price,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/tratamientos')
  return { success: true }
}

export async function toggleTreatmentActive(id: string, active: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('treatments')
    .update({ active })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/bella-donna/tratamientos')
  return { success: true }
}
