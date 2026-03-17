import { createGoogleGenerativeAI } from '@ai-sdk/google'

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY!,
})

export const MODELS = {
  // Rapido y gratuito - para chatbot asesor, sugerencias
  fast: 'gemini-2.0-flash',

  // Balanceado - para asistente de reserva, metricas
  balanced: 'gemini-2.0-flash',

  // Potente - para analisis complejos
  powerful: 'gemini-2.5-flash-preview-05-20',
} as const

export type ModelKey = keyof typeof MODELS
