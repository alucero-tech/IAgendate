'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateStoreSettings, updateDepositPercentage, uploadLogo, type StoreSettings } from '@/features/settings/services/settings-actions'
import { Settings, Save, Store, CreditCard, FileText, ImagePlus, Palette } from 'lucide-react'
import { ExcelUpload } from '@/features/excel/components/excel-upload'
import Image from 'next/image'

export function ConfiguracionClient({ initialSettings, initialDepositPct = 50 }: { initialSettings: StoreSettings; initialDepositPct?: number }) {
  const [settings, setSettings] = useState(initialSettings)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [depositPct, setDepositPct] = useState(initialDepositPct)
  const [logoPreview, setLogoPreview] = useState(initialSettings.logo_url)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function update(field: keyof StoreSettings, value: string) {
    setSettings(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    const formData = new FormData()
    formData.append('logo', file)
    const result = await uploadLogo(formData)
    if (result.error) {
      alert(result.error)
    } else if (result.logoUrl) {
      setLogoPreview(result.logoUrl)
      setSettings(prev => ({ ...prev, logo_url: result.logoUrl! }))
    }
    setUploadingLogo(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSave() {
    setLoading(true)
    const [settingsResult, depositResult] = await Promise.all([
      updateStoreSettings(settings),
      updateDepositPercentage(depositPct),
    ])
    if (settingsResult.error) {
      alert(settingsResult.error)
    } else if (depositResult.error) {
      alert(depositResult.error)
    } else {
      setSaved(true)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-8 w-8 text-bella-rose-500" />
          Configuración
        </h1>
        <Button
          onClick={handleSave}
          disabled={loading}
          className="bg-bella-rose-600 hover:bg-bella-rose-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {saved ? 'Guardado' : 'Guardar cambios'}
        </Button>
      </div>

      {/* Datos del local */}
      <div className="mesh-gradient-card rounded-2xl border border-border/50 p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Store className="h-5 w-5 text-bella-violet-500" />
          Datos del local
        </h2>
        <div className="grid gap-4">
          {/* Logo upload */}
          <div className="space-y-2">
            <Label>Logo del negocio</Label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
                {logoPreview ? (
                  <Image
                    src={logoPreview}
                    alt="Logo"
                    width={80}
                    height={80}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImagePlus className="w-8 h-8 text-muted-foreground/50" />
                )}
              </div>
              <div className="space-y-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingLogo ? 'Subiendo...' : logoPreview ? 'Cambiar logo' : 'Subir logo'}
                </Button>
                <p className="text-xs text-muted-foreground">PNG, JPG o SVG. Máximo 2MB.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nombre del local</Label>
            <Input
              value={settings.store_name}
              onChange={e => update('store_name', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={settings.phone}
                onChange={e => update('phone', e.target.value)}
                placeholder="11 1234-5678"
              />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input
                value={settings.instagram}
                onChange={e => update('instagram', e.target.value)}
                placeholder="@mi.negocio"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Dirección</Label>
            <Input
              value={settings.address}
              onChange={e => update('address', e.target.value)}
              placeholder="Calle 123, Ciudad"
            />
          </div>
        </div>
      </div>

      {/* Pagos */}
      <div className="mesh-gradient-card rounded-2xl border border-border/50 p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-bella-gold-500" />
          Pagos
        </h2>

        {/* Porcentaje de seña */}
        <div className="space-y-2">
          <Label>Porcentaje de seña</Label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={depositPct}
              onChange={e => { setDepositPct(Number(e.target.value)); setSaved(false) }}
              className="flex-1 accent-bella-rose-500"
            />
            <span className="text-lg font-bold text-bella-rose-600 min-w-[3.5rem] text-right">
              {depositPct}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            La clienta paga {depositPct}% como seña al reservar y el {100 - depositPct}% restante al finalizar el turno.
          </p>
        </div>

        <hr className="border-border" />

        {/* Datos de transferencia */}
        <h3 className="text-sm font-medium text-muted-foreground">Datos para transferencia</h3>
        <p className="text-sm text-muted-foreground">
          Estos datos se muestran a las clientas cuando eligen pagar por transferencia.
        </p>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Alias</Label>
              <Input
                value={settings.transfer_alias}
                onChange={e => update('transfer_alias', e.target.value)}
                placeholder="mi.alias.mp"
              />
            </div>
            <div className="space-y-2">
              <Label>Banco</Label>
              <Input
                value={settings.transfer_bank}
                onChange={e => update('transfer_bank', e.target.value)}
                placeholder="Mercado Pago"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CBU / CVU</Label>
            <Input
              value={settings.transfer_cbu}
              onChange={e => update('transfer_cbu', e.target.value)}
              placeholder="0000003100..."
            />
          </div>
          <div className="space-y-2">
            <Label>Titular</Label>
            <Input
              value={settings.transfer_holder}
              onChange={e => update('transfer_holder', e.target.value)}
              placeholder="Nombre del titular"
            />
          </div>
        </div>
      </div>

      {/* Marca / Colores */}
      <div className="mesh-gradient-card rounded-2xl border border-border/50 p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Palette className="h-5 w-5 text-bella-violet-500" />
          Identidad visual
        </h2>
        <p className="text-sm text-muted-foreground">
          Elegí los colores de tu marca. Se aplican en el wizard de reservas y el panel de administración.
        </p>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label>Color principal</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.primary_color}
                onChange={e => update('primary_color', e.target.value)}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
              />
              <Input
                value={settings.primary_color}
                onChange={e => update('primary_color', e.target.value)}
                placeholder="#ec4899"
                className="font-mono text-sm"
                maxLength={7}
              />
            </div>
            <div
              className="h-8 rounded-lg border border-border/50 transition-colors"
              style={{ backgroundColor: settings.primary_color }}
            />
          </div>
          <div className="space-y-3">
            <Label>Color de acento</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.accent_color}
                onChange={e => update('accent_color', e.target.value)}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
              />
              <Input
                value={settings.accent_color}
                onChange={e => update('accent_color', e.target.value)}
                placeholder="#8b5cf6"
                className="font-mono text-sm"
                maxLength={7}
              />
            </div>
            <div
              className="h-8 rounded-lg border border-border/50 transition-colors"
              style={{ backgroundColor: settings.accent_color }}
            />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap pt-1">
          {[
            { label: 'Rosa', primary: '#ec4899', accent: '#8b5cf6' },
            { label: 'Violeta', primary: '#8b5cf6', accent: '#06b6d4' },
            { label: 'Azul IA', primary: '#3b82f6', accent: '#06b6d4' },
            { label: 'Verde', primary: '#10b981', accent: '#f59e0b' },
            { label: 'Naranja', primary: '#f97316', accent: '#ef4444' },
          ].map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                update('primary_color', preset.primary)
                update('accent_color', preset.accent)
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-xs hover:bg-muted/50 transition-colors"
            >
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: preset.primary }} />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Carga masiva */}
      <ExcelUpload />

      {/* Políticas */}
      <div className="mesh-gradient-card rounded-2xl border border-border/50 p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-bella-rose-500" />
          Política de cancelación
        </h2>
        <div className="space-y-2">
          <Label>Texto que se muestra a las clientas</Label>
          <textarea
            value={settings.cancellation_policy}
            onChange={e => update('cancellation_policy', e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          />
        </div>
      </div>
    </div>
  )
}
