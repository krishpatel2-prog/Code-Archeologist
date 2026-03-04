import { createContext } from 'react'
import type { AnalysisStatus, WikiResponse } from '../../types/api'

export interface AnalysisStep {
  key: string
  label: string
  done: boolean
  active: boolean
}

export interface AnalysisContextValue {
  repoInput: string
  setRepoInput: (value: string) => void
  jobId: string | null
  wiki: WikiResponse | null
  status: AnalysisStatus
  isAnalyzing: boolean
  progress: number
  statusMessage: string
  repoName: string | null
  error: string | null
  steps: AnalysisStep[]
  startAnalysis: () => Promise<void>
  resetAnalysis: () => void
}

export const AnalysisContext = createContext<AnalysisContextValue | null>(null)
