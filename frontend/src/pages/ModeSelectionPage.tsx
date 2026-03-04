import { Compass } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ModeCardGrid } from '../features/modes/ModeCardGrid'
import type { IntelligenceMode, WikiResponse } from '../types/api'

interface ModeSelectionPageProps {
  projectName: string
  wiki: WikiResponse
  onOpenMode: (mode: IntelligenceMode) => void
  onReset: () => void
}

export function ModeSelectionPage({ projectName, wiki, onOpenMode, onReset }: ModeSelectionPageProps) {
  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Intelligence Ready</p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-slate-100">
            <Compass className="h-5 w-5 text-emerald-400" />
            {projectName}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Choose a focused mode to inspect architecture intelligence.
          </p>
        </div>
        <Button variant="secondary" onClick={onReset}>
          Analyze Another Repository
        </Button>
      </div>
      <ModeCardGrid wiki={wiki} onSelect={onOpenMode} />
    </div>
  )
}
