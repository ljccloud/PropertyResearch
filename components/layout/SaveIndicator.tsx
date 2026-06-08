'use client'
import { useAutoSave } from '@/lib/autosave'

export function SaveIndicator() {
  const { label, colour } = useAutoSave()
  if (!label) return null
  return (
    <span style={{ fontSize: 11, color: colour, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', transition: 'color 0.2s' }}>
      {label}
    </span>
  )
}
