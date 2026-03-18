import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginSchema } from '@/shared/schemas/zod-schemas'

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { identifier, password } = parsed.data

  // Look up professional by name or phone to find their email
  const admin = createAdminClient()
  const trimmed = identifier.trim()

  // Try phone first (if it looks like a number)
  const isPhone = /^\d{6,}$/.test(trimmed.replace(/[\s\-+()]/g, ''))

  let email: string | null = null

  if (isPhone) {
    const phone = trimmed.replace(/[\s\-+()]/g, '')
    const { data } = await admin
      .from('professionals')
      .select('email')
      .eq('phone', phone)
      .eq('active', true)
      .single()
    email = data?.email || null

    // Also try partial match (last digits)
    if (!email) {
      const { data: partial } = await admin
        .from('professionals')
        .select('email')
        .like('phone', `%${phone}`)
        .eq('active', true)
        .single()
      email = partial?.email || null
    }
  }

  // Try by full name (first_name + last_name)
  if (!email) {
    const { data: allProfs } = await admin
      .from('professionals')
      .select('email, first_name, last_name')
      .eq('active', true)

    if (allProfs) {
      const match = allProfs.find(p => {
        const fullName = `${p.first_name} ${p.last_name}`.toLowerCase()
        return fullName === trimmed.toLowerCase()
      })
      email = match?.email || null

      // Also try first name only
      if (!email) {
        const firstNameMatch = allProfs.find(p =>
          p.first_name.toLowerCase() === trimmed.toLowerCase()
        )
        // Only use first name if it's unique
        if (firstNameMatch) {
          const count = allProfs.filter(p =>
            p.first_name.toLowerCase() === trimmed.toLowerCase()
          ).length
          if (count === 1) {
            email = firstNameMatch.email
          }
        }
      }
    }
  }

  // Also try if they typed their email directly
  if (!email && trimmed.includes('@')) {
    email = trimmed
  }

  if (!email) {
    return NextResponse.json(
      { error: 'No encontramos tu cuenta. Probá con tu nombre completo o celular.' },
      { status: 401 }
    )
  }

  // Now authenticate with Supabase using the found email
  const response = NextResponse.json({ success: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as Record<string, unknown>)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  return response
}
