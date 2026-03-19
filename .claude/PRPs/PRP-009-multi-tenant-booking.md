# PRP-009: Multi-Tenant Booking — Aislamiento de Datos por Tenant

> **Estado**: PENDIENTE
> **Fecha**: 2026-03-19
> **Proyecto**: IAgendate Platform

---

## Objetivo

Hacer que todo el flujo de reserva (wizard público, disponibilidad, creación, cancelación, reagendamiento) opere de forma completamente aislada por tenant, filtrando todas las queries de `catalog-actions.ts`, `availability-actions.ts` y `booking-crud-actions.ts` por `tenant_id` para que cada negocio solo vea y reciba sus propios datos.

## Por Qué

| Problema | Solución |
|----------|----------|
| `catalog-actions.ts` devuelve categorías/tratamientos/profesionales de TODOS los tenants | Filtrar por `tenant_id` deducido desde el `slug` de la URL |
| `availability-actions.ts` calcula slots con reservas de todos los negocios mezcladas | Acotar queries a profesionales del tenant actual |
| `booking-crud-actions.ts` crea reservas sin asociar al tenant | Insertar `tenant_id` en `bookings` y filtrar `store_settings` por tenant |
| El wizard de reserva (`/[slug]/reservar`) recibe datos sin scope de tenant | La `page.tsx` debe pasar el `slug` al wizard para que las actions filtren correctamente |
| Un nuevo negocio registrado podría ver datos de Bella Donna | Data isolation garantizada por `tenant_id` en cada query |

**Valor de negocio**: Sin este fix, la plataforma SaaS (PRP-008, ya completado) no es viable — los datos de un negocio son visibles para otro. Es el requisito de seguridad más crítico del sistema multi-tenant.

## Qué

### Criterios de Éxito
- [ ] Un tenant nuevo creado en `/registro` solo ve sus propias categorías/tratamientos/profesionales en `/[slug]/reservar`
- [ ] Bella Donna sigue funcionando sin interrupción: sus reservas no mezclan datos ajenos
- [ ] `createMultiBooking` inserta `tenant_id` en la tabla `bookings`
- [ ] `getAvailableSlots` solo considera reservas/bloqueos/horarios de profesionales del mismo tenant
- [ ] `getDepositPercentage`, `getTransferAlias`, `getStorePhone` leen `store_settings` filtrado por tenant
- [ ] `cancelBooking` y `rescheduleBooking` validan que el booking pertenece al tenant del actor
- [ ] `npm run typecheck` pasa sin errores
- [ ] `npm run build` exitoso

### Comportamiento Esperado (Happy Path)

1. Clienta accede a `/nuevo-salon/reservar`
2. El `page.tsx` extrae `params.slug`, resuelve el `tenant_id` y pasa ambos al `BookingWizard`
3. `getAllTreatmentsGrouped` filtra `categories` y `treatments` por `tenant_id`
4. `getProfessionalsForTreatment` filtra `professional_treatments` por profesionales del tenant
5. `getAvailableSlots` filtra `booking_items`, `bookings`, y `time_blocks` por profesionales del tenant
6. `createMultiBooking` inserta `tenant_id` en la fila de `bookings`
7. `getDepositPercentage` lee `store_settings` filtrando por `tenant_id`
8. La reserva queda aislada — el tenant Bella Donna no la ve ni la cuenta

---

## Contexto

### Referencias
- `src/lib/tenant.ts` — `getTenantId(slug)` resuelve UUID desde slug (con caché en memoria)
- `src/features/booking/services/catalog-actions.ts` — 5 funciones sin filtro tenant (punto de entrada)
- `src/features/booking/services/availability-actions.ts` — `getAvailableSlots`, `getAvailableDays`, `getMultiServiceSlots`, `getMultiServiceAvailableDays`
- `src/features/booking/services/booking-crud-actions.ts` — `createMultiBooking`, `cancelBooking`, `cancelBookingByClient`, `rescheduleBooking`, `getDepositPercentage`, `getTransferAlias`, `getStorePhone`
- `src/features/booking/components/booking-wizard.tsx` — Wizard cliente (actualmente no recibe slug)
- `src/app/[slug]/reservar/page.tsx` — Server page que hace el data-fetch inicial y renderiza el wizard
- `src/shared/schemas/zod-schemas.ts` — Fuente de verdad de schemas Zod

### Arquitectura Propuesta

No se crea ninguna feature nueva. Los cambios son exclusivamente en los servicios existentes del feature `booking` y en su `page.tsx`. El patrón es:

```
page.tsx (/[slug]/reservar)
  └── params.slug → getTenantId(slug) → tenantId: string
        └── pasado como prop al BookingWizard
              └── BookingWizard pasa tenantId a cada server action
                    └── cada action filtra queries con .eq('tenant_id', tenantId)
```

**Decisión de diseño: tenantId como parámetro explícito (no inferido)**

Las server actions reciben `tenantId` como parámetro en lugar de resolverlo internamente. Esto es más eficiente (el `page.tsx` resuelve una vez y lo pasa) y más explícito. Es el mismo patrón que ya usa `getTenantPath(slug, path)`.

