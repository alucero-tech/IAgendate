# PRP: Portal Mi Turno

> **Estado**: COMPLETADO
> **Fecha**: 2026-03-16
> **Proyecto**: Bella Donna

---

## Objetivo

Crear una pagina publica `/mi-turno` donde la clienta ingresa su celular y ve el detalle de su reserva activa, con opciones para reagendar (reutilizando logica existente), cancelar (con regla de 48hs de anticipacion), y contactar al local por WhatsApp o telefono. Ademas, agregar botones de contacto WhatsApp + Llamar visibles en todas las paginas publicas y en el panel admin para todos los roles.

## Por Que

| Problema | Solucion |
|----------|----------|
| La clienta no tiene un lugar unico para consultar su turno | Portal centralizado `/mi-turno` donde ve todo con solo ingresar su celular |
| No puede cancelar por su cuenta, tiene que llamar al local | Boton de cancelacion self-service con regla de negocio (48hs antes) |
| Los datos de contacto del local no estan accesibles de forma prominente | Botones flotantes de WhatsApp y Llamar visibles en todas las vistas publicas y admin |
| El flujo de reagendamiento esta separado en `/reagendar` | Se unifica en el portal Mi Turno como una accion mas sobre la reserva |

**Valor de negocio**: Reduce llamadas al local, empodera a la clienta para gestionar su turno de forma autonoma, mejora la experiencia mobile-first, y facilita el contacto directo cuando es necesario.

## Que

### Criterios de Exito
- [ ] La clienta ingresa su celular en `/mi-turno` y ve sus turnos activos con detalle completo (fecha, hora, servicios, profesional, monto)
- [ ] La clienta puede cancelar su turno si faltan mas de 48hs (se muestra mensaje claro si no puede)
- [ ] La clienta puede reagendar su turno desde el mismo portal (reutilizando logica de `rescheduleBooking`)
- [ ] Botones de WhatsApp y Llamar visibles en `/mi-turno`, `/reservar`, `/reagendar` y en el sidebar/header del panel admin
- [ ] El telefono del local se lee de `store_settings` (key `phone`) -- ya existe en la DB
- [ ] La cancelacion por parte de la clienta notifica al owner y profesionales via push

### Comportamiento Esperado

**Happy Path - Consulta + Cancelacion:**
1. Clienta entra a `/mi-turno`
2. Ingresa su celular (10 digitos)
3. Ve sus turnos activos: fecha, hora, servicios con profesional, monto total, estado
4. Toca "Cancelar turno"
5. Sistema valida que faltan >48hs para el turno
6. Confirma la cancelacion con modal de confirmacion
7. Turno pasa a `cancelled`, se notifica a profesionales y owner
8. Pantalla de confirmacion con mensaje de politica de sena

**Happy Path - Reagendamiento:**
1. Desde el mismo portal, toca "Reagendar"
2. Se abre el flujo de reagendamiento (misma logica que `/reagendar`)
3. Elige nueva fecha y horario
4. Confirma reagendamiento

**Happy Path - Contacto:**
1. En cualquier momento, la clienta ve botones flotantes de WhatsApp y Llamar
2. WhatsApp abre `https://wa.me/549{phone}` con mensaje predefinido
3. Llamar abre `tel:+549{phone}`

**Regla de Cancelacion 48hs:**
- Si `booking_date + start_time` esta a mas de 48hs del momento actual: permitir cancelar
- Si esta a menos de 48hs: mostrar mensaje "No podes cancelar con menos de 48hs de anticipacion. Contactanos por WhatsApp."
- Cancelacion por clienta: NO se reembolsa la sena (diferente a cancelacion admin que puede elegir reembolsar)

---

## Contexto

### Referencias
- `src/app/reagendar/page.tsx` - Pagina existente de reagendamiento (misma estetica mesh-gradient)
- `src/features/booking/components/reschedule-wizard.tsx` - Wizard de reagendamiento a reutilizar/adaptar
- `src/features/booking/services/booking-actions.ts` - `getBookingsByPhone()`, `rescheduleBooking()`, `cancelBooking()` ya existen
- `src/features/settings/services/settings-actions.ts` - `getStoreSettings()` ya devuelve `phone` del local
- `src/features/notifications/services/push-service.ts` - `notifyProfessional()`, `notifyOwner()`, `notifyClient()`
- `src/shared/components/sidebar.tsx` - Sidebar admin donde agregar botones de contacto
- `src/app/reservar/page.tsx` - Pagina publica de reserva (agregar botones contacto)

### Arquitectura Propuesta (Feature-First)

```
src/features/portal/
├── components/
│   ├── my-booking-portal.tsx       # Wizard principal (phone → bookings → detail)
│   ├── booking-detail-card.tsx     # Card con detalle de un turno + acciones
│   └── cancel-confirmation.tsx     # Modal de confirmacion de cancelacion
│
src/shared/components/
│   └── contact-buttons.tsx         # Botones flotantes WhatsApp + Llamar (reutilizable)
│
src/app/mi-turno/
│   └── page.tsx                    # Pagina publica /mi-turno
```

