# Bloque 00: Setup Base

> Configuracion inicial para todos los bloques de AI Templates.

**Tiempo:** 10 minutos
**Prerequisitos:** Proyecto Next.js existente

---

## 1. Instalar Dependencias

```bash
# Core AI SDK v6
npm install ai@latest @ai-sdk/react @ai-sdk/google

# Validacion
npm install zod

# Supabase (para bloques que lo necesiten)
npm install @supabase/supabase-js @supabase/ssr
```

---

## 2. Variables de Entorno

```env
# .env.local

# Google Gemini (REQUERIDO)
GOOGLE_AI_API_KEY=tu-api-key-de-google

# Supabase (para historial, vision, auth)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...tu-anon-key
```

### Obtener API Keys

1. **Google AI**: https://aistudio.google.com/apikey
2. **Supabase**: Dashboard > Settings > API

---

## 3. Configurar Google Gemini Provider

```typescript
// lib/ai/google.ts
// NUNCA MODIFICAR - Provider base

import { createGoogleGenerativeAI } from '@ai-sdk/google'

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY!,
})

// Modelos disponibles (MODIFICAR segun necesites)
export const MODELS = {
  // Rapidos y gratuitos
  fast: 'gemini-2.0-flash',

  // Balanceados
  balanced: 'gemini-2.0-flash',

  // Potentes
  powerful: 'gemini-2.5-flash-preview-05-20',

  // Vision (para analisis de imagenes)
  vision: 'gemini-2.0-flash',
} as const

export type ModelKey = keyof typeof MODELS
```

---

## 4. Configurar Supabase (Opcional)

Solo necesario si usaras historial, vision o auth.

```typescript
// lib/supabase/client.ts
// NUNCA MODIFICAR - Cliente browser

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// lib/supabase/server.ts
// NUNCA MODIFICAR - Cliente server

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component - ignorar
          }
        },
      },
    }
  )
}
```

---

## 5. Estructura de Carpetas Recomendada

```
src/
├── app/
│   └── api/
│       └── chat/           # API route para chat
│           └── route.ts
├── lib/
│   ├── ai/
│   │   └── google.ts       # Provider configurado
│   └── supabase/
│       ├── client.ts       # Browser client
│       └── server.ts       # Server client
├── features/
│   └── chat/               # Feature de chat
│       ├── components/
│       ├── hooks/
│       └── types/
└── .env.local
```

---

## 6. Verificar Setup

Crea un endpoint de prueba:

```typescript
// app/api/test/route.ts
// ELIMINAR despues de verificar

import { google, MODELS } from '@/lib/ai/google'
import { generateText } from 'ai'

export async function GET() {
  try {
    const { text } = await generateText({
      model: google(MODELS.fast),
      prompt: 'Di "Setup OK" en una palabra',
    })

    return Response.json({ status: 'ok', response: text })
  } catch (error) {
    return Response.json({
      status: 'error',
      message: String(error)
    }, { status: 500 })
  }
}
```

Prueba en: `http://localhost:3000/api/test`

---

## Checklist

- [ ] Dependencias instaladas
- [ ] `.env.local` configurado con GOOGLE_AI_API_KEY
- [ ] `lib/ai/google.ts` creado
- [ ] (Opcional) Supabase clients creados
- [ ] Endpoint de prueba funciona

---

## Siguiente Bloque

Elige tu camino:

- **Chat tradicional**: Ve a `01-chat-streaming.md`
- **Agente transparente**: Ve a `01-alt-action-stream.md`
