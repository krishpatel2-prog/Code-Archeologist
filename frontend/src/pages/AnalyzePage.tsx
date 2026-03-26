import { AnalyzeHero } from '../features/analyze/AnalyzeHero'
import { AnalyzeProgress } from '../features/analyze/AnalyzeProgress'
import type { AnalysisStep } from '../features/analysis/analysis-store'
import type { UploadedRepoFile } from '../services/api'

interface AnalyzePageProps {
  repoInput: string
  progress: number
  statusMessage: string
  repoName: string | null
  steps: AnalysisStep[]
  isRunning: boolean
  error: string | null
  onChangeInput: (value: string) => void
  onAnalyze: () => void
  onAnalyzeUploaded: (repoPath: string, files: UploadedRepoFile[]) => Promise<void>
}

export function AnalyzePage({
  repoInput,
  progress,
  statusMessage,
  repoName,
  steps,
  isRunning,
  error,
  onChangeInput,
  onAnalyze,
  onAnalyzeUploaded,
}: AnalyzePageProps) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
      <div className="w-full max-w-3xl animate-fade-in">
        <AnalyzeHero
          repoInput={repoInput}
          isRunning={isRunning}
          error={error}
          onChange={onChangeInput}
          onAnalyze={onAnalyze}
          onAnalyzeUploaded={onAnalyzeUploaded}
        />
        {isRunning ? (
          <AnalyzeProgress
            progress={progress}
            statusMessage={statusMessage}
            repoName={repoName}
            steps={steps}
          />
        ) : null}
      </div>
    </div>
  )
}