**Reutilizacion clave:**
- `getBookingsByPhone()` ya devuelve exactamente la data necesaria (turnos con items, profesionales, estado)
- `cancelBooking(bookingId, false)` ya existe (con `refund: false` para cancelacion de clienta)
- `rescheduleBooking()` ya existe y maneja toda la logica
- El telefono del local ya se guarda en `store_settings` con key `phone`

### Modelo de Datos

No se requieren migraciones. Todas las tablas y campos necesarios ya existen:
- `bookings.status` ya soporta `cancelled`
- `bookings.booking_date` + `bookings.start_time` para validar regla 48hs
- `store_settings.key = 'phone'` para numero del local
- `clients.phone` para busqueda de clienta

**Nueva server action necesaria:**
- `cancelBookingByClient(bookingId: string, clientPhone: string)` - Wrapper que valida regla 48hs + que el booking pertenece a esa clienta + cancela sin reembolso

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agentico (mapear contexto -> generar subtareas -> ejecutar)

### Fase 1: Server Actions - Cancelacion por Clienta
**Objetivo**: Crear `cancelBookingByClient()` con validacion de 48hs, verificacion de pertenencia del turno a la clienta, y cancelacion sin reembolso. Agregar `getStorePhone()` como helper publico.
**Validacion**: Unit test mental: llamar con booking que esta a >48hs cancela OK, con <48hs devuelve error claro.

### Fase 2: Componente Contact Buttons (WhatsApp + Llamar)
**Objetivo**: Crear componente reutilizable `ContactButtons` que muestre botones flotantes de WhatsApp y Llamar. Recibe `phone` como prop. Integrar en `/reservar`, `/reagendar`, y preparar para `/mi-turno`.
**Validacion**: Botones visibles en mobile, WhatsApp abre wa.me con numero correcto, Llamar abre tel:.

### Fase 3: Portal Mi Turno - UI Completa
**Objetivo**: Crear pagina `/mi-turno` con wizard de 3 pasos: (1) ingreso celular, (2) lista de turnos con detalle, (3) acciones (cancelar con modal confirmacion, reagendar reutilizando logica existente, contactar). Misma estetica mesh-gradient que `/reservar` y `/reagendar`.
**Validacion**: Flujo completo funcional desde celular hasta cancelacion/reagendamiento exitoso.

### Fase 4: Integracion de Contact Buttons en Panel Admin
**Objetivo**: Agregar botones de contacto WhatsApp + Llamar en el sidebar o header del panel admin, visibles para todos los roles (owner y profesionales). El numero se lee de store_settings.
**Validacion**: Botones visibles en desktop y mobile para ambos roles.

### Fase 5: Validacion Final
**Objetivo**: Sistema funcionando end-to-end
**Validacion**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Flujo completo: celular -> ver turno -> cancelar (>48hs) funciona
- [ ] Flujo completo: celular -> ver turno -> cancelar (<48hs) muestra error
- [ ] Flujo completo: celular -> ver turno -> reagendar funciona
- [ ] Botones WhatsApp/Llamar visibles en /mi-turno, /reservar, /reagendar
- [ ] Botones WhatsApp/Llamar visibles en panel admin (owner + profesional)
- [ ] Notificaciones push se envian al cancelar

---

## Aprendizajes (Self-Annealing)

> Esta seccion CRECE con cada error encontrado durante la implementacion.

---

## Gotchas

- [ ] El campo `value` de `store_settings` es tipo `jsonb`, no `text` - asegurarse de parsear correctamente al leer el telefono
- [ ] `cancelBooking()` existente recibe `refund: boolean` - para cancelacion de clienta siempre usar `false`
- [ ] El `reschedule_count` limita a 1 reagendamiento - el portal debe mostrar esto claramente
- [ ] WhatsApp link: formato Argentina es `549` + numero sin 0 ni 15 - hay que normalizar el numero del local
- [ ] La pagina `/mi-turno` es publica (sin auth) - usar `createAdminClient()` para queries, NO `createClient()`
- [ ] La regla de 48hs debe calcular contra `booking_date` + `start_time` combinados, no solo la fecha

## Anti-Patrones

- NO crear nuevos patrones si los existentes funcionan (reutilizar `getBookingsByPhone`, `cancelBooking`, `rescheduleBooking`)
- NO ignorar errores de TypeScript
- NO hardcodear el numero de telefono del local
- NO omitir validacion Zod en el input del celular
- NO permitir cancelacion sin modal de confirmacion (accion irreversible)

---

*PRP pendiente aprobacion. No se ha modificado codigo.*
