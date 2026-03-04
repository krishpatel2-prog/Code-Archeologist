import {
  BookCheck,
  BrainCircuit,
  CheckCircle2,
  FolderSearch,
  LoaderCircle,
  Network,
} from 'lucide-react'
import type { AnalysisStep } from '../../features/analysis/analysis-store'
import { Card } from '../../components/ui/Card'

interface AnalyzeProgressProps {
  progress: number
  statusMessage: string
  repoName: string | null
  steps: AnalysisStep[]
}

export function AnalyzeProgress({ progress, statusMessage, repoName, steps }: AnalyzeProgressProps) {
  const iconByStep: Record<string, typeof FolderSearch> = {
    '📂 Scanning repository files': FolderSearch,
    '🧠 Building dependency graph': BrainCircuit,
    '🏗 Detecting architecture patterns': Network,
    '📘 Generating intelligence wiki': BookCheck,
  }

  return (
    <Card className="mt-6 transition-all duration-300">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-300">{statusMessage}</p>
          {repoName ? (
            <p className="text-xs text-emerald-300/90">Analyzing repository: {repoName}</p>
          ) : null}
        </div>
        <p className="text-sm text-slate-400">{progress}%</p>
      </div>
      <div className="mb-4 h-2 rounded-full bg-slate-800">
        <div
          className="h-2 rounded-full bg-emerald-500 transition-all duration-700 ease-out"
          style={{ width: `${Math.max(8, progress)}%` }}
        />
      </div>
      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.key}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
              step.done || step.active ? 'bg-slate-900/55 ring-1 ring-emerald-700/40' : 'bg-slate-900/35'
            }`}
          >
            {(() => {
              const StepIcon = iconByStep[step.label] ?? FolderSearch
              return (
                <StepIcon
                  className={`h-4 w-4 ${
                    step.done || step.active ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                />
              )
            })()}
            {step.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <LoaderCircle
                className={`h-4 w-4 text-slate-500 ${step.active ? 'animate-spin text-emerald-400' : ''}`}
              />
            )}
            <span className={step.done || step.active ? 'text-slate-200' : 'text-slate-400'}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
