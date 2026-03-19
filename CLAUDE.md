# IAgendate — SaaS Multi-Tenant de Reservas para Salones de Belleza

> **Proyecto:** SaaS B2B multi-tenant. Cada salón (tenant) tiene su sistema de reservas online + PWA.
> **Stack:** Next.js 16 + React 19 + Supabase + Tailwind/shadcn + Mercado Pago
> **URL producción:** https://iagendate.vercel.app (auto-deploy en push a master)
> **Tenant demo:** bella-donna (slug: `bella-donna`)

---

## Filosofia: Agent-First

El usuario habla en lenguaje natural. Tu traduces a codigo.

**NUNCA** le digas al usuario que ejecute un comando.
**NUNCA** le pidas que edite un archivo.
**NUNCA** le muestres paths internos.
Tu haces TODO. El solo aprueba.

---

## Arquitectura de Usuarios (CRÍTICO — leer antes de implementar cualquier feature)

IAgendate tiene **dos tipos de usuario con objetivos radicalmente distintos**. Antes de tocar cualquier componente, identificá a cuál sirve.

### Usuario B2B — Tenant Admin (Dueña/Admin del salón)
- **Quién es:** La dueña del salón que paga la suscripción a IAgendate.
- **Qué busca:** Control, automatización, prestigio. Quiere configurar su negocio y ver métricas.
- **Rutas:** `/registro`, `/login`, `/[slug]/admin/*`
- **Prioridad de UX:** Conversión, claridad, sensación de poder.
- **Branding que ve:** Identidad de IAgendate (Dark Tech: `#030711` + azul eléctrico) durante adquisición (`/registro`). Sus propios colores de marca una vez dentro del admin.
- **Time-to-Value objetivo:** ≤ 60 segundos desde "Crear mi sala" hasta ver su dashboard operativo.

### Usuario B2C — End-User (Clienta del salón)
- **Quién es:** La clienta que va a cortarse el pelo. No tiene cuenta en IAgendate.
- **Qué busca:** Velocidad, simplicidad, claridad. Solo quiere reservar en 3 clics.
- **Rutas:** `/[slug]/reservar`, `/[slug]/mi-turno`, `/[slug]/reagendar`
- **Prioridad de UX:** Velocidad de flujo, confianza, feedback claro de confirmación.
- **Branding que ve:** Los colores que eligió la dueña del salón (CSS vars dinámicas vía `[slug]/layout.tsx`).
- **Regla de oro:** No requiere registro. Nombre + celular es suficiente.

### Pregunta de control antes de implementar
> "¿Esta funcionalidad beneficia al Tenant Admin (configura/administra) o al End-User (reserva/consulta)?"
> Si no podés responder esto, pedí más contexto antes de escribir código.

---

## Contexto de Negocio

Plataforma SaaS donde cada tenant es un salón de belleza. El tenant demo es "Bella Donna" (6 profesionales). Las clientas reservan sin registrarse (nombre + celular), eligen especialidad → tratamiento → día → horario, pagan 50% de seña (Mercado Pago o transferencia). Cada profesional ve solo su calendario. La dueña administra todo, configura comisiones, aprueba bloqueos y gestiona liquidaciones semanales.

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

### Base de Datos — Multi-Tenant (100% aislada por tenant_id)
14 tablas en Supabase, todas con RLS habilitado. **Todas las tablas tienen `tenant_id`** — el aislamiento es por código, no solo por RLS.
Tablas principales: `professionals`, `categories`, `treatments`, `professional_treatments`, `bookings`, `booking_items`, `payments`, `clients`, `settlements`, `schedules`, `time_blocks`, `store_settings`, `push_subscriptions`, `webauthn_credentials`.

**Regla de aislamiento**: Toda query en server actions públicas (catálogo, disponibilidad, booking) DEBE incluir `.eq('tenant_id', tenantId)`. El `tenantId` se resuelve una sola vez en `page.tsx` via `getTenantId(slug)` y se pasa explícitamente en cascada. NUNCA usar `getCurrentTenantSlug()` en acciones públicas (requiere sesión auth).

### Booking: Arquitectura Modular (5 servicios + barrel)
`booking-actions.ts` es un barrel que re-exporta todo. Los imports externos no cambian.
- `catalog-actions.ts` — Queries de categorías, tratamientos, profesionales (5 funciones) — **todas requieren `tenantId`**
- `availability-actions.ts` — Cálculo de slots y días disponibles (4 funciones) — `getMultiServiceAvailableDays(items, tenantId)` y `getMultiServiceSlots(items, date, tenantId)` requieren `tenantId`
- `booking-crud-actions.ts` — Crear, cancelar, reagendar, consultar reservas (7 funciones) — `createMultiBooking` requiere `tenantId` + `slug`; `getDepositPercentage`, `getStorePhone`, `getTransferAlias` requieren `tenantId`
- `turn-flow-actions.ts` — Llegada, addons, finalización, no-show (9 funciones)
- `transfer-payment-actions.ts` — Pagos, reembolsos, transferencias entre profesionales (5 funciones)
- `booking-helpers.ts` — Tipos compartidos (`CartItem`) y utilidades (`calcDepositAmount`)

