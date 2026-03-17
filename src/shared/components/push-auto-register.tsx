'use client'

import { useEffect, useRef } from 'react'
import { usePushSubscription } from '@/shared/hooks/use-push-subscription'

export function PushAutoRegister({ professionalId }: { professionalId: string }) {
  const { isSupported, subscribe } = usePushSubscription()
  const registered = useRef(false)

  useEffect(() => {
    if (!isSupported || registered.current) return
    if (Notification.permission !== 'granted') return

    registered.current = true
    subscribe({ professionalId })
  }, [isSupported, subscribe, professionalId])

  return null
}
