import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import {
  analyzeRepository,
  analyzeUploadedRepository,
  getAnalysisStatus,
  getWiki,
  type UploadedRepoFile,
} from '../../services/api'
import {
  AnalysisContext,
  type AnalysisContextValue,
  type AnalysisStep,
} from './analysis-store'
import type { AnalysisStatus, WikiResponse } from '../../types/api'

const STEP_LABELS = [
  '📂 Scanning repository files',
  '🧠 Building dependency graph',
  '🏗 Detecting architecture patterns',
  '📘 Generating intelligence wiki',
]
const MAX_POLL_DURATION_MS = 4 * 60 * 1000

export function AnalysisProvider({ children }: PropsWithChildren) {
  const [repoInput, setRepoInput] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [wiki, setWiki] = useState<WikiResponse | null>(null)
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('Waiting to start')
  const [repoName, setRepoName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollTick = useRef(0)
  const pollStartedAt = useRef(0)
  const isPolling = useRef(false)

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current)
      pollTimer.current = null
    }
    isPolling.current = false
  }, [])

  const setProgressFromTick = useCallback((tick: number) => {
    const stageIndex = Math.min(STEP_LABELS.length - 1, Math.floor(tick / 2))
    const nextProgress = Math.min(90, 14 + tick * 7)
    setProgress((current) => (nextProgress > current ? nextProgress : current))
    setStatusMessage(STEP_LABELS[stageIndex])
  }, [])

  const startPolling = useCallback(
    (nextJobId: string) => {
      stopPolling()
      pollTick.current = 0
      pollStartedAt.current = Date.now()
      isPolling.current = true

      const poll = async () => {
        if (!isPolling.current) return
        try {
          if (Date.now() - pollStartedAt.current > MAX_POLL_DURATION_MS) {
            stopPolling()
            setStatus('failed')
            setError(
              'Analysis timed out on the frontend. Check backend logs and retry with a smaller repo.',
            )
            setStatusMessage('Analysis timed out')
            return
          }

          const response = await getAnalysisStatus(nextJobId)
          if (response.repo_name) {
            setRepoName(response.repo_name)
          }
          pollTick.current += 1
          setProgressFromTick(pollTick.current)

          if (response.status === 'completed') {
            stopPolling()
            setStatus('completed')
            setStatusMessage('📘 Generating intelligence wiki')
            setProgress(99)

            const wikiResponse = await getWiki(nextJobId)
            if (typeof wikiResponse.error === 'string') {
              throw new Error(wikiResponse.error)
            }
            setProgress(100)
            setStatusMessage('✅ Analysis Complete')
            await new Promise((resolve) => setTimeout(resolve, 900))
            setWiki(wikiResponse)
            return
          }

          if (response.status === 'failed') {
            stopPolling()
            setStatus('failed')
            setError(response.error || 'Analysis failed on backend.')
            setStatusMessage('Analysis failed')
            return
          }

          setStatus(response.status)
          setProgress((current) =>
            response.status === 'running' || response.status === 'pending'
              ? current >= 90
                ? Math.min(99, current + 1)
                : current
              : current,
          )
          pollTimer.current = setTimeout(() => {
            void poll()
          }, 2000)
        } catch (err) {
          stopPolling()
          setStatus('failed')
          setError(err instanceof Error ? err.message : 'Polling failed.')
          setStatusMessage('Analysis failed')
        }
      }

      void poll()
    },
    [setProgressFromTick, stopPolling],
  )

  const startAnalysis = useCallback(async () => {
    const repoPath = repoInput.trim()
    if (!repoPath) {
      setError('Enter a local path or GitHub URL.')
      return
    }

    stopPolling()
    setError(null)
    setWiki(null)
    setJobId(null)
    setStatus('pending')
    setProgress(8)
    setStatusMessage('📂 Scanning repository files')
    setRepoName(resolveRepoName(repoPath))

    try {
      const response = await analyzeRepository(repoPath)
      setJobId(response.job_id)
      startPolling(response.job_id)
    } catch (err) {
      setStatus('failed')
      setError(err instanceof Error ? err.message : 'Failed to start analysis.')
      setStatusMessage('Analysis failed')
    }
  }, [repoInput, startPolling, stopPolling])

  const startUploadedAnalysis = useCallback(
    async (repoPath: string, files: UploadedRepoFile[]) => {
      const trimmedPath = repoPath.trim()
      if (!trimmedPath) {
        setError('Enter a local path or GitHub URL.')
        return
      }
      if (files.length === 0) {
        setError('Select a repository folder that contains files to analyze.')
        return
      }

      stopPolling()
      setRepoInput(trimmedPath)
      setError(null)
      setWiki(null)
      setJobId(null)
      setStatus('pending')
      setProgress(8)
      setStatusMessage('Scanning repository files')
      setRepoName(resolveRepoName(trimmedPath))

      try {
        const response = await analyzeUploadedRepository(trimmedPath, files)
        setJobId(response.job_id)
        startPolling(response.job_id)
      } catch (err) {
        setStatus('failed')
        setError(err instanceof Error ? err.message : 'Failed to start analysis.')
        setStatusMessage('Analysis failed')
      }
    },
    [startPolling, stopPolling],
  )

  const resetAnalysis = useCallback(() => {
    stopPolling()
    setRepoInput('')
    setJobId(null)
    setWiki(null)
    setStatus('idle')
    setProgress(0)
    setStatusMessage('Waiting to start')
    setRepoName(null)
    setError(null)
  }, [stopPolling])

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  const steps = useMemo<AnalysisStep[]>(() => {
    return STEP_LABELS.map((label, index) => {
      const threshold = [20, 45, 70, 90][index]
      return {
        key: label,
        label,
        done: progress >= threshold,
        active:
          status !== 'completed' &&
          status !== 'failed' &&
          progress >= threshold - 20 &&
          progress < threshold,
      }
    })
  }, [progress, status])

  const value = useMemo<AnalysisContextValue>(
    () => ({
      repoInput,
      setRepoInput,
      jobId,
      wiki,
      status,
      isAnalyzing: status === 'pending' || status === 'running',
      progress,
      statusMessage,
      repoName,
      error,
      steps,
      startAnalysis,
      startUploadedAnalysis,
      resetAnalysis,
    }),
    [
      repoInput,
      jobId,
      wiki,
      status,
      progress,
      statusMessage,
      repoName,
      error,
      steps,
      startAnalysis,
      startUploadedAnalysis,
      resetAnalysis,
    ],
  )

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
}

function resolveRepoName(input: string): string {
  const trimmed = input.trim()
  const githubMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i,
  )
  if (githubMatch) {
    return `${githubMatch[1]}/${githubMatch[2]}`
  }

  const normalized = trimmed.replaceAll('\\', '/').replace(/\/+$/, '')
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? normalized
}
