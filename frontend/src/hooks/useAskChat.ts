import { useState } from 'react'
import { askQuestion } from '../services/api'

export interface Message {
  id: string
  role: 'assistant' | 'user'
  content: string
}

export function useAskChat(jobId: string | null) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Ask about architecture boundaries, hotspots, impact risk, or safe refactor zones.',
    },
  ])
  const [isTyping, setIsTyping] = useState(false)

  const sendMessage = async (question: string) => {
    const trimmed = question.trim()
    if (!trimmed || isTyping) return

    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: 'user', content: trimmed },
    ])
    setIsTyping(true)

    try {
      if (!jobId) {
        throw new Error('No analysis job is available for asking questions.')
      }

      const response = await askQuestion(jobId, trimmed)
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: 'assistant', content: response.answer },
      ])
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Unable to answer right now.',
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const clear = () => {
    setMessages((current) => current.slice(0, 1))
  }

  return { messages, isTyping, sendMessage, clear }
}
