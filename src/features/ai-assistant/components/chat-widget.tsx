'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, isToolOrDynamicToolUIPart, isTextUIPart } from 'ai'
import { MessageCircle, X, Send, Bot, Sparkles, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ChatMode = 'advisor' | 'booking'

const advisorTransport = new DefaultChatTransport({ api: '/api/chat/advisor' })
const bookingTransport = new DefaultChatTransport({ api: '/api/chat/booking' })

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<ChatMode>('advisor')

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-bella-rose-600 text-white shadow-lg shadow-bella-rose-200 hover:bg-bella-rose-700 transition-all hover:scale-105 flex items-center justify-center"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] flex flex-col rounded-2xl border border-border/50 shadow-2xl bg-background overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-bella-rose-50 to-bella-violet-50">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-bella-rose-500" />
              <span className="font-semibold text-sm">
                {mode === 'advisor' ? 'Asesor de Servicios' : 'Asistente de Reservas'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMode(mode === 'advisor' ? 'booking' : 'advisor')}
                className="p-1.5 rounded-lg hover:bg-white/50 transition-colors text-muted-foreground hover:text-foreground"
                title={mode === 'advisor' ? 'Cambiar a asistente de reservas' : 'Cambiar a asesor'}
              >
                {mode === 'advisor' ? <Calendar className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/50 transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setMode('advisor')}
              className={`flex-1 text-xs py-2 font-medium transition-colors ${
                mode === 'advisor'
                  ? 'text-bella-rose-600 border-b-2 border-bella-rose-500'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="w-3 h-3 inline mr-1" />
              Asesor
            </button>
            <button
              onClick={() => setMode('booking')}
              className={`flex-1 text-xs py-2 font-medium transition-colors ${
                mode === 'booking'
                  ? 'text-bella-violet-600 border-b-2 border-bella-violet-500'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="w-3 h-3 inline mr-1" />
              Reservar
            </button>
          </div>

          {/* Chat content */}
          <ChatContent key={mode} mode={mode} />
        </div>
      )}
    </>
  )
}

function ChatContent({ mode }: { mode: ChatMode }) {
  const { messages, status, sendMessage } = useChat({
    transport: mode === 'advisor' ? advisorTransport : bookingTransport,
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

  const suggestions = mode === 'advisor'
    ? ['¿Qué tratamientos tienen?', '¿Cuánto dura un alisado?', '¿Qué me recomendás para el pelo?']
    : ['Quiero turno para mañana', '¿Qué días hay disponibles?', 'Turno para uñas semipermanentes']

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-bella-rose-50 to-bella-violet-50 rounded-xl p-3">
              <p className="text-sm text-foreground">
                {mode === 'advisor'
                  ? '¡Hola! Soy tu asesor de belleza. Preguntame sobre nuestros tratamientos, qué incluyen y cuánto duran.'
                  : '¡Hola! Puedo ayudarte a encontrar turno. Decime qué servicio necesitás y cuándo te gustaría venir.'}
              </p>
            </div>
            <div className="space-y-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput('')
                    sendMessage({ text: s })
                  }}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
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
                    <p key={i} className="text-xs text-muted-foreground italic">
                      Buscando información...
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
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-bella-rose-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-bella-rose-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-bella-rose-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'advisor' ? 'Preguntá sobre nuestros servicios...' : 'Decime qué turno necesitás...'}
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
        </div>
      </form>
    </>
  )
}
