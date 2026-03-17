# BUSINESS_LOGIC.md - IAgendate

> Generado por SaaS Factory | Fecha: 2026-03-16

## 1. Problema de Negocio

**Dolor:** La peluquería "Bella Donna" tiene 6 profesionales y usa Wonoma (agenda electrónica) para gestionar turnos. El sistema actual muestra turnos como "no disponibles" cuando sí los hay, lo que causa que más del 50% de las clientas potenciales no puedan reservar. Además, Wonoma expone datos de medios de pago de las profesionales cuando la dueña explícitamente no quiere que esa información sea visible. El registro obligatorio también era una barrera que ya eliminaron.

**Costo actual:** Con un ticket promedio de $25.000 ARS, 6 profesionales y una pérdida del 50%+ de reservas potenciales, el costo es significativo en ingresos perdidos semanalmente. Además, la falta de privacidad en datos de pago genera desconfianza.

## 2. Solución

**Propuesta de valor:** Un sistema de reservas online + PWA (instalable en cualquier celular, incluso viejitos) donde las clientas eligen especialidad, tratamiento, día y horario disponible, pagan el 50% de seña por Mercado Pago o transferencia bancaria, y cada profesional ve solo SU calendario. La dueña administra todo. Incluye sistema de liquidación de comisiones y métricas de rendimiento.

**Flujo principal - Clienta (Happy Path):**
1. Entra a la web/app → selecciona especialidad (categoría)
2. Selecciona tratamiento específico dentro de la especialidad
3. Ve turnos disponibles por día (hasta 2 semanas adelante, estilo Google Calendar)
4. Elige día y horario libre
5. Ingresa datos: nombre y apellido (obligatorio), celular (obligatorio), email (opcional)
6. Paga 50% de seña vía Mercado Pago (automático) o transferencia bancaria (confirmación manual por la dueña)
7. Turno confirmado una vez verificado el pago
8. Puede reagendar 1 vez sin costo. Segunda vez → pierde la reserva

**Flujo - Profesional:**
1. Ve su calendario personal con todos sus turnos
2. Puede solicitar bloqueo de horarios (requiere aprobación de la dueña)
3. Puede reagendar turno de una clienta (con consentimiento de la clienta)
4. Ve su recaudación personal y liquidación semanal
5. Confirma conformidad del pago semanal

**Flujo - Dueña (Admin):**
1. Configura cada profesional: qué tratamientos hace, duración y precio
2. Configura horarios del local y horarios individuales por profesional
3. Ve calendario global de todas las profesionales
4. Aprueba/rechaza solicitudes de bloqueo de horarios
5. Confirma pagos por transferencia bancaria
6. Puede reagendar o cancelar turnos (cancelación con devolución de dinero)
7. Configura porcentaje de comisión por profesional (ej: 70% profesional / 30% dueña)
8. Ve métricas: recaudación por profesional, por producto/subproducto, semanal, mensual, trimestral y anual
9. Workflow de liquidación semanal con conformidad de ambas partes

## 3. Usuarios Objetivo

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| **Clienta** | Persona que quiere reservar un turno. No necesita registrarse. Se identifica por celular | Público (sin login) |
| **Profesional** | Empleada de la peluquería. Tiene su calendario, ve su recaudación | Login con cuenta |
| **Dueña (Admin)** | Administradora total. Configura todo, ve métricas globales, aprueba bloqueos, gestiona pagos | Login con cuenta admin |

## 4. Arquitectura de Datos

**Input:**
- Datos de clienta: nombre, apellido, celular, email (opcional)
- Selección de especialidad + tratamiento + día + horario
- Pago de seña (50%) vía Mercado Pago o transferencia
- Configuración de profesionales, tratamientos, horarios, comisiones (por la dueña)
- Solicitudes de bloqueo de horarios (por profesionales)

**Output:**
- Calendario por profesional (vista individual)
- Calendario global (vista admin)
- Confirmación de turno (a la clienta)
- Notificaciones de reagendamiento/cancelación
- Dashboard de métricas: recaudación por profesional, por tratamiento, semanal/mensual/trimestral/anual
- Liquidación semanal con workflow de conformidad

