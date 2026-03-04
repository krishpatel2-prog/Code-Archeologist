import clsx from 'clsx'
import type { Message } from '../../hooks/useAskChat'

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <article
      className={clsx(
        'rounded-xl px-3 py-2 text-sm leading-6',
        message.role === 'assistant'
          ? 'mr-5 border border-slate-700 bg-slate-900/40 text-slate-200'
          : 'ml-5 border border-emerald-500/40 bg-emerald-500/12 text-emerald-100',
      )}
    >
      {message.content}
    </article>
  )
}
