'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, LogIn, Fingerprint } from 'lucide-react'
import { startAuthentication } from '@simplewebauthn/browser'

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [hasBiometric, setHasBiometric] = useState(false)
  const identifierRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  // Check if biometric login is available
  useEffect(() => {
    async function checkBiometric() {
      try {
        const res = await fetch('/api/auth/webauthn/authenticate')
        if (res.ok) setHasBiometric(true)
      } catch {
        // No credentials registered
      }
    }
    if (window.PublicKeyCredential) {
      checkBiometric()
    }
  }, [])

  async function handleLogin() {
    const identifier = identifierRef.current?.value?.trim() || ''
    const password = passwordRef.current?.value || ''

    if (!identifier || !password) {
      setError('Completá tu nombre o celular y contraseña')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al ingresar')
        setLoading(false)
        return
      }

      window.location.href = '/bella-donna/dashboard'
    } catch {
      setError('Error de conexión')
      setLoading(false)
    }
  }

  async function handleBiometricLogin() {
    setLoading(true)
    setError(null)

    try {
      // Get authentication options
      const optRes = await fetch('/api/auth/webauthn/authenticate')
      if (!optRes.ok) {
        setError('No hay huella registrada')
        setLoading(false)
        return
      }
      const options = await optRes.json()

      // Trigger fingerprint
      const assertion = await startAuthentication({ optionsJSON: options })

      // Verify with server
      const verifyRes = await fetch('/api/auth/webauthn/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertion }),
      })

      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        setError(data.error || 'Error de autenticación')
        setLoading(false)
        return
      }

      window.location.href = '/bella-donna/dashboard'
    } catch {
      setError('Huella no reconocida o cancelada')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Biometric login button - only shown if credentials exist */}
      {hasBiometric && (
        <>
          <Button
            type="button"
            disabled={loading}
            onClick={handleBiometricLogin}
            variant="outline"
            className="w-full h-16 text-base border-bella-rose-200 hover:bg-bella-rose-50"
          >
            <Fingerprint className="h-6 w-6 mr-3 text-bella-rose-600" />
            Ingresar con huella
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-muted-foreground">o con contraseña</span>
            </div>
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="identifier">Nombre completo o celular</Label>
        <Input
          ref={identifierRef}
          id="identifier"
          type="text"
          placeholder="Ej: María López o 1155667788"
          autoComplete="username"
          onKeyDown={(e) => { if (e.key === 'Enter') passwordRef.current?.focus() }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <div className="relative">
          <Input
            ref={passwordRef}
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••"
            autoComplete="current-password"
            className="pr-10"
            onKeyDown={(e) => { if (e.key === 'Enter') handleLogin() }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button
        type="button"
        disabled={loading}
        onClick={handleLogin}
        className="w-full bg-bella-rose-600 hover:bg-bella-rose-700"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Ingresando...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <LogIn className="h-4 w-4" />
            Ingresar
          </span>
        )}
      </Button>
    </div>
  )
}