**Impacto en la firma de funciones públicas:**
- `getPublicCategories(tenantId: string)`
- `getAllTreatmentsGrouped(tenantId: string)`
- `getTreatmentsByCategory(categoryId: string, tenantId: string)`
- `getProfessionalsForTreatment(treatmentId: string, tenantId: string)`
- `getAvailableSlots(professionalId, treatmentId, dateStr, tenantId)`
- `getAvailableDays(professionalId, tenantId)`
- `getMultiServiceAvailableDays(items, tenantId)`
- `getMultiServiceSlots(items, dateStr, tenantId)`
- `getDepositPercentage(tenantId: string)`
- `getTransferAlias(tenantId: string)`
- `getStorePhone(tenantId: string)`
- `createMultiBooking({ ...existingFields, tenantId })`
- `cancelBooking(bookingId, refund, tenantId)` — validación de ownership
- `rescheduleBooking(bookingId, newDate, newStartTime, tenantId)` — validación de ownership

**BookingWizard props nuevas:**
```tsx
<BookingWizard
  categories={categories}
  depositPercentage={depositPct}
  transferAlias={transferAlias}
  tenantId={tenantId}   // <-- nuevo
/>
```

### Modelo de Datos

No se crean tablas nuevas. Se agregan filtros `.eq('tenant_id', tenantId)` a queries existentes.

Columna `tenant_id` ya existe en:
- `professionals` (filtro para `getProfessionalsForTreatment`, `getAvailableDays`)
- `categories` (filtro para `getPublicCategories`, `getAllTreatmentsGrouped`)
- `store_settings` (filtro para `getDepositPercentage`, `getTransferAlias`, `getStorePhone`)
- `bookings` (insertar al crear, filtrar al cancelar/reagendar)
- `time_blocks` (filtrar en `getAvailableSlots` para bloqueos)

Verificar que `treatments` y `schedules` tengan `tenant_id` o se puedan filtrar transitivamente por `professional_id` / `category_id` que ya pertenecen al tenant.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar)

### Fase 1: Audit — Mapear columnas tenant_id en la BD
**Objetivo**: Verificar qué tablas tienen `tenant_id` nativo vs. cuáles se filtran transitivamente. Identificar cualquier columna faltante que requiera migración.
**Validación**: Listado confirmado de columnas disponibles por tabla para el filtro. Cero migraciones sorpresa durante la implementación.

### Fase 2: Catalog Actions — Filtro por tenant_id
**Objetivo**: Las 5 funciones de `catalog-actions.ts` reciben `tenantId` y filtran sus queries. `page.tsx` de reservar resuelve el tenantId y lo pasa como prop al wizard.
**Validación**: Acceder a `/bella-donna/reservar` y a un slug diferente — cada uno muestra solo sus tratamientos/profesionales. Typecheck pasa.

### Fase 3: Availability Actions — Filtro por tenant_id
**Objetivo**: `getAvailableSlots`, `getAvailableDays`, `getMultiServiceSlots`, `getMultiServiceAvailableDays` filtran por tenant. `BookingWizard` pasa `tenantId` en cada llamada.
**Validación**: La disponibilidad mostrada corresponde solo al tenant activo. No se mezclan slots de otros negocios.

### Fase 4: Booking CRUD Actions — Insertar y filtrar por tenant_id
**Objetivo**: `createMultiBooking` inserta `tenant_id`. `getDepositPercentage`, `getTransferAlias`, `getStorePhone` leen `store_settings` del tenant. `cancelBooking` y `rescheduleBooking` validan ownership del tenant.
**Validación**: Reserva creada tiene `tenant_id` correcto en la BD. `store_settings` retorna configuración del negocio correcto.

### Fase 5: Validación Final
**Objetivo**: Sistema funcionando end-to-end con aislamiento confirmado
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: reserva en `/bella-donna/reservar` solo muestra tratamientos de Bella Donna
- [ ] Playwright (si hay segundo tenant): reserva en `/[otro-slug]/reservar` muestra solo los del otro negocio
- [ ] Todos los criterios de éxito cumplidos

---

## Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.

---

## Gotchas

> Cosas críticas a tener en cuenta ANTES de implementar

- [ ] `treatments` y `schedules` pueden NO tener `tenant_id` — verificar en Fase 1 si el filtro debe ser transitivo (via `category_id` o `professional_id`)
- [ ] `booking_items` no tiene `tenant_id` — filtrar via JOIN con `bookings.tenant_id` en queries que los involucren
- [ ] `getAvailableSlots` hace dos queries separadas (booking_items + legacy bookings) — ambas deben filtrarse
- [ ] El `BookingWizard` llama server actions directamente desde el cliente — los parámetros `tenantId` deben propagarse correctamente en cada step del wizard
- [ ] `cancelBookingByClient` (llamada desde `/[slug]/mi-turno`) también necesita el slug — verificar su page.tsx
- [ ] El barrel `booking-actions.ts` re-exporta todo — al cambiar firmas, solo cambia los archivos fuente (el barrel no se toca si no cambia)
- [ ] `RLS` en Supabase es el firewall real. Los filtros en server actions son la segunda capa. Verificar que RLS tenga policies por `tenant_id` en tablas críticas.

## Anti-Patrones

- NO inferir `tenant_id` dentro de cada action (evitar múltiples queries a `tenants` table por request)
- NO usar `getCurrentTenantSlug()` en acciones públicas — ese helper usa la sesión auth, que no existe para clientas sin login
- NO omitir validación Zod al agregar `tenantId` a los schemas existentes
- NO hardcodear el slug 'bella-donna' como fallback en acciones del wizard público

---

*PRP pendiente aprobación. No se ha modificado código.*
