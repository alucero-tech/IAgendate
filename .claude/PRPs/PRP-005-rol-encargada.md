# PRP-005: Rol Encargada (Manager)

> **Estado**: COMPLETADO
> **Fecha**: 2026-03-16
> **Proyecto**: IAgendate (Bella Donna)

---

## Objetivo

Agregar un rol intermedio "encargada/manager" para que la dueña pueda delegar la gestión diaria del negocio a una persona de confianza, con permisos acotados (sin ver métricas globales ni modificar configuración).

## Por Qué

| Problema | Solución |
|----------|----------|
| Si la dueña se toma licencia, nadie puede gestionar el negocio | La encargada tiene permisos para operar el día a día |
| No se puede delegar sin dar acceso total | Rol con permisos específicos: opera pero no configura |
| Devoluciones automáticas son riesgosas sin supervisión | Encargada hace devolución manual + notifica a la dueña |

**Valor de negocio**: Continuidad operativa cuando la dueña no está. Control sin riesgo.

## Qué

### Criterios de Éxito
- [ ] Campo `role` en professionals con valores: `professional | manager | owner`
- [ ] Dueña puede asignar/quitar rol manager desde panel
- [ ] Manager puede: gestionar turnos, ver calendario, ver liquidaciones, aprobar bloqueos
- [ ] Manager NO puede: ver métricas globales, cambiar comisiones, cambiar configuración
- [ ] Manager ve "Devolución manual" en vez de "Devolver por sistema"
- [ ] Devolución manual notifica a la dueña por push

### Comportamiento Esperado

**Dueña asigna encargada:**
1. Va a Equipo > selecciona profesional
2. Cambia rol de "Profesional" a "Encargada"
3. Esa persona ahora ve menú expandido (turnos, calendario, liquidaciones)

**Encargada opera:**
- Ve calendario global con todos los turnos
- Puede confirmar llegadas, agregar extras, finalizar turnos
- Puede reagendar/cancelar turnos
- Ve liquidaciones: cuánto se le debe a cada profesional
- NO ve: facturación total, comisiones globales, métricas de negocio

**Devolución manual:**
1. Cliente pide cancelación con derecho a devolución
2. Encargada ve botón "Devolución manual" (NO "Devolver por sistema")
3. Confirma → se registra como `refund_type: 'manual'`
4. Se envía push notification a la dueña: "María registró devolución manual de $X para [cliente]"
5. Dueña decide cómo procesar el reembolso real

---

## Contexto

### Referencias
- `src/features/professionals/` — gestión de profesionales existente
- `src/app/(main)/turnos/` — gestión de turnos (manager necesita acceso)
- `src/app/(main)/liquidaciones/` — liquidaciones (manager ve limitado)
- `src/app/(main)/metricas/` — métricas (manager NO tiene acceso)
- `src/features/settings/` — configuración (manager NO tiene acceso)

### Modelo de Datos

```sql
-- Agregar campo role a professionals
ALTER TABLE professionals
ADD COLUMN role TEXT NOT NULL DEFAULT 'professional'
CHECK (role IN ('professional', 'manager', 'owner'));

-- Actualizar la dueña actual
UPDATE professionals SET role = 'owner' WHERE is_owner = true;

-- Agregar tipo de devolución a payments
ALTER TABLE payments
ADD COLUMN refund_type TEXT CHECK (refund_type IN ('automatic', 'manual'));

-- Agregar quién hizo la devolución manual
ALTER TABLE payments
ADD COLUMN refunded_by UUID REFERENCES professionals(id);
```

### Arquitectura Propuesta

No se crea feature nueva — se extiende el sistema existente:
```
src/features/professionals/types/  → agregar Role type
src/shared/hooks/                  → useCurrentRole() hook
src/shared/components/             → RoleGate component
```

---

## Blueprint (Assembly Line)

### Fase 1: Modelo de Datos + Role Field
**Objetivo**: Migración DB para agregar `role` a professionals, tipo de devolución a payments. Actualizar types TypeScript.
**Validación**: Campo role existe, dueña actual tiene role='owner'

### Fase 2: Hook useCurrentRole + RoleGate
**Objetivo**: Hook que devuelve el rol del profesional logueado. Componente RoleGate que muestra/oculta UI según rol.
**Validación**: `useCurrentRole()` devuelve 'owner' para la dueña, RoleGate oculta contenido correctamente

### Fase 3: UI para Asignar Rol
**Objetivo**: En panel de Equipo, la dueña puede cambiar rol de un profesional a manager y viceversa
**Validación**: Cambiar rol → se persiste en DB → la persona ve menú diferente

### Fase 4: Restricciones de Navegación
**Objetivo**: Manager ve menú expandido (turnos, calendario, liquidaciones) pero NO métricas ni configuración. Profesional ve solo su agenda.
**Validación**: Manager no puede acceder a /metricas ni /ajustes (redirect o 403)

### Fase 5: Liquidaciones Limitadas para Manager
**Objetivo**: Manager ve cuánto se le debe a cada profesional, pero NO ve facturación total ni comisiones globales
**Validación**: Manager en /liquidaciones ve montos por profesional sin totales de negocio

### Fase 6: Devolución Manual + Notificación
**Objetivo**: Manager ve "Devolución manual" en vez de "Devolver por sistema". Al confirmar, se registra y notifica a la dueña por push.
**Validación**: Devolución manual → registro en payments con refund_type='manual' → push a la dueña

### Fase 7: Validación Final
**Objetivo**: Sistema de roles funcionando end-to-end
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Profesional ve solo su agenda
- [ ] Manager ve gestión completa sin métricas
- [ ] Owner ve todo
- [ ] Devolución manual notifica a la dueña

---

## Gotchas

- [ ] El campo `is_owner` actual en professionals podría entrar en conflicto con `role` — migrar y eventualmente deprecar `is_owner`
- [ ] RLS en Supabase debe considerar el nuevo campo role para permisos
- [ ] Push notifications requieren que el sistema de notificaciones ya esté implementado — si no, usar fallback (registro en DB + indicador visual)
- [ ] Solo puede haber UN owner — validar en la migración y en el código

## Anti-Patrones

- NO crear tabla separada de roles — es un campo simple en professionals
- NO duplicar lógica de permisos en cada página — centralizar en RoleGate y middleware
- NO permitir que un manager se auto-promueva a owner
- NO bloquear al owner de hacer lo que hace la manager — owner hereda todos los permisos

---

*PRP completado el 2026-03-16. Build y typecheck validados exitosamente.*
