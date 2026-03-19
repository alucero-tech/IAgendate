# PRP-006: Tarjeta Completa de Cliente en Calendario

> **Estado**: COMPLETADO
> **Fecha**: 2026-03-17
> **Completado**: 2026-03-18
> **Proyecto**: Bella Donna

---

## Objetivo

Al tocar un turno en el calendario, mostrar una tarjeta completa del cliente con todos sus datos, historial de turnos anteriores, botones de accion (WhatsApp, llamar) y opcion de reservar un nuevo turno directamente desde ahi. Reemplaza el modal actual que solo muestra datos basicos sin acciones.

## Por Que

| Problema | Solucion |
|----------|----------|
| El modal actual solo muestra nombre, horario, tratamiento y telefono como texto. No permite actuar. | Tarjeta rica con historial, botones de contacto y accion de nuevo turno |
| Para contactar un cliente hay que copiar el telefono manualmente y abrir WhatsApp | Botones directos de WhatsApp y llamada integrados en la tarjeta |
| No hay forma de ver el historial de un cliente desde el calendario | Seccion de historial con turnos anteriores (fecha, tratamiento, estado) |
| Si quiero agendar un nuevo turno para ese cliente, tengo que salir del calendario | Boton "Reservar nuevo turno" que redirige al wizard pre-completando datos del cliente |

**Valor de negocio**: Reduce el tiempo de gestion por cliente de ~2 minutos (buscar datos, copiar telefono, abrir otra app) a ~5 segundos (todo en un tap). Mejora la experiencia de las profesionales que viven en el calendario.

## Que

### Criterios de Exito
- [ ] Al tocar un turno en el calendario se abre una tarjeta/sheet con datos completos del cliente
- [ ] La tarjeta muestra: nombre, telefono, email, cantidad total de turnos
- [ ] Se muestra historial de ultimos 5 turnos del cliente (fecha, tratamiento, profesional, estado)
- [ ] Boton de WhatsApp funcional que abre chat con mensaje pre-armado
- [ ] Boton de llamar funcional que inicia llamada telefonica
- [ ] Boton "Reservar nuevo turno" que navega al flujo de reserva (idealmente pre-completando el cliente)
- [ ] El modal se ve bien en mobile (responsive, scrollable si el historial es largo)
- [ ] `npm run typecheck` y `npm run build` pasan sin errores

### Comportamiento Esperado (Happy Path)

1. La profesional esta en el calendario semanal viendo los turnos del dia
2. Toca un bloque de turno (ej: "Maria Lopez - Alisado")
3. Se abre un sheet/drawer desde abajo (mobile-friendly) o modal centrado (desktop)
4. **Seccion superior**: Header con nombre del cliente, badge de estado del turno, boton X para cerrar
5. **Seccion datos del turno**: Fecha, horario, tratamiento, categoria, profesional asignada
6. **Seccion datos del cliente**: Telefono, email, cantidad total de visitas
7. **Seccion historial**: Lista de ultimos 5 turnos con fecha, tratamiento y estado (scrollable)
8. **Seccion acciones** (footer sticky):
   - Boton WhatsApp (verde, abre wa.me con numero y mensaje pre-armado)
   - Boton Llamar (rosa, inicia tel:)
   - Boton "Nuevo turno" (primario, navega a /reservar o flujo admin de reserva)
9. La profesional toca WhatsApp, se abre la app con el mensaje "Hola Maria, te escribimos desde Bella Donna..."

---

## Contexto

### Referencias
- `src/app/bella-donna/(admin)/calendario/calendar-client.tsx` - Componente actual del calendario con modal basico (lineas 247-309)
- `src/features/calendar/services/calendar-actions.ts` - Server actions que traen bookings de la semana (CalendarBooking interface)
- `src/shared/components/contact-buttons.tsx` - Logica existente de normalizacion de telefono argentino y URLs de WhatsApp/llamada
- `src/features/booking/services/booking-actions.ts` - Server actions de bookings (queries a BD)

### Arquitectura Propuesta

No se crea una nueva feature folder. Se mejora el componente existente del calendario:

```
src/app/bella-donna/(admin)/calendario/
├── calendar-client.tsx          # Existente - se modifica para usar Sheet en vez de modal inline
├── page.tsx                     # Existente - sin cambios
└── booking-detail-sheet.tsx     # NUEVO - componente de tarjeta completa del cliente
```

