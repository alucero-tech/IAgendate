import { tool } from 'ai'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

export const listCategories = tool({
  description: 'Lista todas las categorías de servicios disponibles. NO incluye precios.',
  inputSchema: z.object({}),
  execute: async () => {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('categories')
      .select('id, name, description')
      .eq('active', true)
      .order('display_order')

    if (!data || data.length === 0) {
      return { categories: [], message: 'No hay categorías de servicios configuradas en este momento.' }
    }

    return { categories: data }
  },
})

export const searchTreatments = tool({
  description: 'Busca tratamientos por nombre o descripción. NUNCA devuelve precios. Incluye contexto de IA si está disponible.',
  inputSchema: z.object({
    query: z.string().describe('Término de búsqueda (ej: "uñas", "pelo", "alisado")'),
  }),
  execute: async ({ query }) => {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('treatments')
      .select('id, name, description, ai_context, duration_minutes, category_id, categories (name)')
      .eq('active', true)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .order('name')

    if (!data || data.length === 0) {
      return {
        treatments: [],
        count: 0,
        message: `No encontré tratamientos que coincidan con "${query}". Probá con otro término o consultá las categorías disponibles con listCategories.`,
      }
    }

    const results = data.map(t => ({
      name: t.name,
      description: t.description || 'Sin descripción disponible',
      aiContext: t.ai_context || null,
      durationMinutes: t.duration_minutes,
      category: (t.categories as unknown as { name: string })?.name || '',
    }))

    return { treatments: results, count: results.length }
  },
})

export const getTreatmentsByCategory = tool({
  description: 'Obtiene todos los tratamientos de una categoría específica. NO incluye precios.',
  inputSchema: z.object({
    categoryName: z.string().describe('Nombre de la categoría (ej: "Pelo", "Uñas", "Cejas")'),
  }),
  execute: async ({ categoryName }) => {
    const supabase = createAdminClient()

    const { data: category } = await supabase
      .from('categories')
      .select('id, name')
      .eq('active', true)
      .ilike('name', `%${categoryName}%`)
      .single()

    if (!category) {
      // Try to suggest existing categories
      const { data: allCats } = await supabase
        .from('categories')
        .select('name')
        .eq('active', true)
        .order('display_order')

      const available = (allCats || []).map(c => c.name).join(', ')
      return {
        error: `No encontré la categoría "${categoryName}". Las categorías disponibles son: ${available || 'ninguna configurada'}.`,
        treatments: [],
      }
    }

    const { data: treatments } = await supabase
      .from('treatments')
      .select('name, description, ai_context, duration_minutes')
      .eq('category_id', category.id)
      .eq('active', true)
      .order('name')

    if (!treatments || treatments.length === 0) {
      return {
        category: category.name,
        treatments: [],
        message: `La categoría "${category.name}" existe pero no tiene tratamientos activos.`,
      }
    }

    return {
      category: category.name,
      treatments: treatments.map(t => ({
        name: t.name,
        description: t.description || 'Sin descripción disponible',
        aiContext: t.ai_context || null,
        durationMinutes: t.duration_minutes,
      })),
    }
  },
})

export const describeTreatment = tool({
  description: 'Obtiene información detallada de un tratamiento específico incluyendo contexto para asesorar a la clienta. NUNCA devuelve el precio.',
  inputSchema: z.object({
    treatmentName: z.string().describe('Nombre del tratamiento'),
  }),
  execute: async ({ treatmentName }) => {
    const supabase = createAdminClient()

    const { data } = await supabase
      .from('treatments')
      .select('name, description, ai_context, duration_minutes, categories (name)')
      .eq('active', true)
      .ilike('name', `%${treatmentName}%`)
      .limit(1)
      .single()

    if (!data) {
      return {
        error: `No encontré el tratamiento "${treatmentName}". Usá searchTreatments para buscar tratamientos disponibles.`,
        found: false,
      }
    }

    return {
      found: true,
      name: data.name,
      description: data.description || 'Sin descripción disponible',
      aiContext: data.ai_context || 'No hay información detallada cargada para este tratamiento. Solo podés informar el nombre y la duración.',
      durationMinutes: data.duration_minutes,
      category: (data.categories as unknown as { name: string })?.name || '',
    }
  },
})

export const treatmentTools = {
  listCategories,
  searchTreatments,
  getTreatmentsByCategory,
  describeTreatment,
}
