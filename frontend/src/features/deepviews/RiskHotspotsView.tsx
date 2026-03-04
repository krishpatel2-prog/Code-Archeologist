import { AlertTriangle } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Section } from '../../components/ui/Section'
import type { WikiResponse } from '../../types/api'
import { getHotspots } from '../../utils/wiki'
import { toRelativePath } from '../../utils/path'

interface RiskHotspotsViewProps {
  wiki: WikiResponse
}

export function RiskHotspotsView({ wiki }: RiskHotspotsViewProps) {
  const hotspots = getHotspots(wiki)
  const allPaths = hotspots.map((hotspot) => hotspot.file)
  const maxScore = Math.max(...hotspots.map((hotspot) => hotspot.score), 1)

  return (
    <Section
      title="Risk & Hotspots"
      subtitle="High-risk modules and score-weighted hotspots requiring attention."
    >
      <div className="space-y-3">
        {hotspots.map((hotspot) => (
          <article key={hotspot.file} className="rounded-xl border border-[var(--color-border)] bg-slate-900/35 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-100">
                  {toRelativePath(hotspot.file, allPaths)}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Hotspot score</span>
                <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200">
                  {hotspot.score}
                </span>
                <Badge label={`${hotspot.risk} risk`} risk={hotspot.risk} />
              </div>
            </div>
            <div className="mb-3">
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-500"
                  style={{ width: `${Math.max(8, (hotspot.score / maxScore) * 100)}%` }}
                />
              </div>
            </div>
            <p className="text-sm text-slate-400">{hotspot.reason}</p>
          </article>
        ))}
        {hotspots.length === 0 ? (
          <p className="text-sm text-slate-400">No hotspots were returned by backend wiki.</p>
        ) : null}
      </div>
    </Section>
  )
}