**Patrón de propagación**: `[slug]/reservar/page.tsx` → `getTenantId(slug)` → pasa a `BookingWizard` como prop → el wizard lo pasa a cada action call.

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

### Design System: Dos capas de branding

**Capa 1 — Plataforma IAgendate (Dark Tech)**
Rutas: `/`, `/registro`, `/login`, `/superadmin/*`
Paleta fija: fondo `#030711`, acentos `blue-500`/`cyan-500`, texto `slate-50`/`slate-400`.
NUNCA usar bella-rose en estas rutas. Son la cara de IAgendate, no del salón.

**Capa 2 — Tenant (Branding Dinámico)**
Rutas: `/[slug]/*` (reservar, admin, mi-turno, reagendar)
`[slug]/layout.tsx` inyecta CSS vars: `--brand-primary` y `--brand-accent` desde `store_settings`.
Tailwind tokens disponibles: `bg-brand-primary`, `text-brand-primary`, `bg-brand-accent`.
Default bella-donna: `--brand-primary: #ec4899` (rosa) y `--brand-accent: #8b5cf6` (violeta).
La dueña configura sus colores en `/admin/configuracion` → sección "Identidad visual".

**Colores custom en `tailwind.config.ts`:**
- `bella-rose` (rosa, primario de tenant por defecto)
- `bella-violet` (violeta, secundario de tenant por defecto)
- `bella-gold` (dorado, acento)
- `brand.primary` / `brand.accent` (CSS vars dinámicas — usar en componentes de tenant)

### Matriz de Branding (referencia rápida)
| Ruta | Tipo | Branding |
|---|---|---|
| `/` | Plataforma | Dark Tech fijo |
| `/registro`, `/login` | Plataforma | Dark Tech fijo |
| `/superadmin/*` | Plataforma | Dark Tech fijo |
| `/[slug]/reservar` | Tenant | CSS vars dinámicas |
| `/[slug]/admin/*` | Tenant | CSS vars dinámicas |
| `/[slug]/mi-turno` | Tenant | CSS vars dinámicas |
| `/[slug]/reagendar` | Tenant | CSS vars dinámicas |

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

### 2026-03-19: Landing de plataforma vs landing de tenant
- **Decisión**: `src/app/page.tsx` es la landing de IAgendate (B2B). NO es la landing del salón.
- **Fix**: Reemplazado de página dinámica con DB calls a página estática con Dark Tech.
- **Regla**: `src/app/page.tsx` NUNCA llama a `getStoreBranding()` ni a ninguna función de tenant.

### 2026-03-19: Branding dinámico por tenant — arquitectura
- **Implementado**: `[slug]/layout.tsx` inyecta `--brand-primary` y `--brand-accent` server-side.
- **Sin FOUC**: Las CSS vars llegan en el HTML inicial, no via JS. Verificado con HTTP response body.
- **Colores en DB**: `store_settings` (key-value con `tenant_id`) almacena `primary_color` y `accent_color`.
- **Validación**: `hexColorSchema` y `brandColorsSchema` en `zod-schemas.ts` blindan el input.
- **Regla**: Componentes en rutas tenant PUEDEN usar `bg-brand-primary` / `text-brand-accent`. Componentes en rutas de plataforma NO DEBEN usarlos (usan blue-500/slate-*).

### 2026-03-19: Consistencia visual plataforma
- **Decisión**: `/registro` y `/login` son rutas de plataforma (adquisición B2B). Usan Dark Tech.
- **Razón**: El dueño del salón aún "está en casa de IAgendate". Sus colores aparecen después del onboarding.
- **Regla**: NUNCA usar `mesh-gradient-bg` o `bella-rose` en rutas de plataforma (`/registro`, `/login`, `/superadmin`).

### 2026-03-19: Loading state narrativo en onboarding
- **Implementado**: `CreationLoader` en `tenant-registration-form.tsx` muestra 3 pasos progresivos.
- **Patrón**: Para operaciones multi-step > 2 segundos, mostrar progress steps con íconos y estado visual.
- **Razón**: Transforma latencia técnica en narrativa de creación. Reduce abandono percibido.

### 2026-03-19: Multi-tenant booking — aislamiento completo (PRP-009)
- **Implementado**: Todas las server actions públicas de catálogo, disponibilidad y booking filtran por `tenant_id`.
- **Patrón**: `page.tsx` resuelve `tenantId = await getTenantId(slug)` una vez. Lo pasa en cascada como prop/parámetro explícito. NUNCA lo resuelve internamente en las actions públicas.
- **`replace_all: true` peligroso**: Al reemplazar URLs hardcodeadas globalmente, verificar que el binding de `slug` exista en TODOS los contextos donde aparece. En funciones sin `slug` en scope, el error es silencioso en runtime pero falla en typecheck.
- **`.maybeSingle()` vs `.single()`**: Usar `.maybeSingle()` en queries que pueden no devolver fila (settings key-value, cliente por teléfono). `.single()` solo cuando la fila SIEMPRE existe.
- **`getStoreName(tenantId?)`**: Hecha opcional para mantener compatibilidad con rutas de plataforma (login) que no tienen contexto de tenant.

---

*IAgendate — Agent-First. El usuario habla, tú construyes.*
