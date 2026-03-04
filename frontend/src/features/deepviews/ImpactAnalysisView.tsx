import { ArrowRight, FileCode2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Section } from '../../components/ui/Section'
import { getImpactAnalysis } from '../../services/api'
import type { ImpactResponse, WikiResponse } from '../../types/api'
import { toRelativePath } from '../../utils/path'

interface ImpactAnalysisViewProps {
  wiki: WikiResponse
  jobId: string | null
}

export function ImpactAnalysisView({ wiki, jobId }: ImpactAnalysisViewProps) {
  const fileOptions = useMemo(() => extractTargetFiles(wiki), [wiki])
  const [selectedFile, setSelectedFile] = useState('')
  const [targetFile, setTargetFile] = useState('')
  const [impact, setImpact] = useState<ImpactResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const first = fileOptions[0] ?? ''
    setSelectedFile(first)
    setTargetFile('')
    setImpact(null)
    setError(null)
    setIsLoading(false)
  }, [fileOptions, jobId])

  const contextPaths = useMemo(
    () => [targetFile, ...(impact?.direct_dependents ?? []), ...(impact?.indirect_dependents ?? [])],
    [impact, targetFile],
  )

  const analyze = async () => {
    if (!jobId) {
      setError('Job ID is missing. Re-run analysis first.')
      return
    }
    if (!selectedFile) {
      setError('Select a file to analyze.')
      return
    }

    setIsLoading(true)
    setError(null)
    setImpact(null)

    try {
      const response = await getImpactAnalysis(jobId, selectedFile)
      setTargetFile(selectedFile)
      setImpact(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze impact.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Section
      title="Impact Analysis"
      subtitle="Dependency blast radius and change-risk explanation for selected targets."
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={selectedFile}
          onChange={(event) => setSelectedFile(event.target.value)}
          disabled={fileOptions.length === 0}
          className="h-10 rounded-xl border border-[var(--color-border)] bg-slate-900/60 px-3 text-sm text-slate-200 outline-none disabled:opacity-60"
        >
          {fileOptions.map((item) => (
            <option key={item} value={item}>
              {toRelativePath(item, [item, ...fileOptions])}
            </option>
          ))}
        </select>
        <Button onClick={analyze} disabled={!selectedFile || isLoading || !jobId}>
          {isLoading ? 'Analyzing...' : 'Analyze Impact'}
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-800/70 bg-rose-950/30 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {!impact && !error ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-slate-900/35 p-4 text-sm text-slate-400">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-800" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-slate-800" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-800" />
            </div>
          ) : (
            'No impact profile available for this file.'
          )}
        </div>
      ) : null}

      {impact ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel-soft)] p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Target File</p>
            <p className="mt-1 text-sm text-slate-200">{toRelativePath(targetFile, contextPaths)}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel-soft)] p-3 text-sm text-slate-300">
            Total impact radius: {impact.total_impact_radius}
          </div>
          <DependencyList
            title="Direct Dependents"
            items={impact.direct_dependents}
            contextPaths={contextPaths}
          />
          <DependencyList
            title="Indirect Dependents"
            items={impact.indirect_dependents}
            contextPaths={contextPaths}
          />
          <DependencyChain
            target={targetFile}
            direct={impact.direct_dependents}
            indirect={impact.indirect_dependents}
            contextPaths={contextPaths}
          />
        </div>
      ) : null}
    </Section>
  )
}

function DependencyList({
  title,
  items,
  contextPaths,
}: {
  title: string
  items: string[]
  contextPaths: string[]
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel-soft)] p-4">
      <h4 className="mb-2 text-sm font-semibold text-slate-100">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">No dependencies found.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={`${title}-${item}`}>
              <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/45 px-3 py-2 text-sm text-slate-300 transition-all hover:bg-slate-800">
                <FileCode2 className="h-4 w-4 shrink-0 text-emerald-300" />
                <span className="break-all">{toRelativePath(item, contextPaths)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DependencyChain({
  target,
  direct,
  indirect,
  contextPaths,
}: {
  target: string
  direct: string[]
  indirect: string[]
  contextPaths: string[]
}) {
  const directSample = direct.slice(0, 2)
  const indirectSample = indirect.slice(0, 2)
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel-soft)] p-4">
      <h4 className="mb-3 text-sm font-semibold text-slate-100">Change Propagation Chain</h4>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ChainNode label={toRelativePath(target, contextPaths)} tone="emerald" />
        <ArrowRight className="h-4 w-4 text-slate-500" />
        <ChainNode
          label={
            directSample.length > 0
              ? directSample.map((item) => toRelativePath(item, contextPaths)).join(', ')
              : 'No direct dependents'
          }
          tone="amber"
        />
        <ArrowRight className="h-4 w-4 text-slate-500" />
        <ChainNode
          label={
            indirectSample.length > 0
              ? indirectSample.map((item) => toRelativePath(item, contextPaths)).join(', ')
              : 'No indirect dependents'
          }
          tone="rose"
        />
      </div>
    </div>
  )
}

function ChainNode({ label, tone }: { label: string; tone: 'emerald' | 'amber' | 'rose' }) {
  const toneClass: Record<'emerald' | 'amber' | 'rose', string> = {
    emerald: 'border-emerald-700/70 bg-emerald-900/20 text-emerald-100',
    amber: 'border-amber-700/70 bg-amber-900/20 text-amber-100',
    rose: 'border-rose-700/70 bg-rose-900/20 text-rose-100',
  }

  return (
    <div className={`rounded-md border px-3 py-1.5 ${toneClass[tone]}`}>
      <span className="break-all">{label}</span>
    </div>
  )
}

function extractTargetFiles(wiki: WikiResponse): string[] {
  const source = asObject(wiki)
  const modules = asArray(source.modules)
    .map((item) => {
      const row = asObject(item)
      return typeof row.file === 'string' ? row.file : ''
    })
    .filter((item): item is string => item.trim().length > 0)

  return Array.from(new Set(modules))
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}
