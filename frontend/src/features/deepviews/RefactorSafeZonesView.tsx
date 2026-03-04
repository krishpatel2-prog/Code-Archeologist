import { ShieldCheck } from 'lucide-react'
import { Section } from '../../components/ui/Section'
import type { WikiResponse } from '../../types/api'
import { getHotspots, getRefactorZones } from '../../utils/wiki'
import { toRelativePath } from '../../utils/path'

interface RefactorSafeZonesViewProps {
  wiki: WikiResponse
}

export function RefactorSafeZonesView({ wiki }: RefactorSafeZonesViewProps) {
  const zones = getRefactorZones(wiki)
  const hotspots = getHotspots(wiki)
  const hotspotMap = new Map(hotspots.map((item) => [item.file, item.score]))
  const allPaths = zones.map((zone) => zone.area)
  const modules = extractModuleMetrics(wiki)

  return (
    <Section
      title="Refactor Safe Zones"
      subtitle="Lower-risk areas with cleaner boundaries and safer change surfaces."
    >
      <div className="space-y-3">
        {zones.map((zone) => {
          const metrics = modules.get(normalizePath(zone.area))
          const rawHotspotScore = hotspotMap.get(zone.area) ?? 0
          const dependencyCount = metrics?.dependencyCount ?? 0
          const couplingScore = Math.max(5, Math.min(100, rawHotspotScore + dependencyCount * 12))

          return (
          <article
            key={zone.area}
            className="rounded-xl border border-emerald-800/60 bg-emerald-900/18 p-4 transition-all hover:border-emerald-600 hover:bg-emerald-900/25"
          >
            <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              {toRelativePath(zone.area, allPaths)}
            </h3>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <MetricPill label="Coupling score" value={couplingScore} />
              <MetricPill label="Dependencies" value={dependencyCount} />
              <MetricPill label="Functions" value={metrics?.functionCount ?? 0} />
            </div>
            <p className="mt-3 text-sm text-emerald-100/85">{zone.reason}</p>
          </article>
        )})}
        {zones.length === 0 ? (
          <p className="text-sm text-slate-400">No safe zones were returned by backend wiki.</p>
        ) : null}
      </div>
    </Section>
  )
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-emerald-700/60 bg-emerald-900/30 px-2 py-1">
      <p className="text-[10px] uppercase tracking-wide text-emerald-300/70">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-emerald-100">{value}</p>
    </div>
  )
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^[a-zA-Z]:\//, '').replace(/^\/+/, '')
}

function extractModuleMetrics(wiki: WikiResponse): Map<string, { dependencyCount: number; functionCount: number }> {
  const source = asObject(wiki)
  const map = new Map<string, { dependencyCount: number; functionCount: number }>()
  asArray(source.modules).forEach((item) => {
    const row = asObject(item)
    const file = typeof row.file === 'string' ? normalizePath(row.file) : ''
    const metrics = asObject(row.metrics)
    if (!file) return
    map.set(file, {
      dependencyCount:
        typeof metrics.dependency_count === 'number' ? metrics.dependency_count : 0,
      functionCount:
        typeof metrics.function_count === 'number' ? metrics.function_count : 0,
    })
  })
  return map
}
