import { ArrowDown, Layers } from 'lucide-react'
import { Section } from '../../components/ui/Section'
import type { WikiResponse } from '../../types/api'
import { getArchitectureSummary, getLayers } from '../../utils/wiki'

interface ArchitectureOverviewViewProps {
  wiki: WikiResponse
}

export function ArchitectureOverviewView({ wiki }: ArchitectureOverviewViewProps) {
  const summary = getArchitectureSummary(wiki)
  const layers = getLayers(wiki)

  return (
    <Section
      title="Architecture Overview"
      subtitle="Layered system responsibilities and architecture-level rationale."
    >
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel-soft)] p-4">
        <p className="text-sm leading-7 text-slate-200">{summary}</p>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-slate-900/35 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-100">Layered Architecture Diagram</h3>
        <div className="mx-auto flex max-w-md flex-col items-center">
          {[
            'Presentation Layer',
            'Business Logic Layer',
            'Domain Model Layer',
            'Data Access Layer',
            'Infrastructure Layer',
          ].map((layer, index, list) => (
            <div key={layer} className="flex w-full flex-col items-center">
              <div className="w-full rounded-lg border border-slate-700 bg-slate-800/70 px-4 py-2 text-center text-sm text-slate-200 transition-all hover:border-emerald-500/45 hover:bg-slate-800">
                {layer}
              </div>
              {index < list.length - 1 ? (
                <ArrowDown className="my-1 h-4 w-4 text-slate-500" />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {layers.map((layer, index) => (
          <div key={layer.name} className="rounded-xl border border-[var(--color-border)] bg-slate-900/35 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Layers className="h-4 w-4 text-emerald-400" />
                {layer.name}
              </h3>
              <span className="text-xs text-slate-500">Layer {index + 1}</span>
            </div>
            <p className="text-sm text-slate-400">{layer.responsibility}</p>
          </div>
        ))}
        {layers.length === 0 ? (
          <p className="text-sm text-slate-400">No architecture layers available in wiki response.</p>
        ) : null}
      </div>
    </Section>
  )
}
