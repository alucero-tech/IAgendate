# PRP-001: Features Faltantes para Producto 100%

> **Estado**: PENDIENTE
> **Fecha**: 2026-03-16
> **Proyecto**: IAgendate

---

## Objetivo

Completar las 7 features faltantes para que IAgendate sea un producto 100% funcional: reagendamiento por clienta, marcar no-show, aprobacion de transferencias de turnos por profesional, RLS policies en todas las tablas, notificaciones push en cambios de estado, aviso a clienta al cancelar, y actualizacion de documentacion.

## Por Que

| Problema | Solucion |
|----------|----------|
| La clienta no puede reagendar su turno (la regla de negocio dice 1 vez gratis pero no esta implementado) | Flujo de reagendamiento publico donde la clienta ingresa su celular, ve su turno y elige nuevo horario |
| No se puede marcar a una clienta que no asistio | Boton "No asistio" en turnos confirmados cuyo horario ya paso |
| Si la duena transfiere un turno a otra profesional, esta no tiene que aprobarlo | La profesional receptora debe aceptar/rechazar la transferencia de turno |
| No hay RLS policies - todos los datos son accesibles con service_role key sin restriccion | RLS policies en todas las tablas para proteger datos sensibles |
| La profesional/duena no recibe notificacion cuando un turno cambia de estado | Push notifications en cada cambio de estado relevante (confirmar pago, reagendar, cancelar, no-show, llegada) |
| La clienta no sabe que su turno fue cancelado por la peluqueria | Notificacion push a la clienta cuando la duena cancela su turno |
| CLAUDE.md y BUSINESS_LOGIC.md no reflejan el estado actual del producto | Actualizar ambos archivos con features implementadas, estructura real, y aprendizajes |

**Valor de negocio**: Producto listo para uso real por las 6 profesionales y sus clientas. Sin estas features, el sistema tiene huecos criticos que impiden la operacion diaria confiable.

## Que

### Criterios de Exito
- [ ] Clienta puede reagendar 1 vez ingresando su celular (sin login). Segunda vez muestra error y pierde reserva
- [ ] Duena/profesional puede marcar "No asistio" en turnos confirmados cuyo horario ya paso
- [ ] Cuando la duena reasigna un turno a otra profesional, la receptora ve una solicitud y puede aceptar/rechazar
- [ ] Todas las tablas public tienen RLS habilitado con policies apropiadas por rol
- [ ] Se envian push notifications en: confirmar pago, reagendar, cancelar, no-show, llegada, finalizacion
- [ ] La clienta recibe push notification cuando su turno es cancelado por la peluqueria
- [ ] CLAUDE.md refleja la estructura real del proyecto y features implementadas
- [ ] BUSINESS_LOGIC.md tiene los proximos pasos actualizados
- [ ] `npm run typecheck` pasa sin errores
- [ ] `npm run build` exitoso

### Comportamiento Esperado

**Reagendamiento (Happy Path):**
1. Clienta entra a `/reagendar`
2. Ingresa su numero de celular
3. Ve sus turnos activos (confirmados/reagendados)
4. Selecciona el turno a reagendar
5. Si `reschedule_count === 0`: elige nuevo dia y horario disponible -> turno actualizado, status = `rescheduled`, `reschedule_count = 1`
6. Si `reschedule_count >= 1`: mensaje "Ya reagendaste este turno. No es posible reagendar nuevamente. Perdes la reserva y la sena."

**No-Show:**
1. En la vista de turnos, los turnos con status `confirmed` o `rescheduled` cuya fecha/hora ya pasaron muestran boton "No asistio"
2. Al hacer click -> status cambia a `no_show`
3. Se envia notificacion push a la clienta informando que fue marcada como no-show

**Aprobacion de Transferencia:**
1. Duena reasigna un turno (booking_item) de profesional A a profesional B
2. Se crea un registro con status `pending_transfer`
3. Profesional B ve la solicitud en su vista de turnos
4. Profesional B acepta -> turno se asigna definitivamente. Rechaza -> vuelve a profesional A

