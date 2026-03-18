# IAgendate - Sistema de Reservas para Bella Donna

> **Proyecto:** Sistema de reservas online + PWA para peluquería "Bella Donna"
> **Stack:** Next.js 16 + React 19 + Supabase + Tailwind/shadcn + Mercado Pago
> **Estado:** Producción (deploy en Vercel, auto-deploy en push a master)

---

## Filosofia: Agent-First

El usuario habla en lenguaje natural. Tu traduces a codigo.

**NUNCA** le digas al usuario que ejecute un comando.
**NUNCA** le pidas que edite un archivo.
**NUNCA** le muestres paths internos.
Tu haces TODO. El solo aprueba.

---

## Contexto de Negocio

Peluquería con 6 profesionales. Las clientas reservan sin registrarse (nombre + celular), eligen especialidad → tratamiento → día → horario, pagan 50% de seña (Mercado Pago o transferencia). Cada profesional ve solo su calendario. La dueña administra todo, configura comisiones, aprueba bloqueos y gestiona liquidaciones semanales.

**3 roles:** Clienta (sin login), Profesional (login), Dueña/Admin (login)

Ver `BUSINESS_LOGIC.md` para reglas de negocio completas, flujos y modelo de datos.

---

## Stack Técnico

| Capa | Tecnología | Version |
|------|------------|---------|
| Framework | Next.js (App Router + Turbopack) | 16.0.0 |
| UI | React + TypeScript | 19.0.0 / 5.7.0 |
| Estilos | Tailwind CSS + shadcn/ui (New York, RSC) | 3.4.0 |
| Backend | Supabase (Auth + PostgreSQL + RLS) | 2.49.0 |
| Pagos | Mercado Pago SDK | 2.12.0 |
| AI | Vercel AI SDK v6 + Google Gemini | 6.0.116 |
| Validación | Zod | 4.3.6 |
| Estado | Zustand (disponible, server actions como patrón principal) | 5.0.12 |
| Formularios | React Hook Form + @hookform/resolvers | 7.71.2 |
| Auth extra | WebAuthn (@simplewebauthn) para login biométrico |
| Notificaciones | Web Push (web-push) |
| Excel | xlsx para importación/exportación |
| PWA | Service Worker manual (public/sw.js) + manifest.json |
| Testing | Playwright CLI + MCP |

---

