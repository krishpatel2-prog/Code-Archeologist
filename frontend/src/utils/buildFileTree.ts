export type TreeNode = {
  name: string
  type: 'file' | 'folder'
  children?: TreeNode[]
}

const WINDOWS_ABSOLUTE = /^[a-zA-Z]:\//

function normalizeSlashes(path: string): string {
  return path.replaceAll('\\', '/').trim()
}

function splitPathSegments(rawPath: string): { absolute: boolean; segments: string[] } {
  const normalized = normalizeSlashes(rawPath)
  const absolute = WINDOWS_ABSOLUTE.test(normalized) || normalized.startsWith('/')
  const withoutDrive = normalized.replace(/^[a-zA-Z]:\//, '/')
  const segments = withoutDrive
    .split('/')
    .filter(Boolean)
    .filter((part) => part !== '.')

  return { absolute, segments }
}

function commonPrefix(paths: string[][]): string[] {
  if (paths.length === 0) return []
  const first = paths[0]
  let prefixLength = first.length

  for (const parts of paths.slice(1)) {
    let i = 0
    while (i < prefixLength && i < parts.length && parts[i] === first[i]) i += 1
    prefixLength = i
    if (prefixLength === 0) break
  }

  return first.slice(0, prefixLength)
}

function sortTree(node: TreeNode): void {
  if (!node.children || node.children.length === 0) return
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  node.children.forEach(sortTree)
}

export function buildFileTree(paths: string[]): TreeNode {
  const parsed = paths
    .filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
    .map(splitPathSegments)

  const absolutePaths = parsed.filter((entry) => entry.absolute).map((entry) => entry.segments)
  const absolutePrefix = commonPrefix(absolutePaths)

  const root: TreeNode = { name: 'root', type: 'folder', children: [] }

  for (const entry of parsed) {
    const segments = entry.absolute ? entry.segments.slice(absolutePrefix.length) : entry.segments
    if (segments.length === 0) continue

    let current = root
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]
      const isLeaf = index === segments.length - 1
      const nodeType: TreeNode['type'] = isLeaf ? 'file' : 'folder'

      if (!current.children) current.children = []

      let next = current.children.find((child) => child.name === segment)
      if (!next) {
        next = { name: segment, type: nodeType, children: nodeType === 'folder' ? [] : undefined }
        current.children.push(next)
      }

      if (!isLeaf && next.type !== 'folder') {
        next.type = 'folder'
        next.children = next.children ?? []
      }

      current = next
    }
  }

  sortTree(root)
  return root
}
