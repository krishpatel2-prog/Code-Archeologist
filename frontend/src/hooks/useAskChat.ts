import { useEffect, useRef, useState } from 'react'
import { askQuestion } from '../services/api'

export interface Message {
  id: string
  role: 'assistant' | 'user'
  content: string
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Ask about architecture boundaries, hotspots, impact risk, or safe refactor zones.',
}

export function useAskChat(jobId: string | null) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [isTyping, setIsTyping] = useState(false)
  const activeJobRef = useRef<string | null>(jobId)

  useEffect(() => {
    activeJobRef.current = jobId
    setMessages([WELCOME_MESSAGE])
    setIsTyping(false)
  }, [jobId])

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

      const requestJobId = jobId
      const response = await askQuestion(requestJobId, trimmed)
      if (activeJobRef.current !== requestJobId) return

      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: 'assistant', content: response.answer },
      ])
    } catch (err) {
      if (activeJobRef.current !== jobId) return
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Unable to answer right now.',
        },
      ])
    } finally {
      if (activeJobRef.current === jobId) {
        setIsTyping(false)
      }
    }
  }

  const clear = () => {
    setMessages([WELCOME_MESSAGE])
  }

  return { messages, isTyping, sendMessage, clear }
}