## Arquitectura Feature-First

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/login/            # Login profesionales
│   ├── reservar/                # Wizard de reserva (público)
│   ├── reagendar/               # Reagendamiento (público)
│   ├── mi-turno/                # Portal clienta (público)
│   ├── bella-donna/             # Landing negocio (público)
│   │   └── (admin)/             # Rutas protegidas (requieren login)
│   │       ├── dashboard/
│   │       ├── calendario/      # Día/Semana/Mes tipo Google Calendar
│   │       ├── turnos/
│   │       ├── profesionales/
│   │       ├── tratamientos/
│   │       ├── bloqueos/
│   │       ├── liquidaciones/
│   │       ├── metricas/
│   │       └── configuracion/
│   ├── api/                     # Route handlers
│   │   ├── auth/                # Login + WebAuthn
│   │   ├── chat/                # AI (advisor, booking, metrics)
│   │   ├── mercadopago/         # Pago + webhook
│   │   ├── push/                # Push notifications
│   │   └── excel/               # Template Excel
│   └── layout.tsx               # Root layout (metadata, SW, toaster)
│
├── features/                     # 14 features por dominio
│   ├── ai-assistant/            # Chat IA (tools: booking, metrics, treatments)
│   ├── auth/                    # Login (WebAuthn + password)
│   ├── booking/                 # Reservas multi-servicio (modular, 5 services + barrel)
│   ├── calendar/                # Vistas día/semana/mes
│   ├── dashboard/               # Dashboard admin
│   ├── excel/                   # Import/export Excel
│   ├── metrics/                 # Analytics y rendimiento
│   ├── notifications/           # Push notifications
│   ├── portal/                  # Portal clienta (/mi-turno)
│   ├── professionals/           # Gestión profesionales
│   ├── settings/                # Configuración negocio
│   └── treatments/              # Categorías y tratamientos
│   # Cada feature: components/ + services/ + hooks/ + types/ + store/
│
├── shared/                       # Código reutilizable
│   ├── components/              # biometric-setup, contact-buttons, install-banner,
│   │                            # push-auto-register, role-gate, sidebar
│   ├── schemas/                 # zod-schemas.ts (fuente de verdad para validación)
│   ├── hooks/                   # use-push-subscription
│   └── types/                   # roles.ts
│
├── components/ui/                # 18 componentes shadcn/ui
│
├── lib/                          # Configuración de servicios
│   ├── supabase/                # admin.ts (service role), server.ts, client.ts
│   ├── ai/google.ts             # Google Gemini client
│   ├── mercadopago.ts           # MP SDK
│   ├── web-push.ts              # Push config
│   └── utils.ts                 # cn() y helpers
│
└── hooks/use-toast.ts            # Toast notifications (shadcn)
```

---

## Patrones de Código

### Data Fetching: Server Actions
Toda la lógica de negocio vive en `features/*/services/*-actions.ts` con `'use server'`.
NO hay REST APIs para datos (solo webhooks: Mercado Pago, push). Usan `revalidatePath()` para invalidación.

### Supabase Clients
- `lib/supabase/admin.ts` — Service role (bypass RLS, solo server-side)
- `lib/supabase/server.ts` — Con cookies del usuario (respeta RLS)
- `lib/supabase/client.ts` — Browser client

### Base de Datos
14 tablas en Supabase, todas con RLS habilitado. Ver `BUSINESS_LOGIC.md` sección 4 para schema completo.
Tablas principales: `professionals`, `categories`, `treatments`, `professional_treatments`, `bookings`, `booking_items`, `payments`, `clients`, `settlements`, `schedules`, `time_blocks`, `store_settings`, `push_subscriptions`, `webauthn_credentials`.

### Booking: Arquitectura Modular (5 servicios + barrel)
`booking-actions.ts` es un barrel que re-exporta todo. Los imports externos no cambian.
- `catalog-actions.ts` — Queries de categorías, tratamientos, profesionales (5 funciones)
- `availability-actions.ts` — Cálculo de slots y días disponibles (4 funciones)
- `booking-crud-actions.ts` — Crear, cancelar, reagendar, consultar reservas (7 funciones)
- `turn-flow-actions.ts` — Llegada, addons, finalización, no-show (9 funciones)
- `transfer-payment-actions.ts` — Pagos, reembolsos, transferencias entre profesionales (5 funciones)
- `booking-helpers.ts` — Tipos compartidos (`CartItem`) y utilidades (`calcDepositAmount`)

### Validación: Zod Centralizado
Todos los schemas de validación viven en `shared/schemas/zod-schemas.ts`. Es la fuente de verdad única.
- **Primitivos reutilizables:** `uuidSchema`, `bookingIdSchema`, `professionalIdSchema`, `dateSchema`, `timeSchema`, `phoneSchema`
- **Compuestos:** `dateRangeSchema`, `paginationSchema`
- **Por dominio:** schemas para booking, turn-flow, transfer, metrics, settings, professionals, time-blocks
- **API routes:** schemas para login, WebAuthn, MercadoPago, push subscriptions
- **Patrón:** toda server action y API route usa `safeParse()` en las primeras líneas. Si falla, retorna error descriptivo sin tocar la DB.
- **Cobertura:** ~85% de funciones con mutación validadas. Funciones sin params y read-only queries no requieren validación.
- **Al crear nuevas funciones:** importar desde `@/shared/schemas/zod-schemas` y agregar el schema ahí si no existe.

### UI: Feature-First Estricto
`src/app/` contiene SOLO archivos de Next.js: `page.tsx` (server components), `layout.tsx`, `error.tsx`, `loading.tsx`.
Toda la lógica de UI client-side vive en `features/*/components/`. Los page.tsx hacen data fetching y pasan props al componente client.
- **NO** crear componentes `*-client.tsx` dentro de `src/app/`. Van en `features/[dominio]/components/`.
- Cada ruta crítica tiene `error.tsx` (7 rutas) y las principales tienen `loading.tsx` (3 rutas).

### Design System: Gradient Mesh (Bella Donna)
Colores custom en `tailwind.config.ts`:
- `bella-rose` (rosa, primario)
- `bella-violet` (violeta, secundario)
- `bella-gold` (dorado, acento)

---

## Decision Tree: Qué Hacer con Cada Request

```
Usuario dice algo
    |
    ├── Feature compleja (DB + UI + API)
    |       → PRP → usuario aprueba → BUCLE-AGENTICO
    |
    ├── Tarea rápida (1-3 archivos)
    |       → SPRINT (ejecutar directo)
    |
    ├── Agregar IA / chat / visión
    |       → Skill AI con template apropiado
    |
    ├── Auditar/blindar validaciones
    |       → Skill SHIELD (escaneo Zod)
    |
    ├── Testear / revisar bug
    |       → Skill QA (Playwright CLI)
    |
    ├── Deploy / publicar
    |       → VERCEL-DEPLOYER
    |
    ├── Explicar código
    |       → CODEBASE-ANALYST
    |
    └── No encaja → frontend/backend/supabase-admin/documentacion según corresponda
