import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET() {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Profesionales
  const profHeaders = [
    'Nombre', 'Apellido', 'Email', 'Teléfono', 'Comisión %',
    'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
  ]
  const profExample = [
    'Lucía', 'Gómez', 'lucia@ejemplo.com', '1155551234', 40,
    '09:00-18:00', '09:00-18:00', '', '09:00-18:00', '09:00-14:00', '09:00-13:00',
  ]
  const profExample2 = [
    'Adriana', 'López', 'adriana@ejemplo.com', '1155559876', 50,
    '10:00-19:00', '10:00-19:00', '10:00-19:00', '10:00-19:00', '10:00-19:00', '',
  ]
  const profSheet = XLSX.utils.aoa_to_sheet([profHeaders, profExample, profExample2])
  profSheet['!cols'] = profHeaders.map((h) => ({ wch: h.length < 12 ? 14 : h.length + 4 }))
  XLSX.utils.book_append_sheet(wb, profSheet, 'Profesionales')

  // Sheet 2: Servicios
  const svcHeaders = ['Categoría', 'Servicio', 'Precio', 'Duración (min)']
  const svcExamples = [
    ['Uñas', 'Esculpidas', 3000, 60],
    ['Uñas', 'Semipermanente', 2500, 45],
    ['Corte', 'Corte mujer', 20000, 45],
    ['Corte', 'Corte hombre', 12000, 30],
    ['Colorimetría', 'Mechas completas', 35000, 120],
    ['Colorimetría', 'Balayage', 40000, 150],
  ]
  const svcSheet = XLSX.utils.aoa_to_sheet([svcHeaders, ...svcExamples])
  svcSheet['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 10 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, svcSheet, 'Servicios')

  // Sheet 3: Asignaciones (profesional -> servicios)
  const assignHeaders = ['Email Profesional', 'Servicio']
  const assignExamples = [
    ['lucia@ejemplo.com', 'Esculpidas'],
    ['lucia@ejemplo.com', 'Semipermanente'],
    ['adriana@ejemplo.com', 'Corte mujer'],
    ['adriana@ejemplo.com', 'Corte hombre'],
    ['adriana@ejemplo.com', 'Mechas completas'],
    ['adriana@ejemplo.com', 'Balayage'],
  ]
  const assignSheet = XLSX.utils.aoa_to_sheet([assignHeaders, ...assignExamples])
  assignSheet['!cols'] = [{ wch: 24 }, { wch: 22 }]
  XLSX.utils.book_append_sheet(wb, assignSheet, 'Asignaciones')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-iagendate.xlsx"',
    },
  })
}
