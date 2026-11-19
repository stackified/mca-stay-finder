import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { DEFAULT_WEIGHTS, WEIGHT_KEYS, type WeightKey } from '@/lib/scoring'
import { useAppStore } from '@/store/useAppStore'

const LABEL: Record<WeightKey, string> = {
  placement: 'Placements',
  air: 'Air quality',
  cost: 'Cost',
  living: 'Living standard + housing',
}

/** Scoring weights (SPEC §6.2 D). Always sum to 100; others rebalance automatically. */
export function WeightsPopover() {
  const weights = useAppStore((s) => s.weights)
  const setWeight = useAppStore((s) => s.setWeight)
  const resetWeights = useAppStore((s) => s.resetWeights)
  const mode = useAppStore((s) => s.scoreMode)
  const setMode = useAppStore((s) => s.setScoreMode)
  const isDefault = WEIGHT_KEYS.every((k) => weights[k] === DEFAULT_WEIGHTS[k])
  const total = WEIGHT_KEYS.reduce((s, k) => s + weights[k], 0)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <SlidersHorizontal />
          Weights
          <span className="text-muted-foreground tabular-nums">
            {WEIGHT_KEYS.map((k) => weights[k]).join('/')}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Scoring weights</h3>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            Total {total}
          </span>
        </div>
        <div className="space-y-3">
          {WEIGHT_KEYS.map((k) => (
            <div key={k} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{LABEL[k]}</span>
                <span className="font-medium tabular-nums">{weights[k]}</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[weights[k]]}
                onValueChange={([v]) => v !== undefined && setWeight(k, v)}
                thumbLabels={[`${LABEL[k]} weight`]}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Moving one weight spreads the rest over the others, so the total stays 100.
        </p>

        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
          <Label htmlFor="score-mode" className="text-xs">
            Computed sub-scores
            <span className="block font-normal text-muted-foreground">
              {mode === 'seed'
                ? 'Off: research seed scores (SPEC §11.1)'
                : 'On: SPEC §10 formulas, relative to visible colleges'}
            </span>
          </Label>
          <Switch
            id="score-mode"
            checked={mode === 'computed'}
            onCheckedChange={(on) => setMode(on ? 'computed' : 'seed')}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          disabled={isDefault}
          onClick={resetWeights}
        >
          Reset to 40 / 25 / 20 / 15
        </Button>
      </PopoverContent>
    </Popover>
  )
}
