# PRP: Flujo de Turno Completo (Llegada → Extras → Pago → Cierre)

> Fecha: 2026-03-16

## Objetivo

Implementar el ciclo de vida completo de un turno desde que la clienta llega hasta que se cierra, incluyendo:
1. Confirmar llegada (profesional o admin)
2. Agregar servicios extras durante el turno (propio o derivado a otra profesional)
3. Registrar método de pago del saldo (efectivo/transferencia)
4. Finalizar turno → estado "completado"

## Comportamiento Esperado

### Flujo del Turno (Happy Path)

```
1. Clienta llega → Profesional toca "Confirmar llegada"
   → Booking pasa de "pending_payment/confirmed" a "in_progress"

2. Durante el turno, si la clienta pide algo extra:
   → Profesional toca "Agregar servicio"
   → Elige: "Es mío" o "Derivo a otra profesional"

   Si es MÍO:
     → Elige qué tratamiento de los que ella ofrece
     → Se agrega directo como booking_item (is_addon = true)
     → Se bloquea su agenda para ese horario

   Si DERIVO:
     → Elige a qué profesional deriva
     → Se crea un "pedido de derivación" (pending)
     → La profesional receptora ve en su pantalla: "Camila te derivó a Laura Pérez"
     → La receptora carga QUÉ servicio va a hacerle
     → Recién ahí queda confirmado el extra y se bloquea su agenda

3. Al terminar, profesional toca "Finalizar turno"
   → Indica método de pago del saldo: efectivo o transferencia
   → Ve resumen: servicios originales + extras
   → Se calcula: total (original + extras) - seña pagada = saldo restante
   → Turno queda como "completed"
```

### Ejemplo 1: Extra propio

```
Clienta reservó: Corte mujer ($20.000) con Camila
Seña pagada: $10.000 (50%)

Llega al salón → Camila confirma llegada
Clienta dice: "¿me hacés un brushing también?"
Camila toca "Agregar servicio" → "Es mío" → Brushing ($15.000)
   → El bloque en el calendario se extiende 40min (de 15:00 a 15:40 si el corte terminaba a las 15:00)
   → Nadie puede reservar ese horario porque ya está ocupado

Al finalizar:
- Corte mujer: $20.000
- Brushing (extra): $15.000
- Total: $35.000
- Seña ya pagada: -$10.000
- Saldo a cobrar: $25.000
- Método de pago: Efectivo
Turno completado ✓
```

### Ejemplo 2: Extra derivado

```
Clienta reservó: Corte mujer ($20.000) con Camila
Seña pagada: $10.000 (50%)

Llega al salón → Camila confirma llegada
Clienta dice: "¿puedo hacerme las uñas también?"
Camila toca "Agregar servicio" → "Derivo a" → Lucía Gómez
   → Lucía ve notificación: "Camila te derivó a Laura Pérez"
   → Lucía carga: Semipermanente ($6.000)
   → Se bloquean 45min en la agenda de Lucía

Al finalizar (Camila cierra su parte):
- Corte mujer: $20.000
- Semipermanente con Lucía (extra derivado): $6.000
- Total: $26.000
- Seña ya pagada: -$10.000
- Saldo a cobrar: $16.000
- Método de pago: Transferencia
Turno completado ✓
```

## Modelo de Datos

### Cambios en BD

**Cambios en `bookings`**:
- Agregar status `in_progress` al enum/check
- Agregar `final_payment_method` TEXT nullable — 'cash' | 'transfer'
- Agregar `final_amount` DECIMAL(10,2) nullable — monto cobrado al cierre

**Cambios en `booking_items`**:
- Agregar `is_addon BOOLEAN DEFAULT false` — items agregados durante el turno
- Agregar `addon_status TEXT DEFAULT 'confirmed'` — 'confirmed' | 'pending_acceptance'
- Agregar `referred_by UUID REFERENCES professionals(id)` — quién derivó (null si es propio)

### Estados del Booking

