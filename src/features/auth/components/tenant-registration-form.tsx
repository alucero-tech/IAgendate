'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { checkSlugAvailability, registerTenant } from '@/features/auth/services/tenant-registration-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, XCircle, Loader2, ArrowRight, ArrowLeft, Scissors, Clock, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormData {
  name: string
  slug: string
  ownerName: string
  email: string
  password: string
}

// ── Step indicators ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
              i + 1 < current
                ? 'bg-bella-rose-500 text-white'
                : i + 1 === current
                ? 'bg-bella-rose-600 text-white shadow-lg shadow-bella-rose-200'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {i + 1 < current ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`w-8 h-px ${i + 1 < current ? 'bg-bella-rose-400' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Slug availability indicator ───────────────────────────────────────────────

function SlugStatus({ slug, available }: { slug: string; available: boolean | null }) {
  if (!slug || slug.length < 3) return null
  if (available === null) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
  return available
    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
    : <XCircle className="w-4 h-4 text-red-500" />
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TenantRegistrationForm() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>({ name: '', slug: '', ownerName: '', email: '', password: '' })
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [slugEdited, setSlugEdited] = useState(false)
  const [errors, setErrors] = useState<Partial<FormData>>({})
  const [globalError, setGlobalError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-generate slug from name (only if user hasn't manually edited it)
  useEffect(() => {
    if (!slugEdited && form.name) {
      setForm(f => ({ ...f, slug: slugify(form.name) }))
    }
  }, [form.name, slugEdited])

  // Debounced slug availability check
  const checkSlug = useCallback((slug: string) => {
    if (slug.length < 3) { setSlugAvailable(null); return }
    setSlugAvailable(null)
    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await checkSlugAvailability(slug)
        setSlugAvailable(result.available)
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const cleanup = checkSlug(form.slug)
    return cleanup
  }, [form.slug, checkSlug])

  function updateField(field: keyof FormData, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
  }

  // ── Step 1 validation ──────────────────────────────────────────────────────

  function validateStep1(): boolean {
    const errs: Partial<FormData> = {}
    if (!form.name || form.name.length < 2) errs.name = 'Ingresá el nombre del negocio'
    if (!form.slug || form.slug.length < 3) errs.slug = 'El slug debe tener al menos 3 caracteres'
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) errs.slug = 'Solo letras minúsculas, números y guiones'
    if (slugAvailable === false) errs.slug = 'Este slug ya está en uso'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Step 2 validation ──────────────────────────────────────────────────────

  function validateStep2(): boolean {
    const errs: Partial<FormData> = {}
    if (!form.ownerName || form.ownerName.length < 2) errs.ownerName = 'Ingresá tu nombre'
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email inválido'
    if (!form.password || form.password.length < 8) errs.password = 'Mínimo 8 caracteres'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function next() {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep(s => s + 1)
  }

  // ── Final submit ───────────────────────────────────────────────────────────

  async function handleSubmit() {
    setGlobalError('')
    setIsSubmitting(true)

    const result = await registerTenant({
      name: form.name,
      slug: form.slug,
      ownerName: form.ownerName,
      email: form.email,
      password: form.password,
    })

    if (result.error) {
      setGlobalError(result.error)
      setIsSubmitting(false)
      return
    }

    // Sign in the newly created user
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (signInError) {
      setGlobalError('Cuenta creada. Por favor iniciá sesión en /login')
      setIsSubmitting(false)
      return
    }

    // Redirect to new tenant's dashboard
    router.push(`/${result.slug}/admin/dashboard`)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-md mx-auto">
      <StepIndicator current={step} total={3} />

      {/* ── Step 1: Nombre del negocio + Slug ──────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">Tu negocio</h2>
            <p className="text-muted-foreground text-sm mt-1">¿Cómo se llama tu salón o peluquería?</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre del negocio</Label>
            <Input
              id="name"
              placeholder="Ej: Salón Valentina"
              value={form.name}
              onChange={e => updateField('name', e.target.value)}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">URL de tu sistema</Label>
            <div className="flex items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <span className="text-muted-foreground shrink-0">iagendate.com/</span>
              <input
                id="slug"
                className="flex-1 bg-transparent outline-none min-w-0"
                placeholder="mi-salon"
                value={form.slug}
                onChange={e => {
                  setSlugEdited(true)
                  updateField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }}
              />
              <SlugStatus slug={form.slug} available={slugAvailable} />
            </div>
            {errors.slug
              ? <p className="text-red-500 text-xs">{errors.slug}</p>
              : slugAvailable === true
              ? <p className="text-green-600 text-xs">¡Disponible!</p>
              : slugAvailable === false
              ? <p className="text-red-500 text-xs">Este slug ya está en uso. Probá otro.</p>
              : <p className="text-muted-foreground text-xs">Este será el link de tu sistema de reservas</p>
            }
          </div>

          <Button
            onClick={next}
            disabled={slugAvailable === null && form.slug.length >= 3}
            className="w-full bg-bella-rose-600 hover:bg-bella-rose-700"
          >
            Continuar
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* ── Step 2: Datos del propietario ──────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">Tu cuenta</h2>
            <p className="text-muted-foreground text-sm mt-1">Con esto accedés al panel de administración</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerName">Tu nombre</Label>
            <Input
              id="ownerName"
              placeholder="Ej: Valentina García"
              value={form.ownerName}
              onChange={e => updateField('ownerName', e.target.value)}
              className={errors.ownerName ? 'border-red-500' : ''}
            />
            {errors.ownerName && <p className="text-red-500 text-xs">{errors.ownerName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={form.email}
              onChange={e => updateField('email', e.target.value)}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={form.password}
              onChange={e => updateField('password', e.target.value)}
              className={errors.password ? 'border-red-500' : ''}
            />
            {errors.password && <p className="text-red-500 text-xs">{errors.password}</p>}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Atrás
            </Button>
            <Button onClick={next} className="flex-1 bg-bella-rose-600 hover:bg-bella-rose-700">
              Continuar
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Resumen + Crear ─────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">Listo para empezar</h2>
            <p className="text-muted-foreground text-sm mt-1">14 días gratis · Sin tarjeta de crédito</p>
          </div>

          {/* Summary card */}
          <div className="mesh-gradient-card rounded-2xl border border-border/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Negocio</span>
              <span className="font-semibold">{form.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">URL</span>
              <span className="font-mono text-sm text-bella-rose-600">/{form.slug}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Admin</span>
              <span className="text-sm">{form.ownerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan</span>
              <span className="text-sm font-medium text-bella-violet-600">Trial — 14 días</span>
            </div>
          </div>

          {/* Features included */}
          <div className="grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
            <div className="space-y-1">
              <Scissors className="w-5 h-5 mx-auto text-bella-rose-500" />
              <p>Reservas online</p>
            </div>
            <div className="space-y-1">
              <Users className="w-5 h-5 mx-auto text-bella-violet-500" />
              <p>Profesionales</p>
            </div>
            <div className="space-y-1">
              <Clock className="w-5 h-5 mx-auto text-bella-gold-500" />
              <p>Calendario</p>
            </div>
          </div>

          {globalError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {globalError}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} disabled={isSubmitting} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Atrás
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-bella-rose-600 hover:bg-bella-rose-700"
            >
              {isSubmitting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creando...</>
                : 'Crear mi sistema'
              }
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
