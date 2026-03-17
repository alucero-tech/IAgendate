# PRP: Reserva Multi-Servicio Inteligente

> Fecha: 2026-03-16

## Objetivo

Evolucionar el wizard de reservas para que la clienta pueda:
1. Seleccionar múltiples servicios en una sola reserva
2. Elegir profesional por servicio (o que el sistema asigne por disponibilidad)
3. Ver la agenda de la profesional elegida
4. Recibir sugerencia del mejor horario disponible
5. Pagar seña del 50% **por servicio** (cada parte va al profesional correspondiente)

## Comportamiento Esperado

### Flujo del Cliente (Happy Path)

```
1. "¿Qué querés hacerte?" → Seleccionar 1 o más tratamientos (de cualquier categoría)
2. Por cada tratamiento → Elegir profesional o "cualquiera disponible"
3. Elegir fecha → El sistema muestra horarios donde TODOS los servicios encajan
4. Ver resumen: desglose por servicio con precio, profesional, horario
5. Datos personales + método de pago
6. Pagar seña (50% de cada servicio)
```

### Ejemplo Concreto

```
Clienta elige: Uñas esculpidas ($3.000, 60min) + Corte ($20.000, 45min)
- Uñas → con Lucía (profesional de uñas)
- Corte → con Adriana (estilista)

El sistema busca un día donde ambas tengan disponibilidad:
- Opción A: Lucía 10:00-11:00, Adriana 11:00-11:45 (consecutivos)
- Opción B: Lucía 14:00-15:00, Adriana 10:00-10:45 (paralelos)

Seña total: $11.500 ($1.500 para Lucía + $10.000 para Adriana)
```

## Modelo de Datos

### Cambios en BD

**Nueva tabla: `booking_items`** (1 booking → N items)
```sql
CREATE TABLE booking_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  treatment_id UUID REFERENCES treatments(id),
  professional_id UUID REFERENCES professionals(id),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) NOT NULL,  -- 50% del price
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Cambios en `bookings`**:
- `treatment_id` → se vuelve nullable (la info va en booking_items)
- `professional_id` → se vuelve nullable (puede haber múltiples)
- `amount_total` → suma de todos los items
- Mantener `start_time` / `end_time` como rango global de la visita

**Cambios en `payments`**:
- Agregar `booking_item_id` nullable (para saber a qué item/profesional corresponde)
- O mantener un solo pago por booking con el total de señas

### Decisión: Un pago, múltiples items

Un solo registro en `payments` con el total de la seña. La segregación por profesional se calcula en liquidaciones desde `booking_items.deposit_amount`.

## Fases de Implementación

### FASE 1: Migración de BD + booking_items
- Crear tabla `booking_items`
- Hacer `treatment_id` y `professional_id` nullable en `bookings`
- Migrar bookings existentes a booking_items (1 item por booking existente)
- Actualizar RLS

### FASE 2: Nuevo flujo de selección de servicios
- Reemplazar "elegir categoría → tratamiento" por carrito de servicios
- UI: lista de tratamientos agrupados por categoría con botón "Agregar"
- Badge con contador de servicios seleccionados
- Panel lateral/inferior con resumen del carrito

### FASE 3: Asignación de profesionales por servicio
- Por cada servicio en el carrito → elegir profesional
- Opción "Cualquiera disponible" que asigna automáticamente
- Mostrar solo profesionales que ofrecen ese tratamiento

### FASE 4: Disponibilidad inteligente
- Calcular slots donde TODOS los servicios/profesionales encajan
- Si son profesionales diferentes → pueden ser paralelos o consecutivos
- Si es la misma profesional → deben ser consecutivos
- Sugerir el horario más cercano disponible

### FASE 5: Confirmación y pago multi-servicio
- Resumen desglosado: servicio, profesional, horario, precio, seña
- Total de seña = suma de 50% de cada servicio
- Un solo pago por el total de señas
- Crear booking + booking_items en una transacción

### FASE 6: Adaptar admin (turnos, calendario, liquidaciones)
- Vista de turnos muestra items del booking
- Calendario muestra cada item como bloque separado por profesional
- Liquidaciones calculan comisión desde booking_items

## Compatibilidad

- Los bookings existentes (1 servicio) siguen funcionando
- El booking_item se crea siempre, incluso para reservas de 1 servicio
- Las liquidaciones leen de booking_items en vez de bookings directamente

## No incluido en este PRP

- Descuentos por combo
- Sugerencias "clientes que eligieron X también eligieron Y"
- Notificaciones WhatsApp/email (feature separada)
