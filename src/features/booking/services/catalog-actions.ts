'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// ========== QUERIES PÚBLICAS (sin auth, requieren tenantId) ==========

export async function getPublicCategories(tenantId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, description')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('display_order')

  return data || []
}

export async function getAllTreatmentsGrouped(tenantId: string) {
  const supabase = createAdminClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, description')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('display_order')

  if (!categories) return []

  const { data: treatments } = await supabase
    .from('treatments')
    .select('id, name, description, duration_minutes, price, category_id')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name')

  return (categories || []).map(cat => ({
    ...cat,
    treatments: (treatments || []).filter(t => t.category_id === cat.id),
  }))
}

export async function getTreatmentsByCategory(categoryId: string, tenantId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('treatments')
    .select('id, name, description, duration_minutes, price, category_id')
    .eq('category_id', categoryId)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name')

  return data || []
}

export async function getProfessionalsForTreatment(treatmentId: string, tenantId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('professional_treatments')
    .select(`
      professional_id,
      professionals (id, first_name, last_name, active)
    `)
    .eq('treatment_id', treatmentId)
    .eq('tenant_id', tenantId)

  if (!data) return []

  const professionals: { id: string; first_name: string; last_name: string }[] = []
  for (const pt of data) {
    const p = pt.professionals as unknown as { id: string; first_name: string; last_name: string; active: boolean } | null
    if (p && p.active) {
      professionals.push({ id: p.id, first_name: p.first_name, last_name: p.last_name })
    }
  }
  return professionals
}

// Admin-only: scoped by professional_id (already belongs to one tenant)
export async function getTreatmentsForProfessional(professionalId: string) {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('professional_treatments')
    .select(`
      treatment_id,
      treatments (id, name, duration_minutes, price, category_id, categories (name))
    `)
    .eq('professional_id', professionalId)

  if (!data) return []

  return data
    .map(pt => pt.treatments as unknown as {
      id: string; name: string; duration_minutes: number; price: number
      category_id: string; categories: { name: string }
    })
    .filter(Boolean)
}
