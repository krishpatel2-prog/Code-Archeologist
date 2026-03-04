import { FolderTree } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { FileTree } from '../../components/FileTree'
import { Badge } from '../../components/ui/Badge'
import { Section } from '../../components/ui/Section'
import type { WikiResponse } from '../../types/api'
import { buildFileTree } from '../../utils/buildFileTree'
import type { RiskLevel } from '../../utils/wiki'

interface FileStructureViewProps {
  wiki: WikiResponse
}

export function FileStructureView({ wiki }: FileStructureViewProps) {
  const paths = useMemo(() => extractPathList(wiki), [wiki])
  const tree = useMemo(() => buildFileTree(paths), [paths])
  const moduleSummaries = useMemo(() => extractModuleSummaries(wiki), [wiki])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  useEffect(() => {
    setSelectedFile(null)
  }, [paths])
  const selectedSummary = useMemo(
    () => resolveSummaryForFile(selectedFile, moduleSummaries),
    [moduleSummaries, selectedFile],
  )

  return (
    <Section
      id="file-structure-view"
      title="Repository Structure"
      subtitle="Interactive repository tree with relative paths, folder collapse, and file summaries."
    >
      <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-sm text-slate-300">
        <FolderTree className="h-4 w-4 text-emerald-400" />
        Preview File Structure
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
        <div className="rounded-xl border border-[var(--color-border)] bg-slate-900/30 p-3">
          <FileTree tree={tree} selectedFile={selectedFile} onFileClick={setSelectedFile} />
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel-soft)]/55 p-4">
          <h3 className="text-sm font-semibold text-slate-100">File Summary</h3>
          {!selectedFile ? (
            <p className="mt-3 text-sm text-slate-400">
              Select a file from the tree to view role, responsibility, and risk level.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="rounded-md bg-slate-900/45 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">File</p>
                <p className="mt-1 break-all text-sm text-slate-200">{selectedFile}</p>
              </div>

              <InfoRow label="Role" value={selectedSummary?.role ?? 'Not provided by backend'} />
              <InfoRow
                label="Responsibility"
                value={selectedSummary?.responsibility ?? 'Not provided by backend'}
              />
              <div className="grid grid-cols-2 gap-2">
                <MetricCard
                  label="Lines of code"
                  value={selectedSummary ? selectedSummary.metrics.linesOfCode : null}
                />
                <MetricCard
                  label="Functions"
                  value={selectedSummary ? selectedSummary.metrics.functionCount : null}
                />
                <MetricCard
                  label="Imports"
                  value={selectedSummary ? selectedSummary.metrics.importCount : null}
                />
                <MetricCard
                  label="Dependencies"
                  value={selectedSummary ? selectedSummary.metrics.dependencyCount : null}
                />
              </div>
              <div className="rounded-md border border-slate-700 bg-slate-900/45 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Risk Level</p>
                <div className="mt-2">
                  {selectedSummary?.risk ? (
                    <Badge risk={selectedSummary.risk} label={`${selectedSummary.risk} risk`} />
                  ) : (
                    <Badge label="Not provided" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}

type ModuleSummary = {
  file: string
  role: string
  responsibility: string
  risk: RiskLevel | null
  metrics: {
    linesOfCode: number
    functionCount: number
    importCount: number
    dependencyCount: number
  }
}

const asObject = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

function readString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function normalizeLookupPath(path: string): string {
  return path
    .replaceAll('\\', '/')
    .replace(/^[a-zA-Z]:\//, '')
    .replace(/^\/+/, '')
    .replace(/^\.\/+/, '')
}

function normalizeRisk(value: unknown): RiskLevel | null {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase()
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') return normalized
  return null
}

function extractPathList(wiki: WikiResponse): string[] {
  const source = asObject(wiki)

  const directList = asArray(
    source.filePaths ?? source.file_paths ?? source.fileTree ?? source.file_tree ?? source.file_structure,
  ).filter((item): item is string => typeof item === 'string' && item.trim().length > 0)

  if (directList.length > 0) return Array.from(new Set(directList))

  const modules = asArray(source.modules)
    .map((item) => readString(asObject(item), ['file', 'path']))
    .filter(Boolean)

  const hotspots = asArray(source.hotspots)
    .map((item) => readString(asObject(item), ['file', 'path']))
    .filter(Boolean)

  const deadCode = asArray(source.dead_code_candidates).filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  )

  const safeZones = asArray(source.refactor_safe_zones).filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  )

  return Array.from(new Set([...modules, ...hotspots, ...deadCode, ...safeZones]))
}

function extractModuleSummaries(wiki: WikiResponse): ModuleSummary[] {
  const source = asObject(wiki)
  return asArray(source.modules).map((entry) => {
    const item = asObject(entry)
    const metrics = asObject(item.metrics)
    return {
      file: readString(item, ['file', 'path']),
      role: readString(item, ['role']),
      responsibility: readString(item, ['responsibility', 'description']),
      risk: normalizeRisk(item.risk_level ?? item.risk),
      metrics: {
        linesOfCode:
          typeof metrics.lines_of_code === 'number' ? metrics.lines_of_code : 0,
        functionCount:
          typeof metrics.function_count === 'number' ? metrics.function_count : 0,
        importCount: typeof metrics.import_count === 'number' ? metrics.import_count : 0,
        dependencyCount:
          typeof metrics.dependency_count === 'number' ? metrics.dependency_count : 0,
      },
    }
  })
}

function resolveSummaryForFile(
  selectedFile: string | null,
  summaries: ModuleSummary[],
): ModuleSummary | null {
  if (!selectedFile) return null
  const selectedNormalized = normalizeLookupPath(selectedFile)

  return (
    summaries.find((summary) => {
      const normalized = normalizeLookupPath(summary.file)
      return normalized === selectedNormalized || normalized.endsWith(`/${selectedNormalized}`)
    }) ?? null
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/45 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/45 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-200">
        {value === null ? 'N/A' : value}
      </p>
    </div>
  )
}
