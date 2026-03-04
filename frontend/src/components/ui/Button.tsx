import type { ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-accent)] text-slate-950 shadow-[0_10px_22px_rgba(16,185,129,0.26)] hover:bg-emerald-400',
  secondary:
    'bg-[var(--color-panel-soft)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-slate-700/80',
  ghost: 'text-[var(--color-muted)] hover:bg-slate-800/70',
}

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
