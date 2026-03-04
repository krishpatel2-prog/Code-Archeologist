export function normalizePath(path: string): string {
  return path
    .replaceAll('\\', '/')
    .replace(/^[a-zA-Z]:\//, '')
    .replace(/^\/+/, '')
    .replace(/^\.\/+/, '')
}

export function findCommonPathPrefix(paths: string[]): string {
  if (paths.length === 0) return ''
  const segments = paths.map((path) => normalizePath(path).split('/').filter(Boolean))
  const minLength = Math.min(...segments.map((parts) => parts.length))
  const common: string[] = []

  for (let i = 0; i < minLength; i += 1) {
    const token = segments[0][i]
    if (segments.every((parts) => parts[i] === token)) common.push(token)
    else break
  }

  return common.join('/')
}

export function toRelativePath(path: string, contextPaths: string[]): string {
  const normalized = normalizePath(path)
  if (!normalized) return path
  const prefix = findCommonPathPrefix(contextPaths)
  if (!prefix || prefix.split('/').length < 2) return normalized
  return normalized.startsWith(`${prefix}/`) ? normalized.slice(prefix.length + 1) : normalized
}
