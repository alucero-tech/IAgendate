# PRP-002: Features de IA - IAgendate

> **Estado**: COMPLETADO
> **Fecha**: 2026-03-16
> **Completado**: 2026-03-18
> **Proyecto**: IAgendate

---

## Objetivo

Agregar 5 capacidades de IA al sistema de turnos para mejorar la experiencia de clientes y dueños: chatbot asesor de servicios, asistente de reserva por lenguaje natural, resumen diario inteligente, sugerencias de reagendamiento y analisis de metricas conversacional.

## Por Que

| Problema | Solucion |
|----------|----------|
| Las clientas no saben que tratamiento elegir ni que incluye cada uno | Chatbot asesor que explica servicios, duracion, cuidados (sin precios) |
| Reservar requiere navegar multiples pasos del wizard | Asistente que interpreta "quiero turno manana para unas" y reserva |
| La duena debe revisar calendario + metricas manualmente cada dia | Resumen diario automatico con insights accionables |
| Cuando se cancela un turno, la clienta no recibe alternativas | Sugerencias automaticas de horarios similares disponibles |
| Analizar metricas requiere leer tablas y numeros | Preguntas en lenguaje natural sobre el negocio |

**Valor de negocio**: Reduce friccion en reserva (+ conversion), mejora retencion (chatbot + reagendamiento), ahorra tiempo de gestion (resumen + metricas).

## Que

### Criterios de Exito
- [ ] Chatbot responde preguntas sobre tratamientos sin mostrar precios
- [ ] Asistente interpreta texto libre y crea reserva real
- [ ] Resumen diario genera summary de turnos/ingresos con 1 click
- [ ] Al cancelar, el sistema sugiere 3 alternativas disponibles
- [ ] La duena puede preguntar "cuanto facture esta semana?" y recibir respuesta

### Comportamiento Esperado

**Feature 1 - Chatbot Asesor (publico, sin login)**
1. Clienta abre widget de chat en /reservar
2. Pregunta "que tratamientos tienen para el pelo?" o "cuanto dura un alisado?"
3. El chatbot consulta la tabla `treatments` + `categories` y responde con descripcion, duracion y cuidados
4. NUNCA muestra precios - si le preguntan, dice "los precios los podes ver al seleccionar el tratamiento"
5. Puede sugerir tratamientos basandose en lo que la clienta describe

**Feature 2 - Asistente de Reserva (publico, sin login)**
1. Clienta escribe "quiero turno para manana a las 15 para unas semipermanentes"
2. El asistente usa tools para: buscar tratamiento, verificar disponibilidad, mostrar opciones
3. Clienta confirma y el sistema la redirige al wizard en el paso correcto (o completa la reserva)
4. Si no hay disponibilidad, sugiere alternativas

**Feature 3 - Resumen Diario (solo duena)**
1. En el dashboard, boton "Resumen del dia"
2. Genera: turnos de hoy, ingresos esperados, cancelaciones, profesional mas ocupada, alertas
3. Tono conversacional, no tabla de datos

**Feature 4 - Sugerencias de Reagendamiento (en flujo de cancelacion/reagendamiento)**
1. Cuando clienta quiere reagendar, el sistema genera 3 opciones automaticas
2. Usa horarios similares (misma franja horaria, dias cercanos)
3. Muestra como cards clickeables que llevan directo al paso de confirmacion

**Feature 5 - Analisis de Metricas (solo duena)**
1. En seccion metricas, input de texto "Preguntale a la IA"
2. Duena pregunta: "cual fue mi mejor semana?", "que profesional facturo mas este mes?"
3. La IA consulta datos reales de bookings/payments y responde con numeros exactos

---

## Contexto

### Referencias
- `src/features/treatments/services/treatment-actions.ts` - Datos de tratamientos
- `src/features/booking/services/booking-actions.ts` - Flujo de reserva
- `src/features/metrics/services/metrics-actions.ts` - Metricas y liquidaciones
- `src/features/calendar/services/calendar-actions.ts` - Disponibilidad
- `.claude/skills/ai/references/agents/00-setup-base.md` - Setup OpenRouter
- `.claude/skills/ai/references/agents/05-tools-funciones.md` - Tools pattern
- `.claude/skills/ai/references/single-call.md` - Single call pattern

