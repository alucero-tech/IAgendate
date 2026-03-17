'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

interface ProfessionalRow {
  nombre: string
  apellido: string
  email: string
  telefono: string
  comision: number
  horarios: { day: number; start: string; end: string }[]
}

interface ServiceRow {
  categoria: string
  servicio: string
  precio: number
  duracion: number
}

interface AssignmentRow {
  email: string
  servicio: string
}

export interface ExcelData {
  profesionales: ProfessionalRow[]
  servicios: ServiceRow[]
  asignaciones: AssignmentRow[]
}

export interface UpsertResult {
  success: boolean
  error?: string
  stats: {
    profCreated: number
    profUpdated: number
    profSkipped: number
    catCreated: number
    svcCreated: number
    svcUpdated: number
    svcSkipped: number
    assignCreated: number
    assignSkipped: number
    schedUpdated: number
  }
  errors: string[]
}

export async function upsertFromExcel(data: ExcelData): Promise<UpsertResult> {
  const supabase = createAdminClient()
  const stats = {
    profCreated: 0, profUpdated: 0, profSkipped: 0,
    catCreated: 0, svcCreated: 0, svcUpdated: 0, svcSkipped: 0,
    assignCreated: 0, assignSkipped: 0, schedUpdated: 0,
  }
  const errors: string[] = []

  // ===== 1. UPSERT PROFESIONALES =====
  const emailToProfId = new Map<string, string>()

  for (const prof of data.profesionales) {
    if (!prof.email || !prof.nombre) {
      errors.push(`Profesional sin email o nombre: ${prof.nombre || '?'} ${prof.apellido || ''}`)
      continue
    }

    // Check if professional exists by email
    const { data: existing } = await supabase
      .from('professionals')
      .select('id, user_id')
      .eq('email', prof.email.toLowerCase().trim())
      .single()

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('professionals')
        .update({
          first_name: prof.nombre.trim(),
          last_name: prof.apellido.trim(),
          phone: prof.telefono?.trim() || null,
          commission_percentage: prof.comision || 0,
        })
        .eq('id', existing.id)

      if (error) {
        errors.push(`Error actualizando ${prof.email}: ${error.message}`)
      } else {
        stats.profUpdated++
      }
      emailToProfId.set(prof.email.toLowerCase().trim(), existing.id)
    } else {
      // Create new auth user + professional
      const tempPassword = `Bella${Date.now().toString(36)}!`
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: prof.email.toLowerCase().trim(),
        password: tempPassword,
        email_confirm: true,
      })

      if (authError) {
        errors.push(`Error creando usuario ${prof.email}: ${authError.message}`)
        continue
      }

      const { data: newProf, error: profError } = await supabase
        .from('professionals')
        .insert({
          user_id: authData.user.id,
          first_name: prof.nombre.trim(),
          last_name: prof.apellido.trim(),
          email: prof.email.toLowerCase().trim(),
          phone: prof.telefono?.trim() || null,
          commission_percentage: prof.comision || 0,
          is_owner: false,
        })
        .select('id')
        .single()

      if (profError) {
        errors.push(`Error creando profesional ${prof.email}: ${profError.message}`)
        continue
      }

      stats.profCreated++
      emailToProfId.set(prof.email.toLowerCase().trim(), newProf.id)
    }

    // Upsert schedules for this professional
    const profId = emailToProfId.get(prof.email.toLowerCase().trim())
    if (profId && prof.horarios.length > 0) {
      for (const h of prof.horarios) {
        const { error } = await supabase
          .from('schedules')
          .upsert({
            professional_id: profId,
            day_of_week: h.day,
            start_time: h.start,
            end_time: h.end,
            is_active: true,
          }, { onConflict: 'professional_id,day_of_week' })

        if (error) {
          errors.push(`Error horario ${prof.email} día ${h.day}: ${error.message}`)
        } else {
          stats.schedUpdated++
        }
      }

      // Deactivate days not in the Excel
      const activeDays = prof.horarios.map(h => h.day)
      const allDays = [1, 2, 3, 4, 5, 6] // lunes a sábado
      const inactiveDays = allDays.filter(d => !activeDays.includes(d))
      if (inactiveDays.length > 0) {
        await supabase
          .from('schedules')
          .upsert(
            inactiveDays.map(d => ({
              professional_id: profId,
              day_of_week: d,
              start_time: '09:00',
              end_time: '18:00',
              is_active: false,
            })),
            { onConflict: 'professional_id,day_of_week' }
          )
      }
    }
  }

  // ===== 2. UPSERT SERVICIOS (categorías + tratamientos) =====
  const catNameToId = new Map<string, string>()
  const svcNameToId = new Map<string, string>()

  // First, load existing categories
  const { data: existingCats } = await supabase
    .from('categories')
    .select('id, name')

  for (const cat of existingCats || []) {
    catNameToId.set(cat.name.toLowerCase().trim(), cat.id)
  }

  // Load existing treatments
  const { data: existingTreats } = await supabase
    .from('treatments')
    .select('id, name, category_id, price, duration_minutes')

  for (const t of existingTreats || []) {
    svcNameToId.set(t.name.toLowerCase().trim(), t.id)
  }

  for (const svc of data.servicios) {
    if (!svc.servicio || !svc.categoria) {
      errors.push(`Servicio sin nombre o categoría: ${svc.servicio || '?'}`)
      continue
    }

    // Ensure category exists
    const catKey = svc.categoria.toLowerCase().trim()
    if (!catNameToId.has(catKey)) {
      const { data: newCat, error } = await supabase
        .from('categories')
        .insert({ name: svc.categoria.trim() })
        .select('id')
        .single()

      if (error) {
        errors.push(`Error creando categoría ${svc.categoria}: ${error.message}`)
        continue
      }
      catNameToId.set(catKey, newCat.id)
      stats.catCreated++
    }

    const categoryId = catNameToId.get(catKey)!
    const svcKey = svc.servicio.toLowerCase().trim()

    // Check if treatment exists
    const existingTreat = (existingTreats || []).find(
      t => t.name.toLowerCase().trim() === svcKey
    )

    if (existingTreat) {
      // Check if anything changed
      const priceChanged = existingTreat.price !== svc.precio
      const durationChanged = existingTreat.duration_minutes !== svc.duracion
      const catChanged = existingTreat.category_id !== categoryId

      if (priceChanged || durationChanged || catChanged) {
        const { error } = await supabase
          .from('treatments')
          .update({
            price: svc.precio,
            duration_minutes: svc.duracion,
            category_id: categoryId,
          })
          .eq('id', existingTreat.id)

        if (error) {
          errors.push(`Error actualizando ${svc.servicio}: ${error.message}`)
        } else {
          stats.svcUpdated++
        }
      } else {
        stats.svcSkipped++
      }
      svcNameToId.set(svcKey, existingTreat.id)
    } else {
      // Create new treatment
      const { data: newTreat, error } = await supabase
        .from('treatments')
        .insert({
          name: svc.servicio.trim(),
          category_id: categoryId,
          price: svc.precio,
          duration_minutes: svc.duracion,
          active: true,
        })
        .select('id')
        .single()

      if (error) {
        errors.push(`Error creando ${svc.servicio}: ${error.message}`)
      } else {
        stats.svcCreated++
        svcNameToId.set(svcKey, newTreat.id)
      }
    }
  }

  // ===== 3. UPSERT ASIGNACIONES =====
  for (const assign of data.asignaciones) {
    if (!assign.email || !assign.servicio) {
      errors.push(`Asignación incompleta: ${assign.email || '?'} -> ${assign.servicio || '?'}`)
      continue
    }

    const profId = emailToProfId.get(assign.email.toLowerCase().trim())
    const treatId = svcNameToId.get(assign.servicio.toLowerCase().trim())

    if (!profId) {
      // Try to find in DB
      const { data: prof } = await supabase
        .from('professionals')
        .select('id')
        .eq('email', assign.email.toLowerCase().trim())
        .single()

      if (!prof) {
        errors.push(`Profesional no encontrado: ${assign.email}`)
        continue
      }
      emailToProfId.set(assign.email.toLowerCase().trim(), prof.id)
    }

    if (!treatId) {
      errors.push(`Servicio no encontrado: ${assign.servicio}`)
      continue
    }

    const finalProfId = emailToProfId.get(assign.email.toLowerCase().trim())!

    // Check if assignment exists
    const { data: existingAssign } = await supabase
      .from('professional_treatments')
      .select('id')
      .eq('professional_id', finalProfId)
      .eq('treatment_id', treatId)
      .single()

    if (existingAssign) {
      stats.assignSkipped++
    } else {
      const { error } = await supabase
        .from('professional_treatments')
        .insert({
          professional_id: finalProfId,
          treatment_id: treatId,
        })

      if (error) {
        errors.push(`Error asignando ${assign.servicio} a ${assign.email}: ${error.message}`)
      } else {
        stats.assignCreated++
      }
    }
  }

  revalidatePath('/bella-donna/profesionales')
  revalidatePath('/bella-donna/tratamientos')
  revalidatePath('/bella-donna/configuracion')

  return { success: errors.length === 0, stats, errors }
}
