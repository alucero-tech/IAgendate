# PRP-008: Migración Multi-Tenant SaaS + Suscripciones

> **Estado**: ✅ COMPLETADO
> **Fecha**: 2026-03-18 | **Completado**: 2026-03-19
> **Proyecto**: IAgendate Platform

---

## Objetivo

Transformar IAgendate de una aplicación single-tenant (Bella Donna) a una plataforma SaaS multi-tenant donde cualquier peluquería/salón puede registrarse, obtener su URL pública (`iagendate.com/su-salon`), gestionar su negocio de forma aislada y pagar una suscripción mensual.

## Por Qué

| Problema actual | Solución |
|-----------------|----------|
| El sistema está hardcodeado para Bella Donna | Cada negocio tiene su propio slug, datos aislados y configuración independiente |
| No hay forma de agregar un segundo cliente sin clonar el repo | Modelo multi-tenant: un codebase, N negocios |
| No hay modelo de negocio para IAgendate | Suscripción mensual por plan con Mercado Pago |
| 65 `revalidatePath('/bella-donna/...')` hardcodeados | Paths dinámicos parametrizados por slug |

**Valor de negocio**: De herramienta interna a producto SaaS vendible. MRR escalable sin costo marginal por cliente.

## Qué

### Criterios de Éxito
- [ ] Un nuevo negocio puede registrarse en `/registro` y tener su sistema activo en `/[slug]/reservar`
- [ ] Los datos de cada tenant son completamente aislados (RLS por tenant_id)
- [ ] Bella Donna sigue funcionando sin interrupción en `/bella-donna/`
- [ ] El middleware bloquea tenants suspendidos/vencidos antes de tocar la BD
- [ ] Un superadmin puede ver y gestionar todos los tenants desde `/superadmin`
- [ ] `npm run typecheck` y `npm run build` pasan sin errores

### Routing Multi-Tenant (Slug en Path)

```
RUTAS PÚBLICAS:
/[slug]/reservar          → Wizard de reserva del negocio
/[slug]/reagendar         → Reagendamiento
/[slug]/mi-turno          → Portal clienta
/[slug]                   → Landing del negocio

RUTAS ADMIN (protegidas):
/[slug]/admin/dashboard
/[slug]/admin/calendario
/[slug]/admin/turnos
/[slug]/admin/profesionales
/[slug]/admin/tratamientos
/[slug]/admin/bloqueos
/[slug]/admin/liquidaciones
/[slug]/admin/metricas
/[slug]/admin/configuracion

PLATAFORMA:
/registro                 → Onboarding nuevo negocio
/superadmin               → Panel IAgendate (solo superadmin)
/login                    → Login (global, luego redirige al slug correcto)
```

---

## Contexto

### Hallazgos del Análisis de Codebase

**Lo que YA es genérico (no cambia):**
- `src/lib/supabase/admin.ts` — cliente service role ✓
- `src/lib/supabase/server.ts` — cliente con cookies ✓
- `src/middleware.ts` — lógica de auth, solo cambia el matching de rutas
- `src/features/*/components/` — todos los componentes UI son reutilizables ✓
- `src/features/*/services/` — server actions son genéricos, solo cambia el revalidatePath

**Lo que necesita refactor:**
- 65 `revalidatePath('/bella-donna/...')` → `revalidatePath('/[slug]/admin/...')`
- `src/app/bella-donna/` → `src/app/[slug]/`
- `src/app/reservar/` → `src/app/[slug]/reservar/`
- `src/app/mi-turno/` → `src/app/[slug]/mi-turno/`
- `src/app/reagendar/` → `src/app/[slug]/reagendar/`

### Modelo de Datos

#### Nueva tabla `tenants`
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,           -- 'bella-donna', 'salon-xyz'
  name TEXT NOT NULL,                  -- 'Bella Donna'
  plan TEXT NOT NULL DEFAULT 'trial',  -- 'trial' | 'starter' | 'pro' | 'business'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended' | 'cancelled'
  plan_expires_at TIMESTAMPTZ,
  owner_email TEXT NOT NULL,
  mp_subscription_id TEXT,            -- ID suscripción Mercado Pago
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Agregar `tenant_id` a las 14 tablas existentes
```sql
-- Patrón para cada tabla:
ALTER TABLE professionals ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE categories ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE treatments ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE professional_treatments ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE bookings ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE booking_items ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE payments ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE clients ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE settlements ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE schedules ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE time_blocks ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE store_settings ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE push_subscriptions ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE webauthn_credentials ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Migrar datos de Bella Donna al primer tenant
UPDATE professionals SET tenant_id = '[bella-donna-tenant-uuid]';
-- ... idem para todas las tablas
```

#### RLS por Tenant (patrón para cada tabla)
```sql
-- Función helper que extrae tenant_id de la sesión del profesional
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM professionals WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Policy tipo en cada tabla:
CREATE POLICY "tenant_isolation" ON bookings
  USING (tenant_id = current_tenant_id() OR
         EXISTS (SELECT 1 FROM professionals WHERE user_id = auth.uid() AND is_superadmin = true));
```

### Planes y Suscripción (MVP simple)

```
trial    → 14 días, todas las features, hasta 2 profesionales
starter  → $X/mes, hasta 3 profesionales, sin IA
pro      → $Y/mes, hasta 8 profesionales, IA incluida
business → $Z/mes, ilimitado, white-label
```

El `status` en `tenants` es la única fuente de verdad. El middleware bloquea si `status !== 'active'`.

---

