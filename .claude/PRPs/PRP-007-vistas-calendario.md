# PRP-007: Vistas de Calendario estilo Google Calendar

> **Estado**: COMPLETADO
> **Fecha**: 2026-03-17
> **Completado**: 2026-03-18
> **Proyecto**: Bella Donna (IAgendate)

---

## Objetivo

Agregar selector de vistas Dia/Semana/Mes al calendario existente, con comportamiento responsive (Dia default en movil, Semana default en desktop) y navegacion adaptativa segun la vista activa.

## Por Que

| Problema | Solucion |
|----------|----------|
| El calendario actual solo tiene vista Semana con min-width 800px, inutilizable en movil | Vista Dia como columna unica optimizada para pantallas chicas |
| No hay vision mensual para planificacion a largo plazo | Vista Mes con grilla y dots/chips que muestran densidad de reservas |
| La navegacion solo avanza/retrocede de a semana | Navegacion adaptativa: prev/next mueve 1 dia, 1 semana o 1 mes segun vista |
| No hay forma rapida de volver al dia actual | Boton "Hoy" para saltar al presente |

**Valor de negocio**: Las profesionales usan el calendario principalmente desde el celular. La vista Dia hace que sea funcional en movil sin scroll horizontal. La vista Mes permite planificar la agenda a futuro.

## Que

### Criterios de Exito
- [ ] Selector de vista (tabs/segmented control) con opciones Dia, Semana, Mes
- [ ] Vista Dia: columna unica con todas las horas (7:00-20:00), muestra reservas como bloques
- [ ] Vista Semana: la actual, sin cambios funcionales
- [ ] Vista Mes: grilla de 6 semanas con dots o chips por reserva en cada celda
- [ ] En movil (< 768px) la vista default es Dia; en desktop (>= 768px) es Semana
- [ ] Navegacion prev/next adapta el salto segun la vista activa (1 dia / 1 semana / 1 mes)
- [ ] Boton "Hoy" visible que vuelve a la fecha actual
- [ ] El filtro por profesional sigue funcionando en las 3 vistas
- [ ] TypeScript compila sin errores, build exitoso

### Comportamiento Esperado

**Happy Path (movil)**:
1. Profesional abre `/bella-donna/calendario` desde celular
2. Ve vista Dia con la fecha de hoy, columna unica con horas y reservas
3. Puede tocar tabs para cambiar a Semana o Mes
4. En vista Mes, ve la grilla con dots de colores por estado
5. Toca un dia en vista Mes y cambia a vista Dia de esa fecha
6. Usa flechas para avanzar/retroceder un dia
7. Toca "Hoy" para volver al presente

**Happy Path (desktop)**:
1. Dueña abre calendario desde PC
2. Ve vista Semana (la actual) con selector de vista visible
3. Puede cambiar a Dia o Mes sin perder filtro de profesional
4. En vista Mes, ve chips con nombre de cliente y color por estado
5. Navega con flechas que avanzan/retroceden un mes

---

## Contexto

### Referencias
- `src/app/bella-donna/(admin)/calendario/calendar-client.tsx` - Componente actual del calendario (vista Semana)
- `src/app/bella-donna/(admin)/calendario/page.tsx` - Server component que carga datos
- `src/features/calendar/services/calendar-actions.ts` - Server actions: `getWeekBookings`, `getActiveProfessionals`
- `src/features/calendar/components/booking-detail-sheet.tsx` - Sheet de detalle al hacer click en reserva
- `src/components/ui/calendar.tsx` - Componente shadcn/ui Calendar (DayPicker, NO se usa en este feature)

### Arquitectura Propuesta

No se crean nuevos features ni carpetas. Se extiende el componente existente `CalendarClient` descomponiendolo en sub-componentes:

```
src/app/bella-donna/(admin)/calendario/
├── page.tsx                    # Server component (se modifica para pasar mas datos)
├── calendar-client.tsx         # Refactor: orquestador con estado de vista
├── calendar-day-view.tsx       # NUEVO: Vista Dia
├── calendar-week-view.tsx      # NUEVO: Extrae la grilla semanal actual
└── calendar-month-view.tsx     # NUEVO: Vista Mes
```

