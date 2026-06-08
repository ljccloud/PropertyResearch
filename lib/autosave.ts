/**
 * useAutoSave — React hook that displays save status in the UI.
 *
 * Usage:
 *   const { label, colour } = useAutoSave()
 *
 * The store handles the actual debounced save; this hook just
 * exposes display-friendly values derived from saveStatus.
 */

import { useStore } from './store'

export function useAutoSave() {
  const status = useStore((s) => s.saveStatus)

  const map = {
    idle:   { label: '',         colour: 'transparent' },
    saving: { label: 'Saving…',  colour: 'var(--ink3)' },
    saved:  { label: '✓ Saved',  colour: 'var(--green)' },
    error:  { label: '⚠ Not saved', colour: 'var(--red)' },
  }

  return map[status]
}
