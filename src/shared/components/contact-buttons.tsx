'use client'

import { Phone, MessageCircle } from 'lucide-react'

interface ContactButtonsProps {
  phone: string
  storeName?: string
}

function normalizePhoneForWhatsApp(phone: string): string {
  // Remove spaces, dashes, parentheses
  let clean = phone.replace(/[\s\-()]/g, '')
  // If starts with +, keep as is
  if (clean.startsWith('+')) return clean.replace('+', '')
  // Argentine format: add 549 prefix if it's a 10-digit local number
  if (clean.length === 10) return `549${clean}`
  return clean
}

function normalizePhoneForCall(phone: string): string {
  let clean = phone.replace(/[\s\-()]/g, '')
  if (clean.startsWith('+')) return clean
  if (clean.length === 10) return `+549${clean}`
  return `+${clean}`
}

export function ContactButtons({ phone, storeName }: ContactButtonsProps) {
  if (!phone) return null

  const waNumber = normalizePhoneForWhatsApp(phone)
  const callNumber = normalizePhoneForCall(phone)
  const waMessage = encodeURIComponent(
    storeName
      ? `Hola ${storeName}, tengo una consulta sobre mi turno.`
      : 'Hola, tengo una consulta sobre mi turno.'
  )

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      <a
        href={`https://wa.me/${waNumber}?text=${waMessage}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center w-14 h-14 rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 transition-colors hover:scale-105"
        aria-label="Contactar por WhatsApp"
      >
        <MessageCircle className="w-6 h-6" />
      </a>
      <a
        href={`tel:${callNumber}`}
        className="flex items-center justify-center w-14 h-14 rounded-full bg-bella-rose-500 text-white shadow-lg hover:bg-bella-rose-600 transition-colors hover:scale-105"
        aria-label="Llamar al local"
      >
        <Phone className="w-6 h-6" />
      </a>
    </div>
  )
}
