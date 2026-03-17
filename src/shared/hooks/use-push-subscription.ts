'use client'

import { useState, useCallback } from 'react'

export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  // Check support on mount
  if (typeof window !== 'undefined') {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    if (supported !== isSupported) setIsSupported(supported)
  }

  const subscribe = useCallback(async (opts?: { clientPhone?: string; professionalId?: string }) => {
    if (!isSupported) return false

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return false

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) return false

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        })
      }

      // Send to server
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          clientPhone: opts?.clientPhone,
          professionalId: opts?.professionalId,
        }),
      })

      if (res.ok) {
        setIsSubscribed(true)
        return true
      }
    } catch {
      // Permission denied or SW error
    }
    return false
  }, [isSupported])

  return { isSupported, isSubscribed, subscribe }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