```
pending_payment → confirmed → in_progress → completed
                                    ↑
                        (extras propios o derivados aquí)
```

### Estados del Addon (booking_item derivado)

```
pending_acceptance → confirmed (receptora carga el servicio)
                   → rejected (receptora rechaza)
```

## Fases de Implementación

### FASE 1: Migración BD + nuevo estado
- Agregar `in_progress` como status válido en bookings
- Agregar `is_addon`, `addon_status`, `referred_by` a booking_items
- Agregar `final_payment_method` y `final_amount` a bookings
- Actualizar calendar/turnos para reconocer `in_progress`

### FASE 2: Confirmar llegada
- Botón "Confirmar llegada" en la card del turno
- Visible para admin y profesional asignada
- Cambia status a `in_progress`
- Color diferenciado en calendario (ej: azul)
- Nueva tab "En curso" en la pantalla de turnos

### FASE 3: Agregar extras — "Es mío"
- Botón "Agregar servicio" visible cuando turno está `in_progress`
- Opción "Es mío": lista de tratamientos que la profesional ofrece
- Crea booking_item con is_addon=true, addon_status='confirmed'
- Extiende el bloque en el calendario: el nuevo item arranca donde termina el último y se suma la duración del tratamiento extra
- El bloque visual en el calendario crece (se ve más largo), reflejando el tiempo total actualizado
- Recalcular totales del booking

### FASE 4: Agregar extras — "Derivo a otra"
- Opción "Derivo a": lista de profesionales activas
- Crea booking_item con is_addon=true, addon_status='pending_acceptance', referred_by=prof_actual
- La profesional receptora ve en "Mis Turnos" una sección "Derivaciones pendientes"
- Receptora elige qué tratamiento hace → actualiza el item → addon_status='confirmed'
- Al confirmar, se bloquea la agenda de la receptora
- Si rechaza → se elimina el item

### FASE 5: Finalizar turno + cobro
- Botón "Finalizar turno" cuando está `in_progress`
- Solo habilitado si no hay derivaciones pendientes (addon_status='pending_acceptance')
- Pantalla resumen:
  - Servicios originales (con seña)
  - Servicios extras propios
  - Servicios extras derivados (con nombre de profesional)
  - Total general
  - Seña pagada
  - Saldo a cobrar
  - Selector: Efectivo / Transferencia
- Al confirmar → status='completed', guarda final_payment_method y final_amount

### FASE 6: Ajustar vistas existentes
- Calendario: color azul para `in_progress`
- Turnos: tab "En curso" + sección "Derivaciones pendientes"
- Liquidaciones: incluir extras (propios y derivados) por profesional

## Compatibilidad

- Los bookings existentes (pending_payment, confirmed, completed) siguen funcionando
- El flujo de confirmar pago de seña se mantiene (pending_payment → confirmed)
- Los extras se identifican por is_addon=true en booking_items
- Las liquidaciones leen de booking_items incluyendo addons

## No incluido en este PRP

- Notificaciones push/WhatsApp para derivaciones
- Facturación/ticket impreso
- Descuentos por combo de extras
- Que la clienta vea los extras desde su lado (solo lo ve la profesional/admin)

## Aprendizajes

### 2026-03-16: CHECK constraint en bookings.status
- **Error**: `bookings_status_check` no incluía `in_progress`, causando silent failure al cambiar status
- **Fix**: ALTER TABLE DROP/ADD constraint incluyendo `in_progress`
- **Aplicar en**: Siempre verificar CHECK constraints antes de agregar nuevos valores a columnas de status

### 2026-03-16: FK ambigua con referred_by → professionals
- **Error**: PostgREST error PGRST201 porque `booking_items` tiene 2 FKs a `professionals` (`professional_id` y `referred_by`)
- **Fix**: Usar `professionals!booking_items_professional_id_fkey (...)` en todos los selects de booking_items
- **Aplicar en**: Cualquier tabla con múltiples FKs a la misma tabla destino
