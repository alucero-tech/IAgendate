'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { webPush } from '@/lib/web-push'

interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

async function sendToSubscriptions(
  subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload
) {
  const supabase = createAdminClient()

  for (const sub of subscriptions) {
    try {
      await webPush().sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      )
    } catch (err: unknown) {
      const error = err as { statusCode?: number }
      // Remove expired/invalid subscriptions
      if (error.statusCode === 410 || error.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
}

// Notify client about their booking
export async function notifyClient(clientId: string, payload: PushPayload) {
  const supabase = createAdminClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('client_id', clientId)

  if (subs && subs.length > 0) {
    await sendToSubscriptions(subs, payload)
  }
}

// Notify a specific professional
export async function notifyProfessional(professionalId: string, payload: PushPayload) {
  const supabase = createAdminClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('professional_id', professionalId)

  if (subs && subs.length > 0) {
    await sendToSubscriptions(subs, payload)
  }
}

// Notify all professionals (e.g., new booking)
export async function notifyAllProfessionals(payload: PushPayload) {
  const supabase = createAdminClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .not('professional_id', 'is', null)

  if (subs && subs.length > 0) {
    await sendToSubscriptions(subs, payload)
  }
}

// Notify owner(s) only
export async function notifyOwner(payload: PushPayload) {
  const supabase = createAdminClient()

  const { data: owners } = await supabase
    .from('professionals')
    .select('id')
    .eq('is_owner', true)

  if (!owners) return

  for (const owner of owners) {
    await notifyProfessional(owner.id, payload)
  }
}
