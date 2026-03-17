'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { upsertFromExcel, type ExcelData, type UpsertResult } from '../services/excel-actions'
import { Download, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

const DAY_COLUMNS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DAY_MAP: Record<string, number> = {
  'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6,
}

function parseTimeRange(value: string): { start: string; end: string } | null {
  if (!value || typeof value !== 'string') return null
  const clean = value.trim()
  const match = clean.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/)
  if (!match) return null
  return { start: match[1].padStart(5, '0'), end: match[2].padStart(5, '0') }
}

function parseExcel(file: ArrayBuffer): ExcelData {
  const wb = XLSX.read(file, { type: 'array' })

  // Parse Profesionales sheet
  const profSheet = wb.Sheets['Profesionales']
  const profRows: Record<string, unknown>[] = profSheet ? XLSX.utils.sheet_to_json(profSheet) : []
  const profesionales = profRows.map(row => {
    const horarios: { day: number; start: string; end: string }[] = []
    for (const dayName of DAY_COLUMNS) {
      const val = row[dayName] as string
      if (val) {
        const parsed = parseTimeRange(String(val))
        if (parsed) {
          horarios.push({ day: DAY_MAP[dayName], ...parsed })
        }
      }
    }
    return {
      nombre: String(row['Nombre'] || '').trim(),
      apellido: String(row['Apellido'] || '').trim(),
      email: String(row['Email'] || '').trim(),
      telefono: String(row['Teléfono'] || row['Telefono'] || '').trim(),
      comision: Number(row['Comisión %'] || row['Comision %'] || 0),
      horarios,
    }
  }).filter(p => p.email && p.nombre)

  // Parse Servicios sheet
  const svcSheet = wb.Sheets['Servicios']
  const svcRows: Record<string, unknown>[] = svcSheet ? XLSX.utils.sheet_to_json(svcSheet) : []
  const servicios = svcRows.map(row => ({
    categoria: String(row['Categoría'] || row['Categoria'] || '').trim(),
    servicio: String(row['Servicio'] || '').trim(),
    precio: Number(row['Precio'] || 0),
    duracion: Number(row['Duración (min)'] || row['Duracion (min)'] || 60),
  })).filter(s => s.servicio && s.categoria)

  // Parse Asignaciones sheet
  const assignSheet = wb.Sheets['Asignaciones']
  const assignRows: Record<string, unknown>[] = assignSheet ? XLSX.utils.sheet_to_json(assignSheet) : []
  const asignaciones = assignRows.map(row => ({
    email: String(row['Email Profesional'] || '').trim(),
    servicio: String(row['Servicio'] || '').trim(),
  })).filter(a => a.email && a.servicio)

  return { profesionales, servicios, asignaciones }
}

export function ExcelUpload() {
  const [data, setData] = useState<ExcelData | null>(null)
  const [result, setResult] = useState<UpsertResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const buf = ev.target?.result as ArrayBuffer
      const parsed = parseExcel(buf)
      setData(parsed)
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleUpload() {
    if (!data) return
    setLoading(true)
    const res = await upsertFromExcel(data)
    setResult(res)
    setLoading(false)
  }

  function reset() {
    setData(null)
    setResult(null)
    setFileName(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="mesh-gradient-card rounded-2xl border border-border/50 p-6 space-y-4">
      <h2 className="font-semibold flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-green-600" />
        Carga masiva por Excel
      </h2>
      <p className="text-sm text-muted-foreground">
        Descargá la plantilla, completala con los datos y subila. El sistema actualiza lo que cambió, inserta lo nuevo y no toca lo que está igual.
      </p>

      <div className="flex gap-3">
        <a href="/api/excel/template" download>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Descargar plantilla
          </Button>
        </a>

        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
            className="hidden"
            id="excel-upload"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Subir Excel
          </Button>
        </div>
      </div>

      {/* Preview */}
      {data && !result && (
        <div className="space-y-3 bg-muted/30 rounded-xl p-4">
          <p className="text-sm font-medium">
            Archivo: <span className="text-muted-foreground">{fileName}</span>
          </p>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-bella-violet-600">{data.profesionales.length}</p>
              <p className="text-muted-foreground">Profesionales</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-bella-rose-600">{data.servicios.length}</p>
              <p className="text-muted-foreground">Servicios</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-bella-gold-600">{data.asignaciones.length}</p>
              <p className="text-muted-foreground">Asignaciones</p>
            </div>
          </div>

          {/* Detail preview */}
          {data.profesionales.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Profesionales:</p>
              <div className="flex flex-wrap gap-1">
                {data.profesionales.map((p, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {p.nombre} {p.apellido} ({p.email})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {data.servicios.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Servicios:</p>
              <div className="flex flex-wrap gap-1">
                {data.servicios.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {s.categoria} → {s.servicio} (${s.precio.toLocaleString('es-AR')})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleUpload}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-2" /> Confirmar carga</>
              )}
            </Button>
            <Button variant="outline" onClick={reset} disabled={loading}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3 bg-muted/30 rounded-xl p-4">
          <div className="flex items-center gap-2">
            {result.errors.length === 0 ? (
              <><CheckCircle className="h-5 w-5 text-green-600" /><span className="font-medium text-green-700">Carga completada sin errores</span></>
            ) : (
              <><AlertCircle className="h-5 w-5 text-amber-600" /><span className="font-medium text-amber-700">Carga completada con {result.errors.length} advertencia(s)</span></>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            {result.stats.profCreated > 0 && (
              <p><span className="font-medium text-green-600">{result.stats.profCreated}</span> profesionales creados</p>
            )}
            {result.stats.profUpdated > 0 && (
              <p><span className="font-medium text-blue-600">{result.stats.profUpdated}</span> profesionales actualizados</p>
            )}
            {result.stats.catCreated > 0 && (
              <p><span className="font-medium text-green-600">{result.stats.catCreated}</span> categorías creadas</p>
            )}
            {result.stats.svcCreated > 0 && (
              <p><span className="font-medium text-green-600">{result.stats.svcCreated}</span> servicios creados</p>
            )}
            {result.stats.svcUpdated > 0 && (
              <p><span className="font-medium text-blue-600">{result.stats.svcUpdated}</span> servicios actualizados</p>
            )}
            {result.stats.svcSkipped > 0 && (
              <p><span className="text-muted-foreground">{result.stats.svcSkipped}</span> servicios sin cambios</p>
            )}
            {result.stats.assignCreated > 0 && (
              <p><span className="font-medium text-green-600">{result.stats.assignCreated}</span> asignaciones creadas</p>
            )}
            {result.stats.schedUpdated > 0 && (
              <p><span className="font-medium text-blue-600">{result.stats.schedUpdated}</span> horarios configurados</p>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
              {result.errors.map((err, i) => (
                <p key={i}>• {err}</p>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={reset}>
            Cargar otro archivo
          </Button>
        </div>
      )}
    </div>
  )
}
