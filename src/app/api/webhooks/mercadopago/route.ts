import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { preApprovalClient } from '@/lib/mercadopago'
import { addMonths } from 'date-fns'

// ── MP Subscription status → tenant plan mapping ────────────────────────────
// MP statuses: authorized | paused | cancelled | pending
const PLAN_BY_REASON: Record<string, string> = {
  'IAgendate Starter': 'starter',
  'IAgendate Pro': 'pro',
  'IAgendate Business': 'business',
}

function planFromReason(reason: string): string {
  for (const [key, plan] of Object.entries(PLAN_BY_REASON)) {
    if (reason.includes(key)) return plan
  }
  return 'starter' // safe fallback
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      type?: string
      action?: string
      data?: { id?: string | number }
    }

    // Only handle subscription events
    if (body.type !== 'subscription_preapproval') {
      return NextResponse.json({ received: true })
    }

    const subscriptionId = body.data?.id
    if (!subscriptionId) {
      return NextResponse.json({ received: true })
    }

    // Fetch subscription details from MP
    const subscription = await preApprovalClient.get({ id: String(subscriptionId) })

    if (!subscription) {
      return NextResponse.json({ received: true })
    }

    // external_reference stores the tenant_id
    const tenantId = subscription.external_reference
    if (!tenantId) {
      return NextResponse.json({ received: true })
    }

    const mpStatus = subscription.status // authorized | paused | cancelled | pending
    const reason = subscription.reason ?? ''

    const supabase = createAdminClient()

    if (mpStatus === 'authorized') {
      // Payment approved — extend access for 1 month from today
      const newExpiry = addMonths(new Date(), 1).toISOString()

      await supabase
        .from('tenants')
        .update({
          status: 'active',
          plan: planFromReason(reason),
          plan_expires_at: newExpiry,
          mp_subscription_id: String(subscriptionId),
        })
        .eq('id', tenantId)

    } else if (mpStatus === 'cancelled') {
      // Subscription cancelled — keep access until plan_expires_at, mark status
      await supabase
        .from('tenants')
        .update({
          status: 'cancelled',
          mp_subscription_id: String(subscriptionId),
        })
        .eq('id', tenantId)

    } else if (mpStatus === 'paused') {
      // Payment failed — keep current plan_expires_at, will block when it passes
      await supabase
        .from('tenants')
        .update({
          mp_subscription_id: String(subscriptionId),
        })
        .eq('id', tenantId)
    }

    return NextResponse.json({ received: true })

  } catch {
    // Always return 200 to avoid MP retrying infinitely
    return NextResponse.json({ received: true })
  }
}