### Cambios en Server Actions

Se necesita una nueva server action `getDayBookings(date, professionalId?)` y `getMonthBookings(yearMonth, professionalId?)` en `calendar-actions.ts`, o bien reutilizar `getWeekBookings` con parametros adaptados. La decision se toma en la fase de implementacion.

### Modelo de Datos

No se requieren cambios en base de datos. Se usan las mismas tablas `bookings` y `booking_items` existentes.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agentico (mapear contexto -> generar subtareas -> ejecutar)

### Fase 1: Refactor - Extraer Vista Semana
**Objetivo**: Mover la grilla semanal actual a su propio componente `calendar-week-view.tsx` sin cambiar funcionalidad. El `calendar-client.tsx` se convierte en orquestador con estado de vista (`day | week | month`).
**Validacion**: El calendario funciona identico a antes, pero el codigo esta separado en componentes.

### Fase 2: Selector de Vista + Boton Hoy
**Objetivo**: Agregar el segmented control (Dia/Semana/Mes) al header del calendario y el boton "Hoy". Implementar la logica de navegacion adaptativa (prev/next salta segun vista). Implementar deteccion de pantalla para default responsive (Dia en movil, Semana en desktop).
**Validacion**: El selector cambia el estado pero solo Semana renderiza contenido (las otras vistas muestran placeholder). Flechas y "Hoy" funcionan correctamente.

### Fase 3: Vista Dia
**Objetivo**: Implementar `calendar-day-view.tsx` - columna unica con horas de 7:00 a 20:00, bloques de reserva posicionados por hora/duracion, reutilizando colores y logica de click del booking detail sheet.
**Validacion**: Vista Dia muestra reservas del dia seleccionado, click abre detalle, navegacion prev/next avanza de a 1 dia.

### Fase 4: Vista Mes
**Objetivo**: Implementar `calendar-month-view.tsx` - grilla mensual con dots (movil) o chips (desktop) por reserva. Click en un dia navega a vista Dia de esa fecha. Server action para obtener bookings del mes completo.
**Validacion**: Vista Mes muestra el mes con indicadores de reservas, colores por estado, click en dia cambia a vista Dia.

### Fase 5: Validacion Final
**Objetivo**: Sistema funcionando end-to-end en las 3 vistas
**Validacion**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Vista Dia funcional en movil (columna unica, sin scroll horizontal)
- [ ] Vista Semana identica a la actual
- [ ] Vista Mes muestra grilla con indicadores
- [ ] Filtro por profesional funciona en las 3 vistas
- [ ] Boton "Hoy" funciona en las 3 vistas
- [ ] Navegacion prev/next adapta segun vista
- [ ] Click en reserva abre BookingDetailSheet en todas las vistas
- [ ] Criterios de exito cumplidos

---

## Aprendizajes (Self-Annealing)

> Esta seccion CRECE con cada error encontrado durante la implementacion.

_(vacio - se llena durante implementacion)_

---

## Gotchas

- [ ] La grilla semanal actual tiene `min-w-[800px]` - la vista Dia NO debe tener esto
- [ ] `getWeekBookings` calcula weekStart/weekEnd internamente - para vista Dia y Mes se necesitan queries con rangos diferentes
- [ ] El filtro de profesional en `getWeekBookings` se hace post-fetch (no en query) para booking_items - mantener este patron
- [ ] `date-fns` ya esta instalado y configurado con locale `es` - reutilizar
- [ ] Los colores por estado (`statusColors`) deben ser consistentes entre las 3 vistas - extraer a constante compartida

## Anti-Patrones

- NO duplicar la logica de posicionamiento de bloques entre vista Dia y Semana
- NO hacer fetch de todas las reservas del mes en una sola query sin limitar columnas
- NO romper el componente `BookingDetailSheet` existente
- NO hardcodear breakpoints - usar Tailwind responsive o `matchMedia`
- NO crear un store Zustand para esto - el estado local de React es suficiente

---

*PRP pendiente aprobacion. No se ha modificado codigo.*
