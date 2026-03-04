import { ArrowLeft } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ArchitectureOverviewView } from '../features/deepviews/ArchitectureOverviewView'
import { AskProjectView } from '../features/deepviews/AskProjectView'
import { FileStructureView } from '../features/deepviews/FileStructureView'
import { ImpactAnalysisView } from '../features/deepviews/ImpactAnalysisView'
import { RefactorSafeZonesView } from '../features/deepviews/RefactorSafeZonesView'
import { RiskHotspotsView } from '../features/deepviews/RiskHotspotsView'
import type { Message } from '../hooks/useAskChat'
import type { IntelligenceMode, WikiResponse } from '../types/api'

interface DeepViewPageProps {
  mode: IntelligenceMode
  wiki: WikiResponse
  jobId: string | null
  messages: Message[]
  isTyping: boolean
  onAsk: (question: string) => Promise<void>
  onBack: () => void
}

const modeTitle: Record<IntelligenceMode, string> = {
  'file-structure': 'Preview File Structure',
  architecture: 'Architecture Overview',
  'risk-hotspots': 'Risk & Hotspots',
  impact: 'Impact Analysis',
  refactor: 'Refactor Safe Zones',
  ask: 'Ask About Project',
}

export function DeepViewPage({
  mode,
  wiki,
  jobId,
  messages,
  isTyping,
  onAsk,
  onBack,
}: DeepViewPageProps) {
  return (
    <div key={mode} className="animate-fade-in transition-all duration-300">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Deep View</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-100">{modeTitle[mode]}</h1>
        </div>
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back To Modes
        </Button>
      </header>

      {mode === 'file-structure' ? <FileStructureView wiki={wiki} /> : null}
      {mode === 'architecture' ? <ArchitectureOverviewView wiki={wiki} /> : null}
      {mode === 'risk-hotspots' ? <RiskHotspotsView wiki={wiki} /> : null}
      {mode === 'impact' ? <ImpactAnalysisView wiki={wiki} jobId={jobId} /> : null}
      {mode === 'refactor' ? <RefactorSafeZonesView wiki={wiki} /> : null}
      {mode === 'ask' ? (
        <AskProjectView messages={messages} isTyping={isTyping} onSend={onAsk} />
      ) : null}
    </div>
  )
}
