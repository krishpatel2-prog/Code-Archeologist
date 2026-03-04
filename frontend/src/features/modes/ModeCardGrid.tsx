import { ChevronRight } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import type { IntelligenceMode, WikiResponse } from '../../types/api'
import { modeCards } from './modeCards'
import { getLayers } from '../../utils/wiki'
import { toRelativePath } from '../../utils/path'

interface ModeCardGridProps {
  wiki: WikiResponse
  onSelect: (mode: IntelligenceMode) => void
}

export function ModeCardGrid({ wiki, onSelect }: ModeCardGridProps) {
  const metrics = buildModeMetrics(wiki)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {modeCards.map((item) => {
        const Icon = item.icon
        return (
          <button key={item.mode} onClick={() => onSelect(item.mode)} className="text-left">
            <Card className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/45 hover:shadow-[0_16px_34px_rgba(16,185,129,0.15)]">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                <Icon className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
              <div className="mt-3 space-y-1 rounded-lg border border-slate-700/70 bg-slate-900/45 p-2 text-xs text-slate-300">
                {metrics[item.mode].map((line) => (
                  <p key={line} className="truncate">
                    {line}
                  </p>
                ))}
              </div>
              <div className="mt-4 flex items-center text-xs text-slate-500">
                Open mode
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </div>
            </Card>
          </button>
        )
      })}
    </div>
  )
}

function buildModeMetrics(wiki: WikiResponse): Record<IntelligenceMode, string[]> {
  const source = asObject(wiki)
  const architecture = asObject(source.architecture)
  const architectureStyle =
    readString(architecture, ['architecture_style', 'style']) || 'Unknown style'
  const layers = getLayers(wiki)

  const hotspots = asArray(source.hotspots).map(asObject)
  const highestHotspot = hotspots
    .map((item) => ({
      file: readString(item, ['file', 'path']),
      score: typeof item.score === 'number' ? item.score : 0,
    }))
    .sort((a, b) => b.score - a.score)[0]

  const graphMetrics = asObject(source.graph_metrics)
  const nodeCount =
    typeof graphMetrics.nodes === 'number'
      ? graphMetrics.nodes
      : asArray(source.modules).length
  const edgeCount =
    typeof graphMetrics.edges === 'number'
      ? graphMetrics.edges
      : Object.keys(asObject(source.impact_by_file)).length

  const refactorSafeCount = asArray(source.refactor_safe_zones).length

  const contextPaths = [
    ...asArray(source.modules)
      .map((module) => readString(asObject(module), ['file']))
      .filter(Boolean),
    highestHotspot?.file ?? '',
  ].filter(Boolean) as string[]

  return {
    'file-structure': [
      `Modules indexed: ${asArray(source.modules).length}`,
      `Directories mapped: ${countDirectories(contextPaths)}`,
    ],
    architecture: [
      `Style: ${architectureStyle}`,
      `Layers detected: ${layers.length}`,
    ],
    'risk-hotspots': [
      `Hotspots: ${hotspots.length}`,
      highestHotspot
        ? `Top risk: ${toRelativePath(highestHotspot.file, contextPaths)}`
        : 'Top risk: not available',
    ],
    impact: [
      `Graph nodes: ${nodeCount}`,
      `Graph edges: ${edgeCount}`,
    ],
    refactor: [
      `Safe modules: ${refactorSafeCount}`,
      `Dead-code candidates: ${asArray(source.dead_code_candidates).length}`,
    ],
    ask: [
      'Context-aware QA ready',
      `Wiki modules: ${asArray(source.modules).length}`,
    ],
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

function countDirectories(paths: string[]): number {
  const dirs = new Set<string>()
  paths.forEach((path) => {
    const normalized = path.replaceAll('\\', '/')
    const parts = normalized.split('/').filter(Boolean)
    if (parts.length > 1) dirs.add(parts.slice(0, -1).join('/'))
  })
  return dirs.size
}
