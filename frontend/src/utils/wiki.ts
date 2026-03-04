import type { WikiResponse } from '../types/api'

export type RiskLevel = 'low' | 'medium' | 'high'

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileTreeNode[]
}

export interface LayerSummary {
  name: string
  responsibility: string
}

export interface HotspotSummary {
  file: string
  score: number
  reason: string
  risk: RiskLevel
}

export interface ImpactSummary {
  targetFile: string
  risk: RiskLevel
  directDependents: string[]
  indirectDependents: string[]
  explanation: string
}

export interface RefactorZoneSummary {
  area: string
  reason: string
}

const asObject = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const readString = (source: Record<string, unknown>, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return fallback
}

const normalizeRisk = (value: unknown): RiskLevel => {
  if (typeof value !== 'string') return 'medium'
  const lowered = value.toLowerCase()
  if (lowered === 'low' || lowered === 'medium' || lowered === 'high') return lowered
  return 'medium'
}

export function getProjectName(wiki: WikiResponse): string {
  const source = asObject(wiki)
  const explicit = readString(source, ['projectName', 'project_name', 'repo_name', 'name'])
  if (explicit) return explicit

  const moduleList = asArray(source.modules)
  const firstModule = asObject(moduleList[0])
  const firstFile = readString(firstModule, ['file'])
  const root = firstFile.split('/')[0]
  return root || 'Repository Intelligence'
}

export function getArchitectureSummary(wiki: WikiResponse): string {
  const source = asObject(wiki)
  const direct = readString(
    source,
    ['architectureSummary', 'architecture_summary', 'overview', 'summary'],
  )
  if (direct) return direct

  const architecture = asObject(source.architecture)
  const coreFlow = readString(architecture, ['core_flow', 'coreFlow'])
  const style = readString(architecture, ['architecture_style', 'style'])
  const observations = asArray(architecture.observations)
    .filter((item): item is string => typeof item === 'string')
    .join(' ')

  const composed = [style, coreFlow, observations].filter(Boolean).join(' | ')
  return composed || 'No architecture summary available.'
}

export function getLayers(wiki: WikiResponse): LayerSummary[] {
  const source = asObject(wiki)
  const architecture = asObject(source.architecture)
  const raw = asArray(
    source.layers ?? source.architecture_layers ?? architecture.layers ?? source.sections,
  )
  return raw.map((item, index) => {
    const row =
      typeof item === 'string'
        ? { name: item, responsibility: 'Layer identified by architecture analysis.' }
        : asObject(item)
    return {
      name: readString(row, ['name', 'layer', 'title'], `Layer ${index + 1}`),
      responsibility: readString(
        row,
        ['responsibility', 'description', 'details'],
        'No responsibility details provided.',
      ),
    }
  })
}

function parseTreeNode(input: unknown, parentPath = ''): FileTreeNode | null {
  const node = asObject(input)
  const name = readString(node, ['name', 'label', 'file', 'path'])
  if (!name) return null

  const path = readString(node, ['path'], parentPath ? `${parentPath}/${name}` : name)
  const childrenRaw = asArray(node.children)
  const children = childrenRaw
    .map((child) => parseTreeNode(child, path))
    .filter((child): child is FileTreeNode => Boolean(child))
  const type =
    typeof node.type === 'string'
      ? (node.type.toLowerCase() === 'folder' ? 'folder' : 'file')
      : children.length > 0
        ? 'folder'
        : 'file'

  return {
    name,
    path,
    type,
    children: children.length > 0 ? children : undefined,
  }
}

export function getFileTree(wiki: WikiResponse): FileTreeNode[] {
  const source = asObject(wiki)
  const rawNodes = asArray(source.fileTree ?? source.file_tree ?? source.tree ?? source.file_structure)
  const parsed = rawNodes
    .map((node) => parseTreeNode(node))
    .filter((node): node is FileTreeNode => Boolean(node))
  if (parsed.length > 0) return parsed

  // Derive a tree from file paths when backend does not provide file_tree directly.
  const modules = asArray(source.modules)
  const moduleFiles = modules
    .map((item) => readString(asObject(item), ['file']))
    .filter(Boolean)

  const hotspots = asArray(source.hotspots)
  const hotspotFiles = hotspots
    .map((item) => readString(asObject(item), ['file', 'path']))
    .filter(Boolean)

  const deadCode = asArray(source.dead_code_candidates).filter(
    (item): item is string => typeof item === 'string',
  )
  const safeZones = asArray(source.refactor_safe_zones).filter(
    (item): item is string => typeof item === 'string',
  )

  const allPaths = Array.from(new Set([...moduleFiles, ...hotspotFiles, ...deadCode, ...safeZones]))
  return buildTreeFromPaths(allPaths)
}

