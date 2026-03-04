import { Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

interface AnalyzeHeroProps {
  repoInput: string
  isRunning: boolean
  error: string | null
  onChange: (value: string) => void
  onAnalyze: () => void
}

export function AnalyzeHero({
  repoInput,
  isRunning,
  error,
  onChange,
  onAnalyze,
}: AnalyzeHeroProps) {
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
        <Input
          value={repoInput}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter local repository path or GitHub repository URL"
          disabled={isRunning}
        />
        <Button className="mt-4 w-full" onClick={onAnalyze} disabled={isRunning}>
          Analyze Repository
        </Button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </div>
  )
}
