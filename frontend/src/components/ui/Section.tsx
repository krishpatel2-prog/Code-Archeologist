import type { PropsWithChildren } from 'react'
import { Card } from './Card'

interface SectionProps extends PropsWithChildren {
  title: string
  subtitle?: string
  id?: string
}

export function Section({ title, subtitle, children, id }: SectionProps) {
  return (
    <Card className="animate-fade-in" id={id}>
      <header className="mb-4">
        <h2 className="text-base font-semibold text-[var(--color-text)]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p> : null}
      </header>
      {children}
    </Card>
  )
}
