---
name: shield
description: "Escanear archivos de server actions en busca de funciones sin validacion Zod (safeParse). Propone schemas automaticamente y aplica el patron de blindaje. Activar cuando el usuario dice: blindar, escanear validaciones, revisar seguridad de actions, shield, o despues de crear nuevas server actions."
---

# Shield — Blindaje Automatico de Server Actions

> "Ninguna funcion publica sin safeParse(). Zero trust en inputs."

Shield escanea `*-actions.ts` y API routes en busca de funciones exportadas que reciben parametros sin validar con Zod. Propone schemas y aplica el patron de blindaje.

---

## Cuando Usar Shield

- Despues de crear nuevas server actions
- Auditoria periodica de seguridad de inputs
- Antes de deploy a produccion
- Cuando se agregan parametros a funciones existentes

---

## Proceso de Escaneo

### Paso 1: Descubrir archivos objetivo

Buscar todos los archivos de acciones y rutas API:

```
src/features/*/services/*-actions.ts
src/app/api/**/route.ts
```

### Paso 2: Identificar funciones sin blindaje

Para cada archivo, detectar funciones exportadas (`export async function`) que:

1. **Reciben parametros** (no son funciones sin args como `getCategories()`)
2. **NO tienen `safeParse` o `parse`** de Zod en las primeras 10 lineas del cuerpo
3. **NO son re-exports** (lineas tipo `export { fn } from`)

### Paso 3: Clasificar parametros

Para cada funcion sin blindaje, analizar sus parametros:

| Tipo de Parametro | Schema Zod Sugerido |
|---|---|
| `id: string` (UUID) | `uuidSchema` (de zod-schemas.ts) |
| `bookingId: string` | `bookingIdSchema` |
| `professionalId: string` | `professionalIdSchema` |
| `date: string` | `dateSchema` |
| `time: string` | `timeSchema` |
| `phone: string` | `phoneSchema` |
| `email: string` | `z.string().email()` |
| `number` | `z.number()` o `z.coerce.number()` |
| `boolean` | `z.boolean()` |
| `object` con shape conocida | `z.object({...})` compuesto |
| `array` | `z.array(elementSchema)` |

### Paso 4: Generar reporte

Mostrar al usuario un reporte con este formato:

```markdown
# Shield Report — [fecha]

## Resumen
- Archivos escaneados: X
- Funciones totales: X
- Funciones blindadas: X (Y%)
- Funciones sin blindaje: X

## Funciones Sin Blindaje

### archivo.ts

| Funcion | Parametros | Schema Propuesto |
|---|---|---|
| `updateClient` | `clientId: string, data: {...}` | `updateClientSchema` |
| `deleteItem` | `itemId: string` | `uuidSchema` |

## Schemas Nuevos Necesarios

Los siguientes schemas deben agregarse a `src/shared/schemas/zod-schemas.ts`:

\```typescript
// Domain: [nombre]
export const updateClientSchema = z.object({
  clientId: uuidSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
})
\```
```

### Paso 5: Aplicar blindaje (con aprobacion)

Tras mostrar el reporte, preguntar:

> "Encontre X funciones sin blindaje. Quieres que aplique los schemas propuestos?"

Si el usuario aprueba:

1. Agregar schemas nuevos a `src/shared/schemas/zod-schemas.ts`
2. Importar schemas en cada archivo de actions
3. Agregar `safeParse()` como primera linea de cada funcion
4. Verificar que typecheck pase (`npm run typecheck`)

---

## Patron de Blindaje (Referencia)

Toda funcion blindada sigue este patron exacto:

```typescript
import { miSchema } from '@/shared/schemas/zod-schemas'

export async function miFuncion(param1: string, param2: number) {
  const parsed = miSchema.safeParse({ param1, param2 })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Datos inválidos' }

  const { param1, param2 } = parsed.data
  // ... logica de negocio usando parsed.data
}
```

### Variantes del patron

**Funcion con un solo parametro primitivo (UUID):**
```typescript
export async function getById(id: string) {
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: 'ID inválido' }

  // usar parsed.data directamente
}
```

**Funcion con parametro opcional:**
```typescript
export async function listar(professionalId?: string) {
  if (professionalId) {
    const parsed = professionalIdSchema.safeParse(professionalId)
    if (!parsed.success) return { error: 'ID de profesional inválido' }
  }
  // ...
}
```

**API Route (POST):**
```typescript
export async function POST(request: Request) {
  const body = await request.json()
  const parsed = miSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }
  // usar parsed.data
}
```

---

## Exclusiones Validas

NO marcar como "sin blindaje" funciones que:

- No reciben parametros (`getCategories()`, `getCurrentProfessional()`)
- Solo reciben `Request` de Next.js (GET handlers sin body)
- Son helpers internos no exportados (`function helper()` sin `export`)
- Ya tienen validacion equivalente via middleware o decorator

---

## Archivo Central de Schemas

Todos los schemas viven en: `src/shared/schemas/zod-schemas.ts`

Reglas:
- **Un solo archivo** como fuente de verdad
- Schemas primitivos reutilizables (`uuidSchema`, `dateSchema`, `phoneSchema`)
- Schemas compuestos por dominio, agrupados con comentarios
- Nombrar schemas con sufijo `Schema` en camelCase
- Documentar schemas complejos con comentario de una linea

---

## Comandos de Ejecucion

Despues de aplicar blindaje, SIEMPRE ejecutar:

```bash
npm run typecheck    # Verificar que no hay errores de tipos
npm run build        # Verificar build completo (opcional, mas lento)
```

---

## Principios Shield

1. **Zero Trust**: Todo input externo es sospechoso hasta que pasa validacion
2. **Fail Fast**: Validar en la primera linea, no despues de queries a DB
3. **Single Source**: Un schema, un archivo (`zod-schemas.ts`)
4. **Descriptive Errors**: Mensajes en espanol, claros para el usuario final
5. **No Over-Engineering**: Si la funcion no recibe params, no necesita shield

---

*"Si no tiene safeParse, no esta listo para produccion."*