```
src/features/calendar/services/
└── calendar-actions.ts          # Existente - se agrega getClientHistory()
```

**Decisiones clave**:
1. Usar `Sheet` (shadcn) en vez del modal custom actual: mejor UX mobile (slide from bottom), scroll nativo, accesibilidad
2. Reutilizar la logica de `contact-buttons.tsx` (normalizePhoneForWhatsApp, normalizePhoneForCall) extrayendola o importandola
3. El historial se carga on-demand al abrir la tarjeta (no pre-cargado) para no sobrecargar la query semanal
4. El boton "Nuevo turno" navega a la pagina de reserva con query params del client_id para pre-completar

### Modelo de Datos

No se necesitan nuevas tablas. Se usa la estructura existente:

- `clients` (id, first_name, last_name, phone, email) - datos del cliente
- `bookings` (id, client_id, booking_date, status, ...) + joins a treatments y professionals - para historial
- `booking_items` - para soporte multi-servicio en historial

**Nueva server action necesaria**:

```typescript
// En calendar-actions.ts
export async function getClientBookingHistory(clientId: string): Promise<ClientHistory> {
  // Query: bookings WHERE client_id = X, ORDER BY booking_date DESC, LIMIT 5
  // Join con treatments y professionals para nombres
  // Tambien retorna: total de visitas (COUNT), datos del cliente (phone, email)
}
```

**Se necesita agregar `client_id` a CalendarBooking interface** para poder hacer la query de historial.

---

## Blueprint (Assembly Line)

### Fase 1: Extender datos del calendario
**Objetivo**: Agregar client_id a CalendarBooking y crear server action getClientBookingHistory que retorne datos del cliente + historial de turnos
**Validacion**: La action retorna correctamente datos de un cliente con sus ultimos 5 turnos

### Fase 2: Componente BookingDetailSheet
**Objetivo**: Crear el componente de tarjeta completa usando Sheet de shadcn, con las 4 secciones (header, datos turno, datos cliente + historial, acciones). Incluye botones WhatsApp/Llamar reutilizando logica de contact-buttons, y boton "Nuevo turno"
**Validacion**: El sheet se abre al tocar un turno, muestra toda la info, los botones funcionan correctamente

### Fase 3: Integracion y pulido mobile
**Objetivo**: Reemplazar el modal inline actual en calendar-client.tsx por el nuevo BookingDetailSheet. Asegurar responsive (sheet bottom en mobile, modal centrado en desktop). Loading state mientras carga historial.
**Validacion**: Flujo completo funciona en mobile y desktop. El historial carga correctamente.

### Fase 4: Validacion Final
**Objetivo**: Sistema funcionando end-to-end
**Validacion**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Tocar turno abre tarjeta completa
- [ ] WhatsApp y Llamar abren las apps correctas
- [ ] Historial muestra turnos reales del cliente
- [ ] "Nuevo turno" navega correctamente
- [ ] Criterios de exito cumplidos

---

## Aprendizajes (Self-Annealing)

> Esta seccion CRECE con cada error encontrado durante la implementacion.

---

## Gotchas

- [ ] El CalendarBooking actual no incluye client_id, hay que agregarlo sin romper el componente existente
- [ ] La query de historial debe hacerse on-demand (lazy) para no impactar performance del calendario
- [ ] contact-buttons.tsx usa normalizacion argentina (549 prefix) - reutilizar esa logica, no duplicarla
- [ ] El Sheet de shadcn puede no estar instalado - verificar o instalar con npx shadcn-ui add sheet
- [ ] Los booking IDs multi-servicio tienen formato compuesto `${bookingId}-${itemId}` - hay que extraer el bookingId real para queries

## Anti-Patrones

- NO cargar historial de todos los clientes al abrir el calendario (lazy loading)
- NO duplicar la logica de normalizacion de telefono (importar de contact-buttons)
- NO crear una pagina separada para la ficha de cliente (es un sheet/overlay del calendario)
- NO hardcodear el limite de historial (usar constante, default 5)
- NO ignorar el caso de clientes sin telefono o sin historial

---

*Implementado y verificado en producción — 2026-03-18.*
