export const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7:00 a 20:00

export const statusColors: Record<string, string> = {
  confirmed: 'bg-bella-rose-100 border-bella-rose-300 text-bella-rose-800',
  rescheduled: 'bg-bella-violet-100 border-bella-violet-300 text-bella-violet-800',
  pending_payment: 'bg-bella-gold-100 border-bella-gold-300 text-bella-gold-800',
  in_progress: 'bg-blue-100 border-blue-300 text-blue-800',
  completed: 'bg-green-100 border-green-300 text-green-800',
}

export const statusDotColors: Record<string, string> = {
  confirmed: 'bg-bella-rose-400',
  rescheduled: 'bg-bella-violet-400',
  pending_payment: 'bg-bella-gold-400',
  in_progress: 'bg-blue-400',
  completed: 'bg-green-400',
}
