'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Fingerprint, X } from 'lucide-react'
import { startRegistration } from '@simplewebauthn/browser'

export function BiometricSetup({ professionalId }: { professionalId: string }) {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Only show on mobile/tablet devices with biometric support
    async function check() {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 1024)
      if (!isMobile) return

      if (!window.PublicKeyCredential) return
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      if (!available) return

      const dismissed = localStorage.getItem('biometric-asked')
      if (dismissed) return

      setShow(true)
    }
    check()
  }, [])

  async function handleRegister() {
    setLoading(true)
    try {
      // Get registration options
      const optRes = await fetch(`/api/auth/webauthn/register?professionalId=${professionalId}`)
      if (!optRes.ok) {
        setLoading(false)
        return
      }
      const options = await optRes.json()

      // Trigger fingerprint registration
      const attestation = await startRegistration({ optionsJSON: options })

      // Send to server
      const verifyRes = await fetch('/api/auth/webauthn/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ professionalId, response: attestation }),
      })

      if (verifyRes.ok) {
        setDone(true)
        localStorage.setItem('biometric-asked', 'registered')
        setTimeout(() => setShow(false), 2000)
      }
    } catch {
      // User cancelled or error
    }
    setLoading(false)
  }

  function handleDismiss() {
    localStorage.setItem('biometric-asked', 'dismissed')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-bella-rose-200 p-4 space-y-3">
        {done ? (
          <div className="flex items-center gap-3">
            <Fingerprint className="h-6 w-6 text-green-600" />
            <p className="font-medium text-green-700">Huella registrada</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-bella-rose-100 rounded-full flex items-center justify-center">
                  <Fingerprint className="w-5 h-5 text-bella-rose-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Ingresá más rápido</p>
                  <p className="text-xs text-muted-foreground">Usá tu huella la próxima vez</p>
                </div>
              </div>
              <button onClick={handleDismiss} className="text-muted-foreground p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Button
              onClick={handleRegister}
              disabled={loading}
              className="w-full bg-bella-rose-600 hover:bg-bella-rose-700"
              size="sm"
            >
              {loading ? 'Registrando...' : 'Activar huella'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
