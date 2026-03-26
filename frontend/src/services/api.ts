import type {
  AnalyzeResponse,
  AskResponse,
  ImpactResponse,
  StatusResponse,
  WikiResponse,
} from '../types/api'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

export type UploadedRepoFile = {
  file: File
  relativePath: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {})
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function analyzeRepository(repoPath: string): Promise<AnalyzeResponse> {
  return request('/analyze', {
    method: 'POST',
    body: JSON.stringify({ repo_path: repoPath }),
  })
}

export async function analyzeUploadedRepository(
  repoPath: string,
  files: UploadedRepoFile[],
): Promise<AnalyzeResponse> {
  const formData = new FormData()
  formData.append('repo_path', repoPath)
  files.forEach(({ file, relativePath }) => {
    formData.append('files', file)
    formData.append('relative_paths', relativePath)
  })

  return request('/analyze-upload', {
    method: 'POST',
    body: formData,
  })
}

export async function getAnalysisStatus(jobId: string): Promise<StatusResponse> {
  const payload = await request<Record<string, unknown>>(`/status/${jobId}`)
  const rawStatus = payload.status
  const backendError = typeof payload.error === 'string' ? payload.error : undefined

  if (backendError && !rawStatus) {
    if (backendError.toLowerCase() === 'job not found') {
      return {
        status: 'failed',
        error: 'Analysis session expired after backend restart. Please run analysis again.',
      }
    }
    throw new Error(backendError)
  }

  if (typeof rawStatus !== 'string') {
    throw new Error('Invalid status payload.')
  }

  const normalized = rawStatus.toLowerCase()
  if (normalized === 'processing') {
    return {
      status: 'running',
      repo_name: typeof payload.repo_name === 'string' ? payload.repo_name : undefined,
    }
  }
  if (normalized === 'queued') return { status: 'pending', repo_name: typeof payload.repo_name === 'string' ? payload.repo_name : undefined }
  if (normalized === 'pending') return { status: 'pending', repo_name: typeof payload.repo_name === 'string' ? payload.repo_name : undefined }
  if (normalized === 'running') return { status: 'running', repo_name: typeof payload.repo_name === 'string' ? payload.repo_name : undefined }
  if (normalized === 'completed') return { status: 'completed', repo_name: typeof payload.repo_name === 'string' ? payload.repo_name : undefined }
  if (normalized === 'failed') return { status: 'failed', error: backendError, repo_name: typeof payload.repo_name === 'string' ? payload.repo_name : undefined }

  throw new Error(`Invalid status payload: ${rawStatus}`)
}

export async function getWiki(jobId: string): Promise<WikiResponse> {
  return request(`/wiki/${jobId}`)
}

export async function askQuestion(jobId: string, question: string): Promise<AskResponse> {
  return request(`/ask/${jobId}`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  })
}

export async function getImpactAnalysis(
  jobId: string,
  targetFile: string,
): Promise<ImpactResponse> {
  const payload = await request<Record<string, unknown>>(`/impact/${jobId}`, {
    method: 'POST',
    body: JSON.stringify({ target_file: targetFile }),
  })

  if (typeof payload.error === 'string') {
    throw new Error(payload.error)
  }

  const direct = Array.isArray(payload.direct_dependents)
    ? payload.direct_dependents.filter((item): item is string => typeof item === 'string')
    : null
  const indirect = Array.isArray(payload.indirect_dependents)
    ? payload.indirect_dependents.filter((item): item is string => typeof item === 'string')
    : null
  const radius =
    typeof payload.total_impact_radius === 'number' ? payload.total_impact_radius : null

  if (!direct || !indirect || radius === null) {
    throw new Error('Invalid impact response payload.')
  }

  return {
    direct_dependents: direct,
    indirect_dependents: indirect,
    total_impact_radius: radius,
  }
}
