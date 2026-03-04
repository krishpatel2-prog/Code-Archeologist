import { useRef, useState } from 'react'
import { ChatMessage } from '../../components/chat/ChatMessage'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Section } from '../../components/ui/Section'
import type { Message } from '../../hooks/useAskChat'

interface AskProjectViewProps {
  messages: Message[]
  isTyping: boolean
  onSend: (question: string) => Promise<void>
}

export function AskProjectView({ messages, isTyping, onSend }: AskProjectViewProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [question, setQuestion] = useState('')
  const suggestedQuestions = [
    'Where is authentication handled?',
    'Which module has highest risk?',
    'Which modules should be refactored first?',
  ]

  return (
    <Section
      title="Ask About Project"
      subtitle="Architecture-aware responses grounded in your generated intelligence wiki."
    >
      <div className="flex min-h-[520px] flex-col rounded-2xl border border-[var(--color-border)] bg-slate-900/35">
        <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] px-4 py-3">
          {suggestedQuestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 transition-all hover:border-emerald-500/40 hover:bg-slate-800"
              onClick={() => {
                setQuestion(suggestion)
                inputRef.current?.focus()
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isTyping ? (
            <div className="mr-5 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-300">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Analyzing context
            </div>
          ) : null}
        </div>
        <form
          className="sticky bottom-0 flex items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-panel)] p-3"
          onSubmit={async (event) => {
            event.preventDefault()
            const trimmed = question.trim()
            if (!trimmed) return
            await onSend(trimmed)
            setQuestion('')
            inputRef.current?.focus()
          }}
        >
          <Input
            ref={inputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about architecture boundaries, risks, and safe changes..."
          />
          <Button type="submit" disabled={!question.trim() || isTyping}>
            Send
          </Button>
        </form>
      </div>
    </Section>
  )
}
