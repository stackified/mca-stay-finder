/** Status bar (SPEC §6.1). Counts and data dates come from the store in Phase 3. */
export function StatusBar() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-1.5 text-xs text-muted-foreground">
      <span>0 colleges · 0 cities · 0 stays match</span>
      <span>No data loaded yet</span>
    </footer>
  )
}
