import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { preApprovalClient } from '@/lib/mercadopago'
import { addMonths } from 'date-fns'

// ── MP Subscription status → tenant plan mapping ────────────────────────────
const PLAN_BY_REASON: Record<string, string> = {
  'IAgendate Starter': 'starter',
  'IAgendate Pro': 'pro',
  'IAgendate Business': 'business',
}

function planFromReason(reason: string): string {
  for (const [key, plan] of Object.entries(PLAN_BY_REASON)) {
    if (reason.includes(key)) return plan
  }
  return 'starter'
}

// ── Webhook log helper ────────────────────────────────────────────────────────

async function logWebhook(params: {
  eventType: string
  eventId: string
  tenantId?: string | null
  status: 'received' | 'processed' | 'error' | 'ignored'
  payload: unknown
  errorMessage?: string
}) {
  try {
    const supabase = createAdminClient()
    await supabase.from('webhook_logs').insert({
      source: 'mercadopago',
      event_type: params.eventType,
      event_id: params.eventId,
      tenant_id: params.tenantId ?? null,
      status: params.status,
      payload: params.payload,
      error_message: params.errorMessage ?? null,
    })
  } catch {
    // Log silently — never let logging break the webhook response
    console.error('[webhook_logs] Failed to persist log')
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let rawBody: unknown = null
  let subscriptionId = ''

  try {
    rawBody = await request.json()
    const body = rawBody as {
      type?: string
      action?: string
      data?: { id?: string | number }
    }

    // Ignore non-subscription events (log as ignored for visibility)
    if (body.type !== 'subscription_preapproval') {
      await logWebhook({
        eventType: body.type ?? 'unknown',
        eventId: String(body.data?.id ?? ''),
        status: 'ignored',
        payload: rawBody,
      })
      return NextResponse.json({ received: true })
    }

    subscriptionId = String(body.data?.id ?? '')
    if (!subscriptionId) {
      await logWebhook({ eventType: 'subscription_preapproval', eventId: '', status: 'error', payload: rawBody, errorMessage: 'Missing subscription ID' })
      return NextResponse.json({ received: true })
    }

    // Fetch subscription details from MP
    const subscription = await preApprovalClient.get({ id: subscriptionId })

    if (!subscription) {
      await logWebhook({ eventType: 'subscription_preapproval', eventId: subscriptionId, status: 'error', payload: rawBody, errorMessage: 'Subscription not found in MP' })
      return NextResponse.json({ received: true })
    }

    const tenantId = subscription.external_reference ?? null
    const mpStatus = subscription.status
    const reason = subscription.reason ?? ''

    if (!tenantId) {
      await logWebhook({ eventType: 'subscription_preapproval', eventId: subscriptionId, status: 'error', payload: rawBody, errorMessage: 'Missing external_reference (tenant_id)' })
      return NextResponse.json({ received: true })
    }

    const supabase = createAdminClient()

    if (mpStatus === 'authorized') {
      const newExpiry = addMonths(new Date(), 1).toISOString()
      await supabase
        .from('tenants')
        .update({ status: 'active', plan: planFromReason(reason), plan_expires_at: newExpiry, mp_subscription_id: subscriptionId })
        .eq('id', tenantId)

    } else if (mpStatus === 'cancelled') {
      await supabase
        .from('tenants')
        .update({ status: 'cancelled', mp_subscription_id: subscriptionId })
        .eq('id', tenantId)

    } else if (mpStatus === 'paused') {
      await supabase
        .from('tenants')
        .update({ mp_subscription_id: subscriptionId })
        .eq('id', tenantId)
    }

    await logWebhook({
      eventType: 'subscription_preapproval',
      eventId: subscriptionId,
      tenantId,
      status: 'processed',
      payload: rawBody,
    })

    return NextResponse.json({ received: true })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[webhook/mercadopago]', message)

    await logWebhook({
      eventType: 'subscription_preapproval',
      eventId: subscriptionId,
      status: 'error',
      payload: rawBody,
      errorMessage: message,
    })

    // Always 200 — MP retries on non-2xx
    return NextResponse.json({ received: true })
  }
}