**Storage (Supabase tables — 14 tablas, todas con RLS):**
- `professionals`: id, user_id, first_name, last_name, email, phone, commission_percentage, is_owner, role (professional/manager/owner), active
- `schedules`: id, professional_id, day_of_week, start_time, end_time
- `categories`: id, name (unique), description, active, display_order
- `treatments`: id, category_id (NOT NULL), name, description, ai_context, duration_minutes, price (CHECK > 0), active
- `professional_treatments`: id, professional_id, treatment_id
- `time_blocks`: id, professional_id, block_date, start_time, end_time, status (pending/approved/rejected), reason, approved_by
- `clients`: id, first_name, last_name, phone (unique), email, created_at
- `bookings`: id, client_id, booking_date, start_time, end_time, status (pending_payment/confirmed/rescheduled/cancelled/in_progress/completed/no_show), reschedule_count, amount_total, amount_paid, final_payment_method, final_amount
- `booking_items`: id, booking_id, treatment_id, professional_id, start_time, end_time, price, deposit_amount, is_addon, addon_status, referred_by, transfer_status, original_professional_id
- `payments`: id, booking_id, amount, method (mercadopago/transfer), status (pending/confirmed/refunded), external_reference, confirmed_by, confirmed_at, refund_type, refunded_by
- `settlements`: id, professional_id, week_start, week_end, total_revenue, professional_share, owner_share, professional_confirmed, owner_confirmed, status (pending/confirmed/paid)
- `store_settings`: id, key, value (jsonb), updated_at
- `push_subscriptions`: id, endpoint, p256dh, auth, client_id, professional_id, created_at
- `webauthn_credentials`: id, professional_id, credential_id, public_key, counter, device_name, created_at

## 5. KPIs de Éxito

- **Recuperar el 50%+ de reservas** que hoy se pierden por fallos de disponibilidad
- **100% de reservas con seña pagada** antes de confirmar
- **Visibilidad de rendimiento** por profesional y por tratamiento para tomar mejores decisiones de negocio
- **Privacidad total** de datos de pago entre profesionales

## 6. Reglas de Negocio Críticas

1. **Disponibilidad:** Si un horario está tomado por una profesional, NO se muestra como disponible. Solo espacios libres.
2. **Duración de turnos:** Desde 15 minutos hasta varias horas, según el tratamiento.
3. **Ventana de reserva:** Hasta 2 semanas adelante.
4. **Seña:** 50% del precio total del tratamiento.
5. **Métodos de pago:** Mercado Pago (confirmación automática) o transferencia bancaria (confirmación manual por la dueña).
6. **Reagendamiento clienta:** 1 vez gratis. Segunda vez → pierde la reserva y la seña.
7. **Reagendamiento profesional/dueña:** Con consentimiento de la clienta.
8. **Cancelación por la peluquería:** Con devolución del dinero.
9. **Bloqueo de horarios:** Profesional solicita → dueña aprueba/rechaza.
10. **Comisiones:** Configurable por profesional (ej: 70/30). Liquidación semanal con doble conformidad.
11. **Sin registro obligatorio:** Clienta reserva con nombre + celular. Datos se guardan para futuras visitas.
12. **Horarios flexibles:** Cada profesional puede tener horarios diferentes. Estilo Google Calendar.

## 7. Especificación Técnica (Para el Agente)

### Features Implementadas (Feature-First)
```
src/features/
├── ai-assistant/        # Chat IA advisor, booking assistant, métricas
├── auth/                # Login profesionales y dueña (WebAuthn + password)
├── booking/             # Sistema de reservas multi-servicio (flujo clienta + pagos MP)
├── calendar/            # Calendario día/semana/mes tipo Google Calendar
├── dashboard/           # Dashboard principal (stats, próximo turno, widgets)
├── excel/               # Exportación de datos y templates Excel
├── metrics/             # Dashboard de métricas y rendimiento
├── notifications/       # Push notifications en cambios de estado
├── portal/              # Portal clienta (/mi-turno, consulta por celular)
├── professionals/       # Gestión de profesionales, horarios, comisiones
├── settings/            # Configuración del negocio (solo dueña)
└── treatments/          # Gestión de categorías y tratamientos
```

> Nota: Pagos (Mercado Pago + transferencias), liquidaciones y bloqueos de horarios
> están integrados dentro de booking/, calendar/ y las rutas admin respectivas.

