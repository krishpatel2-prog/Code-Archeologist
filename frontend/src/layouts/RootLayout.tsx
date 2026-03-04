import type { PropsWithChildren } from 'react'

export function RootLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8">{children}</div>
    </div>
  )
}
