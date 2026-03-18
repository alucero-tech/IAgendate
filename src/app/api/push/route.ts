import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushSubscriptionSchema } from '@/shared/schemas/zod-schemas'

// Save push subscription
export async function POST(req: NextRequest) {
  try {
    const parsed = pushSubscriptionSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { subscription, clientPhone, professionalId } = parsed.data

    const supabase = createAdminClient()

    // Upsert subscription by endpoint
    const record: Record<string, unknown> = {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      updated_at: new Date().toISOString(),
    }

    // Link to client by phone if provided
    if (clientPhone) {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('phone', clientPhone)
        .single()

      if (client) {
        record.client_id = client.id
      }
    }

    // Link to professional if provided
    if (professionalId) {
      record.professional_id = professionalId
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(record, { onConflict: 'endpoint' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
