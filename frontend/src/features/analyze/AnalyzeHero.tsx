import { useRef, type ChangeEvent } from 'react'
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
  const remoteBackend = !isLocalApiBaseUrl(API_BASE_URL)
  const typedLocalPathOnRemote = remoteBackend && isLikelyLocalPath(repoInput)

  const handleAnalyze = () => {
    onAnalyze()
  }

  const handleBrowseDirectory = () => {
    folderInputRef.current?.click()
  }

  const handleDirectoryChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? [])
      .map((file) => {
        const relativePath = file.webkitRelativePath || file.name
        return { file, relativePath }
      })
      .filter(({ relativePath }) => shouldUploadPath(relativePath))

    event.target.value = ''

    if (nextFiles.length === 0) {
      return
    }

    const displayPath = deriveDisplayRepoPath(repoInput, nextFiles)
    onChange(displayPath)
    await onAnalyzeUploaded(displayPath, nextFiles)
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
          disabled={isRunning}
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
            disabled={isRunning}
          >
            <span className="inline-flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Add Local Directory
            </span>
          </Button>
        </div>
        <Input
          className="mt-4"
          value={repoInput}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Paste a GitHub URL of a Python codebase"
          disabled={isRunning}
        />
        <Button className="mt-4 w-full" onClick={handleAnalyze} disabled={isRunning}>
          Analyze Repository
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
                disabled={isRunning}
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
  return !excluded.some((fragment) => withBounds.includes(fragment))
}