## Blueprint (Assembly Line)

### Fase 1: Base de Datos Multi-Tenant
**Objetivo**: Crear tabla `tenants`, agregar `tenant_id` a las 14 tablas, migrar datos de Bella Donna como primer tenant, actualizar RLS policies para filtrar por tenant.

**Validación**:
- [ ] Tabla `tenants` creada con Bella Donna como primer registro
- [ ] Todas las tablas tienen `tenant_id` con datos migrados
- [ ] RLS policies filtran por `current_tenant_id()`
- [ ] Bella Donna sigue funcionando (queries retornan los mismos datos)

### Fase 2: Middleware y Resolución de Tenant
**Objetivo**: El `middleware.ts` identifica el tenant desde el slug en la URL, verifica que exista y esté activo, y expone el `tenantId` como header para que las rutas lo consuman sin tocar la BD.

**Validación**:
- [ ] `/bella-donna/admin/dashboard` funciona (tenant resuelto)
- [ ] Slug inexistente → 404
- [ ] Tenant suspendido → página de cuenta suspendida
- [ ] El header `x-tenant-id` llega a los server components

### Fase 3: Routing Dinámico
**Objetivo**: Migrar `src/app/bella-donna/` → `src/app/[slug]/`, `src/app/reservar/` → `src/app/[slug]/reservar/`, etc. Los `params.slug` se usan para pasar contexto de tenant.

**Validación**:
- [ ] `/bella-donna/reservar` funciona igual que antes
- [ ] `/bella-donna/admin/calendario` funciona
- [ ] Los server components reciben el slug y lo usan para filtrar queries

### Fase 4: Server Actions Multi-Tenant
**Objetivo**: Los 65 `revalidatePath('/bella-donna/...')` se parametrizan usando el slug. Las server actions reciben `tenantId` implícito desde la sesión del profesional autenticado.

**Validación**:
- [ ] Crear reserva funciona y revalida el path correcto
- [ ] Cancelar turno funciona en ambos tenants si hay dos de prueba
- [ ] No hay cross-tenant data leaks

### Fase 5: Onboarding de Nuevos Negocios
**Objetivo**: La ruta `/registro` tiene un wizard de 4 pasos (datos negocio → slug → profesionales iniciales → plan) que crea el tenant, su primer owner, y configura los datos base.

**Validación**:
- [ ] Un negocio nuevo puede registrarse end-to-end
- [ ] Su URL `/[nuevo-slug]/reservar` está activa
- [ ] El owner puede loguearse y ver su admin

### Fase 6: Suscripciones con Mercado Pago
**Objetivo**: Integrar MP Suscripciones para cobro recurrente mensual. Al vencer, `tenant.status = 'suspended'`. El middleware lo bloquea. Al renovar, `status = 'active'` nuevamente.

**Validación**:
- [ ] Webhook de MP actualiza `plan_expires_at` y `status`
- [ ] Tenant suspendido ve página de renovación, no el admin
- [ ] Trial de 14 días funciona sin pago

### Fase 7: Superadmin Panel
**Objetivo**: Ruta `/superadmin` protegida por flag `is_superadmin` en `professionals`. Lista de todos los tenants con estado, plan, fecha de vencimiento y acciones (suspender, activar, extender).

**Validación**:
- [ ] Solo el superadmin puede acceder
- [ ] Se pueden ver y gestionar todos los tenants
- [ ] Suspender un tenant lo bloquea inmediatamente

### Fase 8: Validación Final
**Objetivo**: Sistema completo funcionando end-to-end con 2+ tenants en paralelo.

**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Bella Donna opera sin cambios
- [ ] Nuevo tenant registrado y operativo
- [ ] Aislamiento de datos verificado (tenant A no ve datos de tenant B)
- [ ] Suscripción y bloqueo por vencimiento funcionan

---

## Aprendizajes (Self-Annealing)

> Se actualiza durante la implementación.

---

## Gotchas

- [ ] **Bella Donna no puede romperse**: La migración de datos es en vivo. Siempre tener rollback script listo antes de cada migración.
- [ ] **65 revalidatePath**: No actualizar manualmente — usar script de reemplazo global con el slug dinámico.
- [ ] **admin client bypasa RLS**: El `createAdminClient()` ignora las policies. Hay que pasar `tenant_id` explícitamente en las queries del admin client o cambiar al `createClient()` con impersonation donde sea posible.
- [ ] **Mercado Pago Suscripciones**: Es una API diferente a los pagos únicos. Requiere pre-approval y plan creation separados.
- [ ] **`revalidatePath` con slug dinámico**: Necesita recibir el slug como parámetro desde el contexto del profesional logueado.
- [ ] **Cookies de auth cross-tenant**: El usuario logueado en bella-donna no debería poder acceder a otro slug. La verificación de `tenant_id` en `getCurrentProfessional()` es crítica.

## Anti-Patrones

- NO empezar con subdominios — slug en path primero, subdominio es una migración de routing posterior sin cambios de BD.
- NO construir billing complejo — `status` en `tenants` es suficiente para v1.
- NO migrar el routing antes de la BD — si la BD no está lista, el routing no puede resolver datos.
- NO confiar en que el código filtrará tenant_id — RLS es la única garantía real.
- NO crear un proyecto Supabase separado por tenant — un proyecto, aislamiento por RLS.
- NO romper el flujo del admin client — seguir usando service role donde se necesita (webhooks, push notifications), pero siempre con tenant_id explícito en las queries.

---

*PRP pendiente aprobación. No se ha modificado código.*
