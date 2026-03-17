// Shared types and helpers for booking services

export interface CartItem {
  treatmentId: string
  treatmentName: string
  professionalId: string
  professionalName: string
  durationMinutes: number
  price: number
}

export function calcDepositAmount(price: number, percentage: number): number {
  return Math.ceil(price * percentage / 100)
}
