import clsx from 'clsx'
import type { RiskLevel } from '../../utils/wiki'

interface BadgeProps {
  label: string
  risk?: RiskLevel
}

const riskClass: Record<RiskLevel, string> = {
  low: 'border-emerald-800 bg-emerald-900/35 text-emerald-300',
  medium: 'border-amber-800 bg-amber-900/30 text-amber-300',
  high: 'border-rose-800 bg-rose-900/30 text-rose-300',
}

export function Badge({ label, risk }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
        risk ? riskClass[risk] : 'border-slate-700 bg-slate-800 text-slate-300',
      )}
    >
      {label}
    </span>
  )
}
