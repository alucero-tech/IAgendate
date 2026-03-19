import { z } from 'zod'

// ========== PRIMITIVOS REUTILIZABLES ==========

/** UUID v4 — para IDs de bookings, professionals, treatments, etc. */
export const uuidSchema = z.string().uuid('ID inválido')

/** Alias semánticos para legibilidad en server actions */
export const bookingIdSchema = uuidSchema
export const professionalIdSchema = uuidSchema
export const treatmentIdSchema = uuidSchema
export const clientIdSchema = uuidSchema

/** Fecha ISO yyyy-MM-dd */
export const dateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Formato de fecha inválido (esperado: yyyy-MM-dd)'
)

/** Hora HH:mm */
export const timeSchema = z.string().regex(
  /^\d{2}:\d{2}$/,
  'Formato de hora inválido (esperado: HH:mm)'
)

/** Celular argentino 10 dígitos */
export const phoneSchema = z.string().regex(
  /^\d{10}$/,
  'El celular debe tener 10 dígitos (ej: 1122334455)'
)

// ========== COMPUESTOS ==========

/** Rango de fechas (from <= to) */
export const dateRangeSchema = z.object({
  from: dateSchema,
  to: dateSchema,
}).refine(
  (data) => data.from <= data.to,
  { message: 'La fecha "desde" no puede ser posterior a la fecha "hasta"' }
)

/** Paginación genérica */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

// ========== SCHEMAS POR DOMINIO: BOOKING ==========

export const cancelBookingSchema = z.object({
  bookingId: bookingIdSchema,
  refund: z.boolean(),
})

export const cancelBookingByClientSchema = z.object({
  bookingId: bookingIdSchema,
  clientPhone: phoneSchema,
})

export const getBookingsByPhoneSchema = z.object({
  phone: phoneSchema,
})

export const rescheduleBookingSchema = z.object({
  bookingId: bookingIdSchema,
  newDate: dateSchema,
  newStartTime: timeSchema,
})

// ========== SCHEMAS POR DOMINIO: TURN FLOW ==========

export const addOwnAddonSchema = z.object({
  bookingId: bookingIdSchema,
  treatmentId: treatmentIdSchema,
  professionalId: professionalIdSchema,
})

export const addReferralAddonSchema = z.object({
  bookingId: bookingIdSchema,
  referredByProfId: professionalIdSchema,
  targetProfId: professionalIdSchema,
})

export const acceptReferralAddonSchema = z.object({
  itemId: uuidSchema,
  treatmentId: treatmentIdSchema,
})

export const finalizeTurnSchema = z.object({
  bookingId: bookingIdSchema,
  paymentMethod: z.enum(['cash', 'transfer']),
})

// ========== SCHEMAS POR DOMINIO: TRANSFER & PAYMENTS ==========

export const initiateTransferSchema = z.object({
  bookingItemId: uuidSchema,
  targetProfessionalId: professionalIdSchema,
})

export const manualRefundSchema = z.object({
  bookingId: bookingIdSchema,
  refundedByProfId: professionalIdSchema,
})

// ========== SCHEMAS POR DOMINIO: METRICS ==========

export const revenueMetricsSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']),
})

export const markSettlementsPaidSchema = z.object({
  professionalId: professionalIdSchema,
  manualAmount: z.number().min(0).optional(),
})

export const confirmSettlementSchema = z.object({
  settlementId: uuidSchema,
  role: z.enum(['professional', 'owner']),
})

// ========== SCHEMAS POR DOMINIO: SETTINGS ==========

export const updateDepositPercentageSchema = z.object({
  percentage: z.number().int().min(10).max(90),
})

/** Color HEX de 6 dígitos — ej: #ec4899 */
export const hexColorSchema = z.string().regex(
  /^#[0-9a-fA-F]{6}$/,
  'Color inválido (esperado: #RRGGBB)'
)

export const brandColorsSchema = z.object({
  primary_color: hexColorSchema,
  accent_color: hexColorSchema,
})

// ========== SCHEMAS POR DOMINIO: PROFESSIONALS ==========

export const updateProfessionalRoleSchema = z.object({
  id: professionalIdSchema,
  role: z.enum(['professional', 'manager']),
})

export const toggleActiveSchema = z.object({
  id: uuidSchema,
  active: z.boolean(),
})

export const assignTreatmentsSchema = z.object({
  professionalId: professionalIdSchema,
  treatmentIds: z.array(treatmentIdSchema),
})

export const toggleScheduleDaySchema = z.object({
  professionalId: professionalIdSchema,
  dayOfWeek: z.number().int().min(0).max(6),
  isActive: z.boolean(),
})

// ========== SCHEMAS POR DOMINIO: TIME BLOCKS ==========

export const approveRejectBlockSchema = z.object({
  blockId: uuidSchema,
})

// ========== SCHEMAS POR DOMINIO: API ROUTES ==========

/** POST /api/auth/login */
export const loginSchema = z.object({
  identifier: z.string().min(1, 'Completá todos los campos'),
  password: z.string().min(1, 'Completá todos los campos'),
})

/** GET /api/auth/webauthn/register — query param */
export const webauthnRegisterQuerySchema = z.object({
  professionalId: professionalIdSchema,
})

/** POST /api/auth/webauthn/register — response is browser-generated, validated by simplewebauthn */
export const webauthnRegisterBodySchema = z.object({
  professionalId: professionalIdSchema,
  response: z.looseObject({}),
})

/** POST /api/auth/webauthn/authenticate — response is browser-generated, validated by simplewebauthn */
export const webauthnAuthenticateBodySchema = z.object({
  response: z.looseObject({}),
})

/** POST /api/mercadopago — crear preferencia de pago */
export const mpCreatePreferenceSchema = z.object({
  bookingId: bookingIdSchema,
})

/** POST /api/mercadopago/webhook — payload de Mercado Pago */
export const mpWebhookSchema = z.object({
  type: z.string(),
  action: z.string().optional(),
  data: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
})

// ========== TENANT REGISTRATION ==========

const RESERVED_SLUGS = new Set(['login', 'registro', 'superadmin', 'api', 'planes', 'cuenta-suspendida', 'admin', 'www', 'app', 'mail', 'static'])

/** Slug de tenant: minúsculas, números y guiones, 3-50 caracteres */
export const tenantSlugSchema = z.string()
  .min(3, 'El slug debe tener al menos 3 caracteres')
  .max(50, 'El slug no puede superar los 50 caracteres')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo letras minúsculas, números y guiones (ej: mi-salon)')
  .refine(s => !RESERVED_SLUGS.has(s), 'Ese nombre no está disponible')

/** Paso 1: nombre del negocio + slug */
export const tenantStep1Schema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  slug: tenantSlugSchema,
})

/** Paso 2: datos del propietario */
export const tenantStep2Schema = z.object({
  ownerName: z.string().min(2, 'Tu nombre debe tener al menos 2 caracteres').max(100),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

/** Schema completo de registro */
export const tenantRegistrationSchema = tenantStep1Schema.merge(tenantStep2Schema)

/** POST /api/push — registrar push subscription */
export const pushSubscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url('Endpoint inválido'),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  clientPhone: phoneSchema.optional(),
  professionalId: professionalIdSchema.optional(),
})
