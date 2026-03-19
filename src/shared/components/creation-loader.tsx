'use client'

import { CheckCircle2, Loader2, Database, UserCheck, Zap } from 'lucide-react'

const CREATION_STEPS = [
  { icon: Database, label: 'Creando tu base de datos...' },
  { icon: UserCheck, label: 'Configurando tu perfil...' },
  { icon: Zap, label: 'Activando tu sistema...' },
]

export function CreationLoader({ activeStep }: { activeStep: number }) {
  return (
    <div className="py-8 space-y-6">
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
        </div>
        <h3 className="text-lg font-semibold text-white">Construyendo tu sala</h3>
        <p className="text-slate-400 text-sm mt-1">Esto solo toma unos segundos</p>
      </div>
      <div className="space-y-3">
        {CREATION_STEPS.map((s, i) => {
          const Icon = s.icon
          const done = i < activeStep
          const active = i === activeStep
          return (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-500 ${
                done
                  ? 'border-blue-800/50 bg-blue-950/30'
                  : active
                  ? 'border-blue-600/60 bg-blue-950/50 shadow-sm shadow-blue-500/10'
                  : 'border-slate-800 bg-slate-900/30 opacity-40'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                done || active ? 'bg-blue-500/20' : 'bg-slate-800'
              }`}>
                {done
                  ? <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  : active
                  ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  : <Icon className="w-4 h-4 text-slate-600" />
                }
              </div>
              <span className={`text-sm font-medium ${
                done ? 'text-slate-400 line-through decoration-slate-600' : active ? 'text-white' : 'text-slate-600'
              }`}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
