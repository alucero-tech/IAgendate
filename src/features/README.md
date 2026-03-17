# Features - Arquitectura Feature-First

Cada feature es **autocontenida** y contiene toda la lógica relacionada.

## Features Actuales

### `ai-assistant/`
Asistentes IA integrados con Vercel AI SDK + Google Gemini.
- Chat advisor (consultas de negocio)
- Chat booking (asistente de reservas)
- Chat métricas (análisis de rendimiento)

### `auth/`
Autenticación para profesionales y dueña (NO para clientas).
- Login con contraseña
- WebAuthn biométrico (huella/face)
- Gestión de sesión y protección de rutas

### `booking/`
Sistema de reservas multi-servicio completo.
- Wizard de reserva (especialidad → tratamiento → día → horario → datos → pago)
- Integración Mercado Pago + transferencia bancaria
- Reagendamiento (1 vez gratis)
- Bloqueo de horarios pasados en día actual

### `calendar/`
Calendario tipo Google Calendar con 3 vistas.
- Vista día (optimizada para móvil)
- Vista semana (grilla 7 columnas)
- Vista mes (grilla mensual con dots/chips)
- Filtro por profesional, botón "Hoy", navegación adaptativa
- Tarjeta de cliente enriquecida (historial, acciones)

### `dashboard/`
Dashboard principal post-login.
- Stats generales (turnos hoy, recaudación)
- Próximos turnos
- Widgets por rol (dueña vs profesional)

### `excel/`
Exportación de datos.
- Descarga de templates Excel

### `metrics/`
Dashboard de métricas de rendimiento.
- Recaudación por profesional y por tratamiento
- Períodos: semanal, mensual, trimestral, anual

### `notifications/`
Push notifications en todos los cambios de estado.
- Confirmación de turno
- Reagendamiento / cancelación
- Recordatorios

### `portal/`
Portal de clienta (`/mi-turno`).
- Consulta de turno por celular (sin login)
- Estado del turno y detalles

### `professionals/`
Gestión de profesionales (admin).
- CRUD profesionales
- Asignación de tratamientos y horarios
- Configuración de comisiones

### `settings/`
Configuración del negocio (solo dueña).
- Horarios del local
- Parámetros generales

### `treatments/`
Gestión de categorías y tratamientos.
- CRUD categorías (especialidades)
- CRUD tratamientos (precio, duración, profesionales)

## Principios Feature-First

1. **Colocalización**: Todo relacionado vive junto
2. **Autocontenido**: Cada feature funciona independientemente
3. **No dependencias circulares**: Features no importan de otras features
4. **Usar `shared/`**: Para código reutilizable entre features
