import { forwardRef, type InputHTMLAttributes } from 'react'
import clsx from 'clsx'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={clsx(
          'h-11 w-full rounded-xl border border-[var(--color-border)] bg-slate-900/60 px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/20',
          className,
        )}
        {...props}
      />
    )
  },
)

Input.displayName = 'Input'
