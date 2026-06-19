import { useRef, useState, type ChangeEvent } from 'react'
import { FolderOpen, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { API_BASE_URL, type UploadedRepoFile } from '../../services/api'
import { isLikelyLocalPath, isLocalApiBaseUrl } from '../../utils/repoInput'

interface AnalyzeHeroProps {
  repoInput: string
  isRunning: boolean
  error: string | null
  onChange: (value: string) => void
  onAnalyze: () => void
  onAnalyzeUploaded: (repoPath: string, files: UploadedRepoFile[]) => Promise<void>
}

export function AnalyzeHero({
  repoInput,
  isRunning,
  error,
  onChange,
  onAnalyze,
  onAnalyzeUploaded,
}: AnalyzeHeroProps) {
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const waitingForPickerRef = useRef(false)
  const [uploadFeedback, setUploadFeedback] = useState<{
    message: string
    processed: number
    total: number
  } | null>(null)
  const remoteBackend = !isLocalApiBaseUrl(API_BASE_URL)
  const typedLocalPathOnRemote = remoteBackend && isLikelyLocalPath(repoInput)
  const isBusy = isRunning || uploadFeedback !== null

  const handleAnalyze = () => {
    if (isBusy) return
    onAnalyze()
  }

  const handleBrowseDirectory = () => {
    if (isBusy) return
    waitingForPickerRef.current = true
    setUploadFeedback({
      message: 'Waiting for directory selection...',
      processed: 0,
      total: 1,
    })
    window.setTimeout(() => {
      if (waitingForPickerRef.current) {
        setUploadFeedback(null)
        waitingForPickerRef.current = false
      }
    }, 120000)
    folderInputRef.current?.click()
  }

  const handleDirectoryChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    waitingForPickerRef.current = false
    if (!selectedFiles || selectedFiles.length === 0) {
      event.target.value = ''
      setUploadFeedback(null)
      return
    }

    setUploadFeedback({
      message: 'Preparing repository...',
      processed: 0,
      total: selectedFiles.length,
    })
    await yieldToBrowser()

    try {
      const nextFiles = await collectUploadFiles(selectedFiles, (processed, total) => {
        setUploadFeedback({
          message: 'Preparing Python files...',
          processed,
          total,
        })
      })
      event.target.value = ''

      if (nextFiles.length === 0) {
        setUploadFeedback(null)
        return
      }

      const displayPath = deriveDisplayRepoPath(repoInput, nextFiles)
      onChange(displayPath)
      setUploadFeedback({
        message: 'Uploading files...',
        processed: nextFiles.length,
        total: nextFiles.length,
      })
      await onAnalyzeUploaded(displayPath, nextFiles)
    } finally {
      setUploadFeedback(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-300">
        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
        AI Code Archaeologist
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
        Understand Your Codebase in Minutes
      </h1>
      <p className="mt-3 text-sm text-slate-400 sm:text-base">
        Python codebases only for now. Architecture. Risk. Impact. Refactor Zones.
      </p>

      <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 shadow-[0_16px_32px_rgba(2,6,23,0.35)]">
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleDirectoryChange}
          disabled={isBusy}
          {...{ webkitdirectory: '', directory: '' }}
        />
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-600/80 bg-slate-900/35 p-4 text-left sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-100">Add local directory</p>
            <p className="mt-1 text-xs text-slate-400">
              Pick a local Python codebase directly when you want browser-based analysis.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={handleBrowseDirectory}
            disabled={isBusy}
          >
            <span className="inline-flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              {uploadFeedback ? 'Working...' : 'Add Local Directory'}
            </span>
          </Button>
        </div>
        {uploadFeedback ? (
          <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-left transition-all">
            <div className="flex items-center justify-between gap-3 text-xs text-emerald-100">
              <span>{uploadFeedback.message}</span>
              <span>
                {uploadFeedback.processed}/{uploadFeedback.total}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-1.5 rounded-full bg-emerald-400 transition-all duration-200"
                style={{
                  width: `${Math.max(
                    8,
                    Math.round((uploadFeedback.processed / Math.max(1, uploadFeedback.total)) * 100),
                  )}%`,
                }}
              />
            </div>
          </div>
        ) : null}
        <Input
          className="mt-4"
          value={repoInput}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Paste a GitHub URL of a Python codebase"
          disabled={isBusy}
        />
        <Button className="mt-4 w-full" onClick={handleAnalyze} disabled={isBusy}>
          {isBusy ? 'Working...' : 'Analyze Repository'}
        </Button>
        <div className="mt-4 border-t border-slate-700/70 pt-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Quick Python Demo Repos
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Click any Python-based repo below to paste it into the input for a quick recruiter-friendly demo.
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {DEMO_REPOS.map((repo) => (
              <button
                key={repo.url}
                type="button"
                onClick={() => onChange(repo.url)}
                disabled={isBusy}
                className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-left text-xs text-emerald-100 transition hover:border-emerald-400/50 hover:bg-emerald-500/16 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {repo.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {typedLocalPathOnRemote ? (
        <p className="mt-3 text-xs text-slate-500">
          Remote backends cannot read your device path directly. Use `Add Local Directory` above
          for browser-based analysis of a local Python codebase.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </div>
  )
}

const DEMO_REPOS = [
  {
    label: 'ReviewPilot',
    url: 'https://github.com/krishpatel2-prog/ReviewPilot',
  },
  {
    label: 'STYL Style Trend Your Look',
    url: 'https://github.com/krishpatel2-prog/STYL-Style-Trend-Your-Look',
  },
  {
    label: 'Code Archeologist',
    url: 'https://github.com/krishpatel2-prog/Code-Archeologist',
  },
]

function deriveDisplayRepoPath(
  currentInput: string,
  files: UploadedRepoFile[],
): string {
  const trimmed = currentInput.trim()
  if (trimmed && isLikelyLocalPath(trimmed)) {
    return trimmed
  }

  const firstPath = files[0]?.relativePath.replaceAll('\\', '/').trim()
  if (!firstPath) {
    return 'Uploaded Repository'
  }

  const rootFolder = firstPath.split('/')[0]
  return rootFolder || 'Uploaded Repository'
}

function shouldUploadPath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll('\\', '/')
  if (!normalized || normalized.startsWith('.')) return false

  const excluded = ['/.git/', '/.idea/', '/.venv/', '/venv/', '/__pycache__/', '/node_modules/', '/dist/', '/build/']
  const withBounds = `/${normalized}/`
  if (excluded.some((fragment) => withBounds.includes(fragment))) return false

  const fileName = normalized.split('/').pop()?.toLowerCase() ?? ''
  const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : ''
  const configFiles = new Set([
    '.env.example',
    'dockerfile',
    'pyproject.toml',
    'requirements.txt',
    'setup.cfg',
    'setup.py',
    'readme.md',
  ])
  const allowedExtensions = new Set(['.py', '.toml', '.yaml', '.yml', '.json', '.ini', '.cfg', '.md'])

  return configFiles.has(fileName) || allowedExtensions.has(extension)
}

async function collectUploadFiles(
  fileList: FileList,
  onProgress: (processed: number, total: number) => void,
): Promise<UploadedRepoFile[]> {
  const collected: UploadedRepoFile[] = []
  const chunkSize = 750

  for (let index = 0; index < fileList.length; index += 1) {
    const file = fileList[index]
    const relativePath = file.webkitRelativePath || file.name
    if (shouldUploadPath(relativePath)) {
      collected.push({ file, relativePath })
    }

    if (index % chunkSize === 0) {
      onProgress(index + 1, fileList.length)
      await yieldToBrowser()
    }
  }

  onProgress(fileList.length, fileList.length)
  return collected
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0)
  })
}
