'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function MockCheckoutContent() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('booking') || ''
  const amount = searchParams.get('amount') || '0'
  const treatment = searchParams.get('treatment') || 'Tratamiento'
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const slug = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'bella-donna'

  function handlePayment(status: 'success' | 'failure' | 'pending') {
    // Simulate webhook call to confirm payment
    if (status === 'success') {
      fetch('/api/mercadopago/mock-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      }).then(() => {
        window.location.href = `${baseUrl}/${slug}/reservar/resultado?status=success&booking=${bookingId}`
      })
    } else {
      window.location.href = `${baseUrl}/${slug}/reservar/resultado?status=${status}&booking=${bookingId}`
    }
  }

  return (
    <div className="min-h-screen bg-[#009ee3] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header MP */}
        <div className="bg-[#009ee3] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-[#009ee3] font-bold text-sm">MP</span>
            </div>
            <span className="text-white font-semibold text-lg">Mercado Pago</span>
          </div>
          <span className="bg-yellow-400 text-xs font-bold px-2 py-1 rounded text-gray-800">
            MODO TEST
          </span>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="text-center space-y-1">
            <p className="text-gray-500 text-sm">IAgendate</p>
            <p className="text-lg font-medium">{treatment}</p>
          </div>

          <div className="text-center">
            <p className="text-gray-500 text-sm">Total a pagar</p>
            <p className="text-4xl font-bold text-gray-800">
              ${Number(amount).toLocaleString('es-AR')}
            </p>
            <p className="text-xs text-gray-400 mt-1">Seña</p>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-2">
            <p className="text-xs text-gray-400 font-medium uppercase">Simulador de pago</p>
            <p className="text-sm text-gray-600">
              Elegí el resultado del pago para probar el flujo completo.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => handlePayment('success')}
              className="w-full bg-[#009ee3] hover:bg-[#0087c6] text-white font-semibold py-4 rounded-lg transition-colors text-lg"
            >
              Pagar (Aprobado)
            </button>
            <button
              onClick={() => handlePayment('pending')}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Simular pendiente
            </button>
            <button
              onClick={() => handlePayment('failure')}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Simular rechazo
            </button>
          </div>

          <p className="text-xs text-center text-gray-400">
            Ref: {bookingId.substring(0, 8)}...
          </p>
        </div>
      </div>
    </div>
  )
}

export default function MockCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#009ee3] flex items-center justify-center">
        <div className="text-white text-lg">Cargando checkout...</div>
      </div>
    }>
      <MockCheckoutContent />
    </Suspense>
  )
}
