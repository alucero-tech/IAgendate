'use client'

import { useState, useEffect } from 'react'
import { Download, X, CheckCircle2 } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Check if user dismissed before (expire after 7 days)
    const dismissedAt = localStorage.getItem('pwa-dismiss')
    if (dismissedAt) {
      const days = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24)
      if (days < 7) {
        setDismissed(true)
        return
      }
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowSuccess(true)
      setTimeout(() => {
        setIsInstalled(true)
      }, 3000)
    }
    setInstalling(false)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('pwa-dismiss', String(Date.now()))
  }

  if (isInstalled || dismissed || (!deferredPrompt && !showSuccess)) return null

  // Success state after install
  if (showSuccess) {
    return (
      <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="bg-white rounded-2xl shadow-xl border border-green-200 p-3 flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-green-700">App instalada</p>
            <p className="text-xs text-green-600">Ya podés usarla desde tu pantalla de inicio</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl border border-bella-rose-200 p-3 flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-bella-rose-100 rounded-xl flex items-center justify-center">
          <Download className="w-5 h-5 text-bella-rose-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">Instalar app</p>
          <p className="text-xs text-muted-foreground">Reservá más rápido</p>
        </div>
        <button
          onClick={handleInstall}
          disabled={installing}
          className="flex-shrink-0 bg-bella-rose-600 text-white text-sm font-medium px-3 py-1.5 rounded-xl hover:bg-bella-rose-700 transition-colors disabled:opacity-70"
        >
          {installing ? 'Instalando...' : 'Instalar'}
        </button>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
