'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { updateDepositPercentageSchema } from '@/shared/schemas/zod-schemas'

export interface StoreSettings {
  store_name: string
  logo_url: string
  phone: string
  address: string
  instagram: string
  transfer_alias: string
  transfer_cbu: string
  transfer_bank: string
  transfer_holder: string
  cancellation_policy: string
}

const DEFAULTS: StoreSettings = {
  store_name: 'Mi Negocio',
  logo_url: '',
  phone: '',
  address: '',
  instagram: '',
  transfer_alias: '',
  transfer_cbu: '',
  transfer_bank: '',
  transfer_holder: '',
  cancellation_policy: 'Podés reagendar tu turno 1 vez sin costo. Si reagendás una segunda vez, perdés la reserva y la seña.',
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('store_settings')
    .select('key, value')

  if (!data || data.length === 0) return DEFAULTS

  const settings = { ...DEFAULTS }
  for (const row of data) {
    if (row.key in settings) {
      (settings as Record<string, string>)[row.key] = row.value || ''
    }
  }
  return settings
}

export async function getStoreName(): Promise<string> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('store_settings')
    .select('value')
    .eq('key', 'store_name')
    .single()
  return data?.value || DEFAULTS.store_name
}

export async function getStoreBranding(): Promise<{ name: string; logoUrl: string }> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('store_settings')
    .select('key, value')
    .in('key', ['store_name', 'logo_url'])

  const result = { name: DEFAULTS.store_name, logoUrl: '' }
  if (data) {
    for (const row of data) {
      if (row.key === 'store_name' && row.value) result.name = row.value
      if (row.key === 'logo_url' && row.value) result.logoUrl = row.value
    }
  }
  return result
}

export async function uploadLogo(formData: FormData) {
  const file = formData.get('logo') as File
  if (!file || file.size === 0) return { error: 'No se seleccionó archivo' }
  if (file.size > 2 * 1024 * 1024) return { error: 'El archivo no puede superar 2MB' }

  const supabase = createAdminClient()
  const ext = file.name.split('.').pop() || 'png'
  const fileName = `logo.${ext}`

  // Upload to storage (overwrite existing)
  const { error: uploadError } = await supabase.storage
    .from('branding')
    .upload(fileName, file, { upsert: true })

  if (uploadError) return { error: uploadError.message }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('branding')
    .getPublicUrl(fileName)

  const logoUrl = urlData.publicUrl

  // Save URL in store_settings
  const { data: existing } = await supabase
    .from('store_settings')
    .select('id')
    .eq('key', 'logo_url')
    .single()

  if (existing) {
    await supabase
      .from('store_settings')
      .update({ value: logoUrl, updated_at: new Date().toISOString() })
      .eq('key', 'logo_url')
  } else {
    await supabase
      .from('store_settings')
      .insert({ key: 'logo_url', value: logoUrl })
  }

  revalidatePath('/bella-donna/configuracion')
  revalidatePath('/bella-donna/dashboard')
  revalidatePath('/')
  return { success: true, logoUrl }
}

export async function updateDepositPercentage(percentage: number) {
  const parsed = updateDepositPercentageSchema.safeParse({ percentage })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('store_settings')
    .select('id')
    .eq('key', 'deposit_percentage')
    .single()

  if (existing) {
    const { error } = await supabase
      .from('store_settings')
      .update({ value: String(percentage), updated_at: new Date().toISOString() })
      .eq('key', 'deposit_percentage')
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('store_settings')
      .insert({ key: 'deposit_percentage', value: String(percentage) })
    if (error) return { error: error.message }
  }

  revalidatePath('/bella-donna/configuracion')
  revalidatePath('/reservar')
  return { success: true }
}

export async function updateStoreSettings(settings: StoreSettings) {
  const supabase = await createClient()

  const entries = Object.entries(settings) as [string, string][]

  for (const [key, value] of entries) {
    // Upsert each key-value pair
    const { data: existing } = await supabase
      .from('store_settings')
      .select('id')
      .eq('key', key)
      .single()

    if (existing) {
      const { error } = await supabase
        .from('store_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key)

      if (error) return { error: error.message }
    } else {
      const { error } = await supabase
        .from('store_settings')
        .insert({ key, value })

      if (error) return { error: error.message }
    }
  }

  revalidatePath('/bella-donna/configuracion')
  return { success: true }
}
