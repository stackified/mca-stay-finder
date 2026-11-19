/**
 * Small, reusable filter controls. Every control is keyboard-operable (Radix) and labelled.
 * Value convention: `null` = filter off. Moving a slider back to its "off" end sets `null`.
 */
import { useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export function FilterRow({
  label,
  value,
  hint,
  active,
  onReset,
  disabled,
  children,
}: {
  label: string
  value?: ReactNode
  hint?: ReactNode
  active?: boolean
  onReset?: () => void
  disabled?: boolean
  children?: ReactNode
}) {
  return (
    <div className={cn('space-y-1.5 py-1.5', disabled && 'opacity-60')}>
      <div className="flex items-center gap-1 text-xs">
        <span className={cn('font-medium', active && 'text-primary')}>
          {active && (
            <span
              aria-hidden
              className="mr-1 inline-block size-1.5 rounded-full bg-blue-600 align-middle"
            />
          )}
          {label}
        </span>
        <span className="ml-auto text-muted-foreground tabular-nums">{value}</span>
        {active && onReset && (
          <button
            type="button"
            onClick={onReset}
            aria-label={`Reset ${label}`}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** "At least X": null = off (thumb at `min`). */
export function MinSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format = String,
  hint,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  min: number
  max: number
  step: number
  format?: (v: number) => string
  hint?: ReactNode
}) {
  return (
    <FilterRow
      label={label}
      value={value === null ? 'Any' : `≥ ${format(value)}`}
      active={value !== null}
      onReset={() => onChange(null)}
      hint={hint}
    >
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value ?? min]}
        onValueChange={([v]) => onChange(v === undefined || v <= min ? null : v)}
        thumbLabels={[`${label}, minimum`]}
      />
    </FilterRow>
  )
}

/** "At most X": null = no limit (thumb at `max`). */
export function MaxSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format = String,
  hint,
  children,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  min: number
  max: number
  step: number
  format?: (v: number) => string
  hint?: ReactNode
  children?: ReactNode
}) {
  return (
    <FilterRow
      label={label}
      value={value === null ? 'No limit' : `≤ ${format(value)}`}
      active={value !== null}
      onReset={() => onChange(null)}
      hint={hint}
    >
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value ?? max]}
        onValueChange={([v]) => onChange(v === undefined || v >= max ? null : v)}
        thumbLabels={[`${label}, maximum`]}
      />
      {children}
    </FilterRow>
  )
}

/** Two-thumb range; each end is null when at its bound. */
export function RangeSlider({
  label,
  low,
  high,
  onChange,
  min,
  max,
  step,
  format = String,
  hint,
}: {
  label: string
  low: number | null
  high: number | null
  onChange: (low: number | null, high: number | null) => void
  min: number
  max: number
  step: number
  format?: (v: number) => string
  hint?: ReactNode
}) {
  const active = low !== null || high !== null
  return (
    <FilterRow
      label={label}
      value={active ? `${format(low ?? min)} – ${format(high ?? max)}` : 'Any'}
      active={active}
      onReset={() => onChange(null, null)}
      hint={hint}
    >
      <Slider
        min={min}
        max={max}
        step={step}
        value={[low ?? min, high ?? max]}
        minStepsBetweenThumbs={1}
        onValueChange={([a, b]) =>
          onChange(a === undefined || a <= min ? null : a, b === undefined || b >= max ? null : b)
        }
        thumbLabels={[`${label}, minimum`, `${label}, maximum`]}
      />
    </FilterRow>
  )
}

// Full class names so Tailwind can see them.
const GRID_COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' } as const

export function CheckboxGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  allValues,
  defaultValues = allValues,
  columns = 2,
}: {
  label: string
  options: { value: T; label: ReactNode }[]
  value: readonly T[]
  onChange: (v: T[]) => void
  allValues: readonly T[]
  /** Owner default (e.g. IIIT off). "Changed" and "Reset" compare with this. */
  defaultValues?: readonly T[]
  columns?: 1 | 2 | 3
}) {
  const id = useId()
  const active = !(
    value.length === defaultValues.length && defaultValues.every((v) => value.includes(v))
  )
  return (
    <FilterRow label={label} active={active} onReset={() => onChange([...defaultValues])}>
      <fieldset aria-label={label} className={cn('grid gap-x-2 gap-y-1', GRID_COLS[columns])}>
        {options.map((o) => {
          const checked = value.includes(o.value)
          return (
            <div key={o.value} className="flex items-center gap-1.5">
              <Checkbox
                id={`${id}-${o.value}`}
                checked={checked}
                onCheckedChange={(c) =>
                  onChange(c ? [...value, o.value] : value.filter((v) => v !== o.value))
                }
              />
              <Label htmlFor={`${id}-${o.value}`} className="text-xs font-normal">
                {o.label}
              </Label>
            </div>
          )
        })}
      </fieldset>
    </FilterRow>
  )
}

export function ToggleRow({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: ReactNode
}) {
  const id = useId()
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className={cn('text-xs font-medium', checked && 'text-primary')}>
          {label}
        </Label>
        <Switch id={id} checked={checked} onCheckedChange={onChange} />
      </div>
      {hint && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Placeholder row for a filter whose data or phase is not ready yet. */
export function PendingRow({ label, reason }: { label: string; reason: string }) {
  return (
    <FilterRow label={label} value="Off" disabled>
      <p className="text-[11px] text-muted-foreground">{reason}</p>
    </FilterRow>
  )
}
