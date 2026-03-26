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
  const useUploadedLocalFolder = isLikelyLocalPath(repoInput) && !isLocalApiBaseUrl(API_BASE_URL)

  const handleAnalyze = () => {
    if (useUploadedLocalFolder) {
      folderInputRef.current?.click()
      return
    }
    onAnalyze()
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

    await onAnalyzeUploaded(repoInput, nextFiles)
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
        Architecture. Risk. Impact. Refactor Zones.
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
        <Input
          value={repoInput}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter local repository path or GitHub repository URL"
          disabled={isRunning}
        />
        <Button className="mt-4 w-full" onClick={handleAnalyze} disabled={isRunning}>
          {useUploadedLocalFolder ? (
            <span className="inline-flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Choose Folder And Analyze
            </span>
          ) : (
            'Analyze Repository'
          )}
        </Button>
      </div>
      {useUploadedLocalFolder ? (
        <p className="mt-3 text-xs text-slate-500">
          Deployed backends cannot read your device path directly. Selecting the folder uploads it
          for analysis while preserving the same analysis flow.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </div>
  )
}

function shouldUploadPath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll('\\', '/')
  if (!normalized || normalized.startsWith('.')) return false

  const excluded = ['/.git/', '/.idea/', '/.venv/', '/venv/', '/__pycache__/', '/node_modules/', '/dist/', '/build/']
  const withBounds = `/${normalized}/`
  return !excluded.some((fragment) => withBounds.includes(fragment))
}
