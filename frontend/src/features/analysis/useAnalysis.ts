import { useContext } from 'react'
import { AnalysisContext } from './analysis-store'

export function useAnalysis() {
  const context = useContext(AnalysisContext)
  if (!context) {
    throw new Error('useAnalysis must be used within AnalysisProvider')
  }
  return context
}
