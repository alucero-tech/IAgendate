import { NextRequest, NextResponse } from 'next/server'
import { generateAuthenticationOptions, verifyAuthenticationResponse, type VerifyAuthenticationResponseOpts } from '@simplewebauthn/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { webauthnAuthenticateBodySchema } from '@/shared/schemas/zod-schemas'

const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost'
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Step 1: Generate authentication options
export async function GET() {
  const admin = createAdminClient()

  // Get all registered credentials (exclude temporary challenge records)
  const { data: credentials } = await admin
    .from('webauthn_credentials')
    .select('credential_id, professional_id')
    .not('credential_id', 'like', 'challenge_%')
    .neq('credential_id', 'auth_challenge')

  if (!credentials || credentials.length === 0) {
    return NextResponse.json({ error: 'No credentials registered' }, { status: 404 })
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
    allowCredentials: credentials.map(c => ({
      id: c.credential_id,
    })),
  })

  // Store challenge using a real professional_id to satisfy FK constraint
  await admin.from('webauthn_credentials').upsert({
    professional_id: credentials[0].professional_id,
    credential_id: 'auth_challenge',
    public_key: options.challenge,
    counter: 0,
  }, { onConflict: 'credential_id' })

  return NextResponse.json(options)
}

// Step 2: Verify authentication
export async function POST(req: NextRequest) {
  const parsed = webauthnAuthenticateBodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { response: assertion } = parsed.data

  const admin = createAdminClient()

  // Get stored challenge
  const { data: challengeRecord } = await admin
    .from('webauthn_credentials')
    .select('public_key')
    .eq('credential_id', 'auth_challenge')
    .single()

  if (!challengeRecord) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 400 })
  }

  // Find the credential
  const credentialId = assertion.id
  const { data: credential } = await admin
    .from('webauthn_credentials')
    .select('*, professionals (email)')
    .eq('credential_id', credentialId)
    .single()

  if (!credential) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: assertion as unknown as VerifyAuthenticationResponseOpts['response'],
      expectedChallenge: challengeRecord.public_key,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: credential.credential_id,
        publicKey: Buffer.from(credential.public_key, 'base64url'),
        counter: credential.counter,
      },
    })

    if (!verification.verified) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 401 })
    }

    // Update counter
    await admin
      .from('webauthn_credentials')
      .update({ counter: verification.authenticationInfo.newCounter })
      .eq('credential_id', credentialId)

    // Clean up challenge
    await admin.from('webauthn_credentials').delete().eq('credential_id', 'auth_challenge')

    // Sign in the user via Supabase admin
    const prof = credential.professionals as unknown as { email: string }

    // Generate a magic link to create a session without password
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: prof.email,
    })

    if (linkError || !linkData) {
      return NextResponse.json({ error: 'Session error' }, { status: 500 })
    }

    // Exchange the token for a session
    const response = NextResponse.json({ success: true })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options as Record<string, unknown>)
            })
          },
        },
      }
    )

    const token_hash = linkData.properties?.hashed_token
    if (token_hash) {
      await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash,
      })
    }

    return response
  } catch {
    return NextResponse.json({ error: 'Authentication error' }, { status: 500 })
  }
}
