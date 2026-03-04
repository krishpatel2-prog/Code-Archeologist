import type { HTMLAttributes, PropsWithChildren } from 'react'
import clsx from 'clsx'

type CardProps = PropsWithChildren<HTMLAttributes<HTMLElement>>

export function Card({ className, children, ...props }: CardProps) {
  return (
    <section
      className={clsx(
        'rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 shadow-[0_14px_30px_rgba(2,6,23,0.32)]',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  )
}
