export type AnalysisStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed'

export interface AnalyzeResponse {
  job_id: string
}

export interface StatusResponse {
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
  repo_name?: string
}

export type WikiResponse = Record<string, unknown>

export interface AskResponse {
  answer: string
}

export interface ImpactResponse {
  direct_dependents: string[]
  indirect_dependents: string[]
  total_impact_radius: number
}

export type IntelligenceMode =
  | 'file-structure'
  | 'architecture'
  | 'risk-hotspots'
  | 'impact'
  | 'refactor'
  | 'ask'