```

---

## Skills Disponibles

### Invocados por el usuario (o sugeridos)

| Skill | Cuando |
|-------|--------|
| `primer` | Inicio de conversación, cargar contexto |
| `bucle-agentico` | Features complejas multi-fase |
| `sprint` | Tareas rápidas sin planificación |
| `prp` | Planificar feature compleja (antes de bucle-agentico) |
| `ai` | Capacidades IA: chat, RAG, vision, tools |
| `playwright-cli` | QA automatizado |
| `landing` | Landing pages |
| `add-login` | Auth (ya implementado en este proyecto) |
| `skill-creator` | Crear nuevos skills |
| `shield` | Auditar validación Zod en actions y API routes |

### Activados automáticamente

| Skill | Se activa cuando... |
|-------|---------------------|
| `backend` | Server Actions, APIs, validaciones Zod |
| `frontend` | UI/UX, componentes React, Tailwind |
| `supabase-admin` | Migraciones, RLS, queries SQL |
| `codebase-analyst` | Entender patrones y arquitectura |
| `vercel-deployer` | Deploy, env vars, dominios |
| `documentacion` | Actualizar docs tras cambios |
| `calidad` | Testing, validación, quality gates |

---

## MCPs

### Next.js DevTools MCP
Conectado via `/_next/mcp`. Errores build/runtime en tiempo real.

### Playwright (QA)
**CLI** (preferido):
```bash
npx playwright navigate http://localhost:3000
npx playwright screenshot http://localhost:3000 --output screenshot.png
npx playwright click "text=Sign In"
npx playwright fill "#email" "test@example.com"
```
**MCP** para exploración UI.

### Supabase MCP
```
execute_sql, apply_migration, list_tables, get_advisors
```

---

## Reglas de Código

- **KISS / YAGNI / DRY**
- Archivos max 500 líneas, funciones max 50 líneas
- Variables/Functions: `camelCase`, Components: `PascalCase`, Files: `kebab-case`
- NUNCA usar `any` (usar `unknown`)
- SIEMPRE validar entradas con Zod usando schemas de `shared/schemas/zod-schemas.ts`
- SIEMPRE habilitar RLS en tablas Supabase
- NUNCA exponer secrets en código
- Server Actions como patrón principal de data fetching
- shadcn/ui para componentes base, extender con los colores Bella Donna

---

## Comandos npm

```bash
npm run dev          # Servidor con Turbopack (auto-detecta puerto 3000-3006)
npm run build        # Build producción
npm run typecheck    # Verificar tipos (tsc --noEmit)
npm run lint         # ESLint
npm run start        # Servidor producción
```

---

## Estructura de la Fábrica (.claude/)

```
.claude/
├── skills/                    # 20 skills
│   ├── new-app/              # Entrevista de negocio
│   ├── landing/              # Landing pages
│   ├── primer/               # Context initialization
│   ├── add-login/            # Auth completo
│   ├── eject-sf/             # Remover SF
│   ├── update-sf/            # Actualizar SF
│   ├── bucle-agentico/       # Bucle Agentico BLUEPRINT
│   ├── sprint/               # Bucle Agentico SPRINT
│   ├── prp/                  # Generar PRPs
│   ├── ai/                   # AI Templates hub
│   ├── qa/                   # Playwright CLI QA
│   ├── skill-creator/        # Crear nuevos skills
│   ├── shield/               # Auditoría Zod en actions
│   ├── backend/              # Agent: backend
│   ├── frontend/             # Agent: frontend
│   ├── supabase-admin/       # Agent: Supabase
│   ├── codebase-analyst/     # Agent: análisis
│   ├── vercel-deployer/      # Agent: deploy
│   ├── documentacion/        # Agent: docs
│   └── calidad/              # Agent: testing
├── PRPs/                      # Product Requirements Proposals
└── design-systems/            # 5 design systems (activo: gradient-mesh)
```

---

## Aprendizajes (Auto-Blindaje Activo)

### 2025-01-09: Usar npm run dev, no next dev
- **Error**: Puerto hardcodeado causa conflictos
- **Fix**: Siempre usar `npm run dev` (auto-detecta puerto)

### 2026-03-17: Queries con limit necesitan orden y filtro adecuados
- **Error**: Turnos page traía los 100 bookings más viejos (ASC + limit 100), omitiendo los recientes
- **Fix**: Filtrar por rango de fecha reciente + status relevantes + orden DESC + limit mayor
- **Aplicar en**: Cualquier query con limit() sobre tablas con muchos registros históricos

### 2026-03-17: Componentes client fuera de features/
- **Error**: 8 archivos `*-client.tsx` vivían en `src/app/` junto a los page.tsx
- **Fix**: Migrados a `features/[dominio]/components/`. Los page.tsx solo importan con `@/features/...`
- **Regla**: NUNCA crear componentes client en `src/app/`. Van en `features/`.

### 2026-03-17: Validación Zod centralizada
- **Error**: Solo 14% de server actions validaban inputs. Schemas inline duplicados.
- **Fix**: `shared/schemas/zod-schemas.ts` como fuente de verdad. Cobertura ~85%.
- **Patrón**: `const parsed = schema.safeParse(input); if (!parsed.success) return { error: ... }`
- **Regla**: Toda nueva server action o API route DEBE importar schemas de `zod-schemas.ts`.

---

*IAgendate — Agent-First. El usuario habla, tú construyes.*
