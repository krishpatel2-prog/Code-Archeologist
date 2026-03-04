import {
  AlertTriangle,
  Bot,
  FolderTree,
  Network,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import type { IntelligenceMode } from '../../types/api'

export interface ModeCardData {
  mode: IntelligenceMode
  title: string
  description: string
  icon: typeof FolderTree
}

export const modeCards: ModeCardData[] = [
  {
    mode: 'file-structure',
    title: 'Preview File Structure',
    description: 'Navigate core repository structure through a clean collapsible tree.',
    icon: FolderTree,
  },
  {
    mode: 'architecture',
    title: 'Architecture Overview',
    description: 'Review layered responsibilities and system-level architecture signals.',
    icon: Workflow,
  },
  {
    mode: 'risk-hotspots',
    title: 'Risk & Hotspots',
    description: 'Identify concentrated risk areas with hotspot score visibility.',
    icon: AlertTriangle,
  },
  {
    mode: 'impact',
    title: 'Impact Analysis',
    description: 'Inspect direct and indirect dependency blast radius before changes.',
    icon: Network,
  },
  {
    mode: 'refactor',
    title: 'Refactor Safe Zones',
    description: 'Find low-risk zones where changes are safer and easier to isolate.',
    icon: ShieldCheck,
  },
  {
    mode: 'ask',
    title: 'Ask About Project',
    description: 'Query architecture intelligence using context-aware assistant responses.',
    icon: Bot,
  },
]
