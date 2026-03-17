'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, isTextUIPart, isToolOrDynamicToolUIPart } from 'ai'
import { Send, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const metricsTransport = new DefaultChatTransport({ api: '/api/chat/metrics' })

export function MetricsChat() {
  const { messages, status, sendMessage } = useChat({
    transport: metricsTransport,
  })
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isLoading = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    const text = input.trim()
    setInput('')
    sendMessage({ text })
  }

  const suggestions = [
    '¿Cuánto facturé esta semana?',
    '¿Quién fue la profesional que más facturó este mes?',
    '¿Cuántos turnos se cancelaron?',
    '¿Qué turnos hay hoy?',
  ]

  return (
    <div className="mesh-gradient-card rounded-2xl border border-border/50 p-6">
      <h2 className="font-semibold flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-bella-violet-500" />
        Preguntale a la IA
      </h2>

      {/* Messages area */}
      <div className="max-h-[300px] overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Preguntame sobre los ingresos, turnos o rendimiento de tu negocio.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage({ text: s })}
                  className="text-xs px-2.5 py-1.5 rounded-full border border-border/50 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`${m.role === 'user' ? 'text-right' : ''}`}>
            <div
              className={`inline-block max-w-[90%] px-3 py-2 rounded-xl text-sm ${
                m.role === 'user'
                  ? 'bg-bella-rose-600 text-white'
                  : 'bg-muted/50 text-foreground'
              }`}
            >
              {m.parts?.map((part, i) => {
                if (isTextUIPart(part)) {
                  return <p key={i} className="whitespace-pre-wrap">{part.text}</p>
                }
                if (isToolOrDynamicToolUIPart(part) && part.state !== 'output-available') {
                  return (
                    <p key={i} className="text-xs italic flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Consultando datos...
                    </p>
                  )
                }
                return null
              })}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-muted/50 px-3 py-2 rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin text-bella-rose-400" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="¿Cuánto facturé esta semana?"
          disabled={isLoading}
          className="flex-1 px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-bella-rose-200 disabled:opacity-50"
        />
        <Button
          type="submit"
          size="sm"
          disabled={isLoading || !input.trim()}
          className="bg-bella-rose-600 hover:bg-bella-rose-700 rounded-xl px-3"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  )
}
