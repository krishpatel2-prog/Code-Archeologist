import { ChevronDown, ChevronRight, FileCode2, Folder } from 'lucide-react'
import { useState } from 'react'
import type { FileTreeNode } from '../../utils/wiki'

interface TreeNodeProps {
  node: FileTreeNode
  depth?: number
}

export function TreeNode({ node, depth = 0 }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true)

  if (node.type === 'folder') {
    return (
      <div>
        <button
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-200 transition hover:bg-slate-700/50"
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          <Folder className="h-4 w-4 text-emerald-400/90" />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-300 transition hover:bg-slate-700/40"
      style={{ paddingLeft: `${depth * 14 + 34}px` }}
    >
      <FileCode2 className="h-4 w-4 text-slate-400" />
      <span className="truncate">{node.name}</span>
    </div>
  )
}
