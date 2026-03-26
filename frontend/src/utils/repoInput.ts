const WINDOWS_ABSOLUTE_PATH = /^[a-zA-Z]:[\\/]/;
const UNIX_ABSOLUTE_PATH = /^\//;
const HOME_PATH = /^~[\\/]/;

export function isLikelyLocalPath(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^https?:\/\//i.test(trimmed)) return false
  return (
    WINDOWS_ABSOLUTE_PATH.test(trimmed) ||
    UNIX_ABSOLUTE_PATH.test(trimmed) ||
    HOME_PATH.test(trimmed)
  )
}

export function isLocalApiBaseUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.hostname === '127.0.0.1' ||
      url.hostname === 'localhost' ||
      url.hostname === '0.0.0.0'
    )
  } catch {
    return false
  }
}