### Stack Confirmado
- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind 3.4 + shadcn/ui
- **Backend:** Supabase (Auth + Database + Storage)
- **Pagos:** Mercado Pago SDK (checkout pro para seña 50%)
- **Validación:** Zod
- **State:** Zustand
- **PWA:** Service Worker manual (public/sw.js) + Web Push + manifest.json
- **MCPs:** Next.js DevTools + Playwright + Supabase

### Estructura de Rutas (actualizado 2026-03-17)

**Rutas Públicas (sin login):**
- `/` — Home page (hero + CTA)
- `/bella-donna` — Landing del negocio (tratamientos, precios, info, contacto)
- `/reservar` — Wizard de reserva de turnos
- `/reservar/resultado` — Resultado del pago
- `/mi-turno` — Portal clienta (consultar turno por celular)
- `/reagendar` — Reagendamiento de turno
- `/login` — Login profesionales (WebAuthn + contraseña)

**Rutas Protegidas (requieren login, bajo `/bella-donna/`):**
- `/bella-donna/dashboard` — Dashboard principal (stats, próximo turno)
- `/bella-donna/calendario` — Calendario día/semana/mes tipo Google Calendar
- `/bella-donna/turnos` — Lista de turnos con tabs y acciones
- `/bella-donna/profesionales` — Gestión de profesionales y comisiones
- `/bella-donna/tratamientos` — Gestión de categorías y tratamientos
- `/bella-donna/bloqueos` — Solicitud/aprobación de licencias
- `/bella-donna/liquidaciones` — Liquidación semanal con doble conformidad
- `/bella-donna/metricas` — Métricas de rendimiento (solo dueña)
- `/bella-donna/configuracion` — Configuración del negocio (solo dueña)

**API Routes:**
- `/api/auth/login` — Autenticación profesional
- `/api/auth/webauthn/*` — WebAuthn register/authenticate
- `/api/chat/advisor` — Chat IA advisor
- `/api/chat/booking` — Chat IA booking
- `/api/chat/metrics` — Chat IA métricas
- `/api/mercadopago` — Iniciar pago MP
- `/api/mercadopago/webhook` — Webhook MP
- `/api/push` — Push notifications
- `/api/excel/template` — Descarga template Excel

### Estado Actual (2026-03-17) — 100% Funcional
1. [x] Elegir design system (Gradient Mesh - Bella Rose)
2. [x] Setup proyecto base + PWA (Service Worker manual, Web Push, WebAuthn)
3. [x] Configurar Supabase (14 tablas + RLS en todas)
4. [x] Implementar Auth (profesionales + dueña + WebAuthn biométrico)
5. [x] Feature: Gestión de tratamientos y profesionales (admin)
6. [x] Feature: Calendario (profesional + global tipo Google Calendar)
7. [x] Feature: Sistema de reservas multi-servicio (flujo clienta)
8. [x] Feature: Integración Mercado Pago (mock para dev, estructura lista)
9. [x] Feature: Bloqueo de horarios con aprobación
10. [x] Feature: Reagendamiento clienta (1 vez, vía /reagendar)
11. [x] Feature: No-show (marca automática post-turno)
12. [x] Feature: Transferencia de turnos entre profesionales
13. [x] Feature: Liquidación semanal con doble conformidad
14. [x] Feature: Dashboard de métricas (dueña + profesional)
15. [x] Feature: Notificaciones push en todos los cambios de estado
16. [x] Feature: Flujo completo de turno (llegada → extras → derivación → finalización → cobro)
17. [x] PWA optimización (offline, instalable, InstallBanner)
18. [x] Testing E2E (3 roles: dueña, profesional, clienta)
19. [x] Reestructuración URLs: rutas admin bajo `/bella-donna/*`
20. [x] InstallBanner reposicionado (esquina superior derecha, no tapa contenido)
21. [x] Deploy Vercel (vinculado, auto-deploy en push a master)
22. [x] Feature: Vistas calendario día/semana/mes estilo Google Calendar (PRP-007)
23. [x] Feature: Tarjeta de cliente enriquecida en calendario (PRP-006)
24. [x] Fix: Bloqueo de horarios pasados en reservas del día actual
