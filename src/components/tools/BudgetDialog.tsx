import { useId, useState } from 'react'
import { Calculator } from 'lucide-react'
import { ConfidenceBadge } from '@/components/common/SourcedValue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DEFAULT_FURNISHING, STAY_OPTION_LABEL, computeBudget, type StayOption } from '@/lib/budget'
import type { Range } from '@/types/domain'
import { useAppStore } from '@/store/useAppStore'

const lakh = (n: number) => `₹${(n / 100000).toFixed(2)} L`
const fmt = (r: Range) => (r.min === r.max ? lakh(r.min) : `${lakh(r.min)} – ${lakh(r.max)}`)
const selectCls = 'h-8 w-full rounded-md border bg-background px-2 text-xs'

/** Budget calculator (SPEC §6.5): stay type + 2/3 years → total incl. deposit, brokerage, furnishing. */
export function BudgetDialog() {
  const data = useAppStore((s) => s.data)
  const selectedId = useAppStore((s) => s.selectedCollegeId)
  const id = useId()
  const cities = (data?.cities.data ?? []).filter((c) => c.costs && !c.excluded)
  const selectedCollege = data?.colleges.data.find((c) => c.id === selectedId)

  const [cityId, setCityId] = useState<string>('')
  const [option, setOption] = useState<StayOption>('pg_double')
  const [years, setYears] = useState<2 | 3 | null>(null)
  const [furnishing, setFurnishing] = useState<string>('')

  // Defaults follow the selected college until the owner changes them.
  const effectiveCity = cityId || selectedCollege?.cityId || cities[0]?.id || ''
  const effectiveYears: 2 | 3 = years ?? selectedCollege?.durationYears.value ?? 2
  const furnishingNum =
    furnishing === '' ? DEFAULT_FURNISHING[option] : Math.max(0, Number(furnishing) || 0)
  const city = cities.find((c) => c.id === effectiveCity)
  const result = city ? computeBudget(city, option, effectiveYears, furnishingNum) : null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Calculator />
          Budget
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Budget calculator</DialogTitle>
          <DialogDescription>
            Total cost of living for the whole MCA, from the SPEC §11 cost estimates.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <Label htmlFor={`${id}-city`} className="text-xs">
              City
            </Label>
            <select
              id={`${id}-city`}
              className={selectCls}
              value={effectiveCity}
              onChange={(e) => setCityId(e.target.value)}
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-opt`} className="text-xs">
              Stay
            </Label>
            <select
              id={`${id}-opt`}
              className={selectCls}
              value={option}
              onChange={(e) => {
                setOption(e.target.value as StayOption)
                setFurnishing('')
              }}
            >
              {(Object.keys(STAY_OPTION_LABEL) as StayOption[]).map((o) => (
                <option key={o} value={o}>
                  {STAY_OPTION_LABEL[o]}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="space-y-1">
            <legend className="mb-1 text-xs font-medium">Duration</legend>
            <div className="flex gap-3">
              {([2, 3] as const).map((y) => (
                <label key={y} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name={`${id}-years`}
                    checked={effectiveYears === y}
                    onChange={() => setYears(y)}
                  />
                  {y} years
                </label>
              ))}
            </div>
            {selectedCollege?.durationYears.value && years === null && (
              <p className="text-[10px] text-muted-foreground">From {selectedCollege.name}</p>
            )}
          </fieldset>
          <div className="space-y-1">
            <Label htmlFor={`${id}-furn`} className="text-xs">
              One-time furnishing ₹ (your estimate)
            </Label>
            <Input
              id={`${id}-furn`}
              inputMode="numeric"
              className="h-8 text-xs"
              value={furnishing}
              placeholder={String(DEFAULT_FURNISHING[option])}
              onChange={(e) => setFurnishing(e.target.value.replace(/[^\d]/g, ''))}
            />
          </div>
        </div>

        {result ? (
          <table className="w-full text-xs" aria-label="Budget breakdown">
            <tbody className="divide-y">
              <tr>
                <td className="py-1 text-muted-foreground">All-in per month</td>
                <td className="py-1 text-right tabular-nums">
                  ₹{result.monthlyAllIn.min.toLocaleString('en-IN')} – ₹
                  {result.monthlyAllIn.max.toLocaleString('en-IN')}
                </td>
              </tr>
              <tr>
                <td className="py-1 text-muted-foreground">Living × {result.months} months</td>
                <td className="py-1 text-right tabular-nums">{fmt(result.livingTotal)}</td>
              </tr>
              <tr>
                <td className="py-1 text-muted-foreground">Deposit (usually refundable)</td>
                <td className="py-1 text-right tabular-nums">{fmt(result.deposit)}</td>
              </tr>
              <tr>
                <td className="py-1 text-muted-foreground">Brokerage</td>
                <td className="py-1 text-right tabular-nums">{fmt(result.brokerage)}</td>
              </tr>
              <tr>
                <td className="py-1 text-muted-foreground">Furnishing</td>
                <td className="py-1 text-right tabular-nums">{lakh(result.furnishing)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="py-1">
                  <span className="inline-flex items-center gap-1">
                    Total
                    <ConfidenceBadge
                      sourced={{
                        confidence: 'estimate',
                        source: `SPEC §11.3–11.5 cost tables for ${city?.name}; deposit/brokerage from the city's typical months; furnishing is your estimate`,
                        asOf: '2026-11',
                      }}
                    />
                  </span>
                </td>
                <td className="py-1 text-right tabular-nums">{fmt(result.total)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-muted-foreground">No cost data for this city.</p>
        )}
        {result && (
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
            {result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
