import { NextRequest, NextResponse } from 'next/server'
import { generateRegistrationOptions, verifyRegistrationResponse, type VerifyRegistrationResponseOpts } from '@simplewebauthn/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { webauthnRegisterQuerySchema, webauthnRegisterBodySchema } from '@/shared/schemas/zod-schemas'

const RP_NAME = 'IAgendate'
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost'
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Step 1: Generate registration options
export async function GET(req: NextRequest) {
  const queryParsed = webauthnRegisterQuerySchema.safeParse({
    professionalId: req.nextUrl.searchParams.get('professionalId'),
  })
  if (!queryParsed.success) {
    return NextResponse.json({ error: queryParsed.error.issues[0].message }, { status: 400 })
  }
  const { professionalId } = queryParsed.data

  const admin = createAdminClient()
  const { data: prof } = await admin
    .from('professionals')
    .select('id, first_name, last_name, email')
    .eq('id', professionalId)
    .single()

  if (!prof) {
    return NextResponse.json({ error: 'Professional not found' }, { status: 404 })
  }

  // Get existing credentials
  const { data: existing } = await admin
    .from('webauthn_credentials')
    .select('credential_id')
    .eq('professional_id', professionalId)

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: prof.email,
    userDisplayName: `${prof.first_name} ${prof.last_name}`,
    attestationType: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
    },
    excludeCredentials: (existing || []).map(c => ({
      id: c.credential_id,
    })),
  })

  // Store challenge temporarily (using a simple approach - store in DB)
  await admin.from('webauthn_credentials').upsert({
    professional_id: professionalId,
    credential_id: `challenge_${professionalId}`,
    public_key: options.challenge,
    counter: 0,
  }, { onConflict: 'credential_id' })

  return NextResponse.json(options)
}

// Step 2: Verify registration
export async function POST(req: NextRequest) {
  const parsed = webauthnRegisterBodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { professionalId, response: attestation } = parsed.data

  const admin = createAdminClient()

  // Retrieve stored challenge
  const { data: challengeRecord } = await admin
    .from('webauthn_credentials')
    .select('public_key')
    .eq('credential_id', `challenge_${professionalId}`)
    .single()

  if (!challengeRecord) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 400 })
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: attestation as unknown as VerifyRegistrationResponseOpts['response'],
      expectedChallenge: challengeRecord.public_key,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
    }

    const { credential } = verification.registrationInfo

    // Save credential
    await admin.from('webauthn_credentials').insert({
      professional_id: professionalId,
      credential_id: Buffer.from(credential.id).toString('base64url'),
      public_key: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      device_name: 'Huella digital',
    })

    // Clean up challenge
    await admin.from('webauthn_credentials').delete().eq('credential_id', `challenge_${professionalId}`)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Verification error' }, { status: 500 })
  }
}
