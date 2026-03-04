import clsx from 'clsx'
import {
  ChevronRight,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { TreeNode } from '../utils/buildFileTree'

interface FileTreeProps {
  tree: TreeNode
  selectedFile?: string | null
  onFileClick?: (path: string) => void
}

function collectInitialExpanded(node: TreeNode, basePath = '', depth = 0): string[] {
  if (node.type !== 'folder' || !node.children?.length) return []
  const currentPath = basePath ? `${basePath}/${node.name}` : node.name
  const shouldExpand = depth <= 1
  const nested = node.children.flatMap((child) => collectInitialExpanded(child, currentPath, depth + 1))
  return shouldExpand ? [currentPath, ...nested] : nested
}

function fileIcon(name: string) {
  if (name.toLowerCase().endsWith('.py')) {
    return <FileCode2 className="h-4 w-4 shrink-0 text-emerald-300" />
  }
  return <FileText className="h-4 w-4 shrink-0 text-slate-400" />
}

export function FileTree({ tree, selectedFile, onFileClick }: FileTreeProps) {
  const initialExpanded = useMemo(
    () => new Set((tree.children ?? []).flatMap((child) => collectInitialExpanded(child))),
    [tree],
  )
  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded)
  useEffect(() => {
    setExpanded(initialExpanded)
  }, [initialExpanded])

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const nodes = tree.children ?? []
  if (nodes.length === 0) {
    return <p className="text-sm text-slate-400">No files were returned by the backend.</p>
  }

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <TreeRow
          key={node.name}
          node={node}
          nodePath={node.name}
          depth={0}
          expanded={expanded}
          selectedFile={selectedFile}
          onToggle={toggle}
          onFileClick={onFileClick}
        />
      ))}
    </div>
  )
}

interface TreeRowProps {
  node: TreeNode
  nodePath: string
  depth: number
  expanded: Set<string>
  selectedFile?: string | null
  onToggle: (path: string) => void
  onFileClick?: (path: string) => void
}

function TreeRow({
  node,
  nodePath,
  depth,
  expanded,
  selectedFile,
  onToggle,
  onFileClick,
}: TreeRowProps) {
  const paddingLeft = 10 + depth * 16

  if (node.type === 'folder') {
    const isExpanded = expanded.has(nodePath)
    return (
      <div>
        <button
          type="button"
          className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-200 transition-all hover:bg-slate-800"
          style={{ paddingLeft }}
          onClick={() => onToggle(nodePath)}
        >
          <ChevronRight
            className={clsx(
              'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200',
              isExpanded ? 'rotate-90' : '',
            )}
          />
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-amber-300" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-amber-300" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        <div
          className={clsx(
            'grid overflow-hidden transition-all duration-200 ease-out',
            isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="min-h-0">
            <div className="ml-3 border-l border-slate-700/60 pl-1">
              {(node.children ?? []).map((child) => {
                const childPath = `${nodePath}/${child.name}`
                return (
                  <TreeRow
                    key={childPath}
                    node={child}
                    nodePath={childPath}
                    depth={depth + 1}
                    expanded={expanded}
                    selectedFile={selectedFile}
                    onToggle={onToggle}
                    onFileClick={onFileClick}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isSelected = selectedFile === nodePath
  return (
    <button
      type="button"
      className={clsx(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-all hover:bg-slate-800',
        isSelected ? 'bg-slate-800 text-slate-100' : 'text-slate-300',
      )}
      style={{ paddingLeft: paddingLeft + 20 }}
      onClick={() => onFileClick?.(nodePath)}
    >
      {fileIcon(node.name)}
      <span className="truncate">{node.name}</span>
      {node.name.toLowerCase().endsWith('.py') ? (
        <span className="ml-auto rounded bg-emerald-900/45 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
          py
        </span>
      ) : null}
    </button>
  )
}