### Arquitectura Propuesta (Feature-First)
```
src/
├── lib/ai/
│   └── openrouter.ts              # Provider + modelos
│
├── features/ai-assistant/         # Feature compartida de IA
│   ├── components/
│   │   ├── chat-widget.tsx        # Widget flotante para chatbot + asistente
│   │   ├── chat-messages.tsx      # Renderizado de mensajes
│   │   └── suggestion-cards.tsx   # Cards de sugerencia de reagendamiento
│   ├── services/
│   │   └── ai-actions.ts          # Server actions para single-call (resumen, metricas)
│   ├── tools/
│   │   ├── treatment-tools.ts     # Tools: buscar tratamientos, describir servicio
│   │   ├── booking-tools.ts       # Tools: verificar disponibilidad, crear reserva
│   │   └── metrics-tools.ts       # Tools: consultar metricas, facturacion
│   └── types/
│       └── index.ts
│
├── app/api/chat/
│   ├── advisor/route.ts           # Endpoint chatbot asesor
│   ├── booking/route.ts           # Endpoint asistente reserva
│   └── metrics/route.ts           # Endpoint analisis metricas
```

### Modelo de Datos
No requiere tablas nuevas. Todas las features consultan tablas existentes:
- `treatments` + `categories` (chatbot asesor)
- `bookings` + `booking_items` + `professionals` + `schedules` (asistente reserva)
- `bookings` + `payments` + `settlements` (metricas)

---

## Blueprint (Assembly Line)

### Fase 1: Setup Base de IA
**Objetivo**: Instalar dependencias, configurar OpenRouter provider, verificar conexion
**Validacion**: Endpoint `/api/test` responde con texto generado por LLM

### Fase 2: Chatbot Asesor de Servicios
**Objetivo**: Widget de chat en /reservar que responde preguntas sobre tratamientos (sin precios)
**Validacion**: Preguntar "que tratamientos tienen?" y recibir respuesta con datos reales de la DB

### Fase 3: Asistente de Reserva por Lenguaje Natural
**Objetivo**: En el mismo widget, modo asistente que interpreta "quiero turno manana para unas" y usa tools para buscar/reservar
**Validacion**: Escribir pedido de turno y que el sistema muestre opciones reales disponibles

### Fase 4: Resumen Diario + Sugerencias de Reagendamiento
**Objetivo**: Boton en dashboard para resumen AI + cards de sugerencia cuando se reagenda
**Validacion**: Click en "Resumen del dia" genera texto con datos reales. Reagendar muestra 3 alternativas

### Fase 5: Analisis de Metricas Conversacional
**Objetivo**: Input en metricas donde la duena pregunta en lenguaje natural sobre su negocio
**Validacion**: Preguntar "cuanto facture esta semana?" y recibir respuesta con numeros reales

### Fase 6: Validacion Final
**Objetivo**: Sistema completo funcionando end-to-end
**Validacion**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Chatbot no muestra precios bajo ninguna circunstancia
- [ ] Asistente crea reservas reales
- [ ] Resumen usa datos reales del dia
- [ ] Metricas responde con numeros exactos
- [ ] Widget no interfiere con UI existente

---

## Aprendizajes (Self-Annealing)

> Se actualizara durante la implementacion.

---

## Gotchas

- [ ] OpenRouter requiere API key - el usuario debe proveerla
- [ ] AI SDK v5 usa `inputSchema` (no `parameters`) y `stopWhen` (no `maxSteps`)
- [ ] El chatbot asesor es PUBLICO (no requiere login) - usar `createAdminClient()` para queries
- [ ] El resumen y metricas son PRIVADOS (solo duena) - verificar `is_owner` antes de responder
- [ ] Streaming requiere API routes, no server actions (limitacion de Next.js)
- [ ] El widget de chat no debe bloquear el flujo de reserva existente

## Anti-Patrones

- NO crear nuevos patrones si los existentes funcionan
- NO ignorar errores de TypeScript
- NO hardcodear valores (usar constantes)
- NO omitir validacion Zod en inputs de usuario
- NO mostrar precios en el chatbot asesor bajo NINGUNA circunstancia
- NO ejecutar queries SQL directas desde el frontend - siempre via server actions/API routes
- NO guardar historial de chat en DB (no es necesario para v1)

---

*Implementado y verificado en producción — 2026-03-18.*