**RLS Policies:**
- `professionals`: lectura publica de datos basicos (nombre), escritura solo admin
- `schedules`: lectura publica, escritura solo admin
- `categories`/`treatments`/`professional_treatments`: lectura publica, escritura solo admin
- `clients`: lectura/escritura via service_role (server actions usan admin client)
- `bookings`/`booking_items`/`payments`: lectura/escritura via service_role
- `time_blocks`: lectura publica de aprobados, escritura profesional propio + admin
- `settlements`: lectura profesional propio + admin, escritura admin
- `store_settings`: lectura/escritura admin
- `push_subscriptions`: lectura/escritura por subscription owner

**Notificaciones en cambios de estado:**
- Confirmar pago transferencia -> push a clienta + profesional asignada
- Reagendar -> push a profesional asignada + duena
- Cancelar -> push a clienta + profesional asignada
- No-show -> push a clienta
- Confirmar llegada -> push a duena (si no es ella quien marca)
- Finalizar turno -> push a duena (si no es ella)

---

## Contexto

### Referencias
- `src/features/booking/services/booking-actions.ts` - Server actions de reservas (cancelBooking, confirmTransferPayment, confirmArrival, finalizeTurn ya existen)
- `src/features/notifications/services/push-service.ts` - Sistema de push notifications (notifyClient, notifyProfessional, notifyOwner ya existen)
- `src/app/(main)/turnos/turnos-client.tsx` - Vista de gestion de turnos (ya tiene status `no_show` en labels pero no tiene boton)
- `src/features/booking/components/booking-wizard.tsx` - Wizard de reserva publica (patron a seguir para reagendamiento)
- `src/app/reservar/page.tsx` - Pagina publica de reserva
- `src/features/calendar/services/calendar-actions.ts` - Queries de calendario
- `src/features/auth/services/auth-actions.ts` - getCurrentProfessional para auth checks

### Arquitectura Propuesta

No se crean nuevas features. Se extienden las existentes:

```
src/features/booking/
├── components/
│   ├── booking-wizard.tsx          (existente)
│   └── reschedule-wizard.tsx       (NUEVO - wizard de reagendamiento)
├── services/
│   └── booking-actions.ts          (EXTENDER - rescheduleBooking, markNoShow, transferBooking, approveTransfer, rejectTransfer)

src/features/notifications/
└── services/
    └── push-service.ts             (existente - ya tiene notifyClient/Professional/Owner)

src/app/
├── reagendar/
│   └── page.tsx                    (NUEVO - pagina publica de reagendamiento)
└── (main)/turnos/
    └── turnos-client.tsx           (EXTENDER - boton no-show, UI transferencia)
```

### Modelo de Datos

No se crean tablas nuevas. Cambios en tablas existentes:

```sql
-- bookings ya tiene: reschedule_count (integer), status incluye 'rescheduled' y 'no_show'
-- booking_items ya tiene: professional_id (para transferencias)

-- Para transferencias, agregar columna a booking_items:
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS transfer_status TEXT DEFAULT NULL;
-- Valores: null (normal), 'pending_transfer', 'accepted', 'rejected'
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS original_professional_id UUID REFERENCES professionals(id) DEFAULT NULL;

-- RLS: habilitar en TODAS las tablas
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
```

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agentico (mapear contexto -> generar subtareas -> ejecutar)

### Fase 1: Reagendamiento por Clienta
**Objetivo**: La clienta puede reagendar su turno 1 vez gratis desde una pagina publica `/reagendar`, identificandose por celular.
**Validacion**:
- Clienta ingresa celular -> ve turnos activos -> selecciona -> elige nuevo horario -> turno reagendado
- Si ya reagendo 1 vez -> mensaje de error, no puede reagendar
- Status cambia a `rescheduled`, `reschedule_count` incrementa

