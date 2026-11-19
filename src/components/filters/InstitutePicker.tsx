import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { College } from '@/types/domain'
import { FilterRow } from './controls'

/** Searchable multi-select of institutes (SPEC §6.2 A). Empty selection = all. */
export function InstitutePicker({
  colleges,
  value,
  onChange,
}: {
  colleges: readonly College[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const id = useId()
  const q = query.trim().toLowerCase()
  const shown = colleges.filter((c) => !q || `${c.name} ${c.cityId}`.toLowerCase().includes(q))
  const summary =
    value.length === 0
      ? 'All'
      : value.length === 1
        ? colleges.find((c) => c.id === value[0])?.name
        : `${value.length} selected`

  return (
    <FilterRow label="Specific institutes" active={value.length > 0} onReset={() => onChange([])}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between text-xs font-normal"
          >
            <span className="truncate">{summary}</span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <Input
            autoFocus
            placeholder="Search institutes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-2 h-8 text-xs"
            aria-label="Search institutes"
          />
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {shown.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-${c.id}`}
                  checked={value.includes(c.id)}
                  onCheckedChange={(on) =>
                    onChange(on ? [...value, c.id] : value.filter((x) => x !== c.id))
                  }
                />
                <Label htmlFor={`${id}-${c.id}`} className="text-xs font-normal">
                  {c.name} <span className="text-muted-foreground">({c.type})</span>
                </Label>
              </li>
            ))}
            {shown.length === 0 && <li className="text-xs text-muted-foreground">No match</li>}
          </ul>
          {value.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full text-xs"
              onClick={() => onChange([])}
            >
              Clear (show all)
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </FilterRow>
  )
}
