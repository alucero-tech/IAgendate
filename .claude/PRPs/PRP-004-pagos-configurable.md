# PRP-004: Sistema de Pagos Configurable

> **Estado**: COMPLETADO
> **Fecha**: 2026-03-16
> **Proyecto**: IAgendate (Bella Donna)

---

## Objetivo

Hacer el porcentaje de seña configurable por la dueña (no hardcodeado al 50%), registrar pagos en efectivo como transacciones reales, y preparar la base para confirmación automática de transferencias.

## Por Qué

| Problema | Solución |
|----------|----------|
| Seña hardcodeada al 50% — no todos los negocios cobran lo mismo | Porcentaje configurable desde ajustes (30%, 40%, 50%, etc.) |
| Pagos en efectivo no quedan registrados como transacción | Registro formal en tabla `payments` con método `cash` |
| Textos dicen "50% restante" cuando podría ser otro porcentaje | Textos dinámicos basados en la configuración |

**Valor de negocio**: Flexibilidad para adaptar el negocio a distintas estrategias de cobro. Trazabilidad completa de todos los pagos (efectivo incluido).

## Qué

### Criterios de Éxito
- [ ] Dueña puede cambiar el porcentaje de seña desde Ajustes
- [ ] Todos los cálculos de depósito usan el valor configurable
- [ ] Pagos en efectivo quedan registrados en tabla `payments`
- [ ] UI muestra porcentaje real en vez de "50%" hardcodeado
- [ ] Wizard de reserva calcula seña con el porcentaje configurado

### Comportamiento Esperado

**Configurar porcentaje:**
1. Dueña va a Ajustes > Pagos
2. Ve campo "Porcentaje de seña" con slider o input (default: 50%)
3. Cambia a 40% → Guardar
4. Todas las reservas nuevas calculan seña al 40%

**Registrar pago en efectivo:**
1. Profesional/encargada finaliza turno
2. Selecciona "Efectivo" como método de pago del saldo
3. Ingresa monto (pre-calculado como `total - seña pagada`)
4. Se crea registro en `payments` con method: 'cash', status: 'confirmed'
5. Booking pasa a `completed`

---

## Contexto

### Referencias
- `src/features/booking/services/booking-actions.ts` — 4 hardcodes de `price / 2`
- `src/app/api/mercadopago/route.ts` — cálculo de preferencia MP
- `src/features/booking/components/booking-wizard.tsx` — UI del wizard
- `src/features/settings/services/settings-actions.ts` — store_settings existente

### Modelo de Datos

```sql
-- Agregar a store_settings (key-value)
INSERT INTO store_settings (key, value)
VALUES ('deposit_percentage', '50')
ON CONFLICT (key) DO NOTHING;
```

No se necesita tabla nueva — se reutiliza `store_settings` y `payments`.

---

## Blueprint (Assembly Line)

### Fase 1: Porcentaje Configurable en DB + Función Centralizada
**Objetivo**: Crear setting `deposit_percentage`, función `calcDeposit(price)` que lee el setting, reemplazar los 4 hardcodes
**Validación**: `calcDeposit(1000)` devuelve 500 con default 50%, devuelve 400 si se cambia a 40%

### Fase 2: UI de Configuración
**Objetivo**: Campo en Ajustes para que la dueña cambie el porcentaje de seña
**Validación**: Cambiar porcentaje → nueva reserva calcula con el valor nuevo

### Fase 3: Registro de Pagos en Efectivo
**Objetivo**: Al finalizar turno, el pago en efectivo se registra en `payments` con todos los datos
**Validación**: Finalizar turno con efectivo → registro visible en payments con method: 'cash'

### Fase 4: Textos Dinámicos
**Objetivo**: Reemplazar todo texto "50%", "Seña 50%", "50% restante" por valores dinámicos
**Validación**: Con seña al 40%, wizard muestra "Seña 40%" y "Saldo 60%"

### Fase 5: Validación Final
**Objetivo**: Sistema funcionando end-to-end
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Reserva con seña configurable funciona
- [ ] Pago en efectivo queda registrado
- [ ] Textos reflejan porcentaje real

---

## Gotchas

- [ ] Reservas existentes ya tienen deposit_amount calculado al 50% — NO recalcular retroactivamente
- [ ] Mercado Pago recibe el monto en centavos — verificar que el cálculo nuevo sea compatible
- [ ] El mock-checkout también debe usar el porcentaje configurable
- [ ] Cache: si se cambia el porcentaje, las reservas en progreso (wizard abierto) podrían tener el valor viejo

## Anti-Patrones

- NO crear nueva tabla para un solo setting — usar store_settings
- NO pasar el porcentaje como prop por toda la cadena — leerlo server-side donde se necesite
- NO permitir porcentaje 0% o 100% — validar rango razonable (10-90%)

---

*PRP pendiente aprobación. No se ha modificado código.*