### Fase 2: Marcar No-Show
**Objetivo**: Duena/profesional puede marcar "No asistio" en turnos cuyo horario ya paso, cambiando status a `no_show`.
**Validacion**:
- Boton visible solo en turnos `confirmed`/`rescheduled` cuya fecha+hora ya pasaron
- Al clickear -> status = `no_show`
- Push notification enviada a clienta

### Fase 3: Transferencia de Turnos con Aprobacion
**Objetivo**: Cuando la duena reasigna un booking_item a otra profesional, la receptora debe aprobar/rechazar.
**Validacion**:
- Duena puede iniciar transferencia desde vista de turnos
- Profesional receptora ve solicitud pendiente
- Aceptar -> turno asignado definitivamente. Rechazar -> vuelve a profesional original
- Push notifications a profesional receptora

### Fase 4: RLS Policies
**Objetivo**: Todas las tablas de `public` tienen RLS habilitado con policies apropiadas.
**Validacion**:
- Cada tabla tiene `ENABLE ROW LEVEL SECURITY`
- Policy de service_role para server actions (bypass via admin client)
- Policies restrictivas para acceso directo (authenticated users)
- Datos de clientas/pagos no accesibles por profesionales directamente

### Fase 5: Notificaciones en Cambios de Estado
**Objetivo**: Cada cambio de estado de un turno dispara push notifications a los actores relevantes.
**Validacion**:
- Confirmar pago -> push a clienta + profesional
- Reagendar -> push a profesional + duena
- Cancelar -> push a clienta + profesional
- No-show -> push a clienta
- Confirmar llegada -> push a duena
- Finalizar -> push a duena
- Aviso a clienta al cancelar incluye mensaje claro de devolucion

### Fase 6: Actualizar Documentacion
**Objetivo**: CLAUDE.md y BUSINESS_LOGIC.md reflejan el estado real del producto con todas las features implementadas.
**Validacion**:
- BUSINESS_LOGIC.md tiene proximos pasos actualizados (tachados los completados)
- CLAUDE.md tiene aprendizajes nuevos documentados
- Estructura de features en docs coincide con la real en codigo

### Fase 7: Validacion Final
**Objetivo**: Sistema funcionando end-to-end con todas las features integradas
**Validacion**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Flujo reagendamiento funciona end-to-end
- [ ] No-show funciona y envia notificacion
- [ ] Transferencia funciona con aprobacion
- [ ] RLS habilitado en todas las tablas
- [ ] Notificaciones se disparan en cada cambio de estado
- [ ] Documentacion actualizada

---

## Aprendizajes (Self-Annealing / Neural Network)

> Esta seccion CRECE con cada error encontrado durante la implementacion.

*(Vacio - se llena durante la implementacion)*

---

## Gotchas

- [ ] El sistema actual usa `createAdminClient()` (service_role) para TODAS las queries, incluyendo las publicas. Al habilitar RLS, el admin client hace bypass automatico, pero hay que verificar que no haya queries con `createClient()` (anon key) que se rompan
- [ ] `reschedule_count` ya existe como columna en `bookings` pero verificar que realmente este en la tabla de Supabase
- [ ] El booking_wizard actual no tiene logica para buscar turno por celular - el reschedule-wizard es un componente nuevo con patron similar
- [ ] Las push notifications solo funcionan si la clienta acepto notificaciones durante el booking wizard (boton "Activar notificaciones")
- [ ] Transfer de turnos es diferente a derivaciones (addon referrals) que ya existen. No confundir: transferencia = reasignar turno existente. Derivacion = agregar servicio nuevo

## Anti-Patrones

- NO crear tablas nuevas si se puede resolver con columnas en tablas existentes
- NO romper el flujo de admin client bypass al implementar RLS
- NO enviar notificaciones duplicadas (verificar que no se notifique 2 veces al mismo actor)
- NO hardcodear mensajes de notificacion (usar constantes o funcion helper)
- NO ignorar el caso de clientas que no activaron push (degradar gracefully)

---

*PRP pendiente aprobacion. No se ha modificado codigo.*