export function getHotspots(wiki: WikiResponse): HotspotSummary[] {
  const source = asObject(wiki)
  const raw = asArray(source.hotspots ?? source.risks ?? source.risk_hotspots)
  return raw.map((item) => {
    const row = asObject(item)
    const score = typeof row.score === 'number' ? row.score : 0
    return {
      file: readString(row, ['file', 'path', 'name'], 'unknown'),
      score,
      reason: readString(
        row,
        ['reason', 'description', 'details'],
        score > 0 ? `Hotspot score ${score} based on dependency graph centrality.` : 'No reason provided.',
      ),
      risk:
        typeof row.risk === 'string'
          ? normalizeRisk(row.risk)
          : score >= 80
            ? 'high'
            : score >= 50
              ? 'medium'
              : 'low',
    }
  })
}

export function getImpactReports(wiki: WikiResponse): Record<string, ImpactSummary> {
  const source = asObject(wiki)
  const rawImpact = asObject(source.impactByFile ?? source.impact_by_file ?? source.impact)
  const entries = Object.entries(rawImpact).map(([key, value]) => {
    const row = asObject(value)
    const targetFile = readString(row, ['targetFile', 'target_file', 'file'], key)
    return [
      key,
      {
        targetFile,
        risk: normalizeRisk(row.risk),
        directDependents: asArray(row.directDependents ?? row.direct_dependents).filter(
          (item): item is string => typeof item === 'string',
        ),
        indirectDependents: asArray(row.indirectDependents ?? row.indirect_dependents).filter(
          (item): item is string => typeof item === 'string',
        ),
        explanation: readString(
          row,
          ['explanation', 'details', 'summary'],
          'No impact explanation provided.',
        ),
      },
    ] as const
  })
  const explicit = Object.fromEntries(entries)
  if (Object.keys(explicit).length > 0) return explicit

  // Fallback: derive minimal impact entries from module files when explicit impact map is unavailable.
  const modules = asArray(source.modules)
  const derivedEntries: Array<[string, ImpactSummary]> = []
  modules.forEach((item) => {
    const row = asObject(item)
    const file = readString(row, ['file'])
    if (!file) return

    const risk = normalizeRisk(row.risk_level ?? row.risk)
    derivedEntries.push([
      file,
      {
        targetFile: file,
        risk,
        directDependents: [],
        indirectDependents: [],
        explanation: readString(
          row,
          ['responsibility', 'description'],
          'No dependency-level impact details were provided by backend.',
        ),
      },
    ])
  })

  return Object.fromEntries(derivedEntries)
}

export function getRefactorZones(wiki: WikiResponse): RefactorZoneSummary[] {
  const source = asObject(wiki)
  const raw = asArray(
    source.refactorSafeZones ??
      source.refactor_safe_zones ??
      source.safe_zones ??
      source.dead_code_candidates,
  )
  return raw.map((item, index) => {
    const row = typeof item === 'string' ? { area: item } : asObject(item)
    return {
      area: readString(row, ['area', 'path', 'name'], `Zone ${index + 1}`),
      reason: readString(
        row,
        ['reason', 'description', 'details'],
        'Marked as a likely lower-coupling refactor candidate by backend analysis.',
      ),
    }
  })
}

function buildTreeFromPaths(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode = { name: 'root', path: '', type: 'folder', children: [] }

  paths.forEach((path) => {
    const parts = path.split('/').filter(Boolean)
    let current = root
    let currentPath = ''

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isFile = index === parts.length - 1
      if (!current.children) current.children = []

      let next = current.children.find((child) => child.name === part)
      if (!next) {
        next = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
        }
        current.children.push(next)
      }

      current = next
    })
  })

  return root.children ?? []
}
