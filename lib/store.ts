/**
 * Zustand store — single source of truth for all client state.
 *
 * Auto-save: any state mutation calls triggerSave(), which debounces
 * a POST to /api/drive/save after 800ms of inactivity.
 */

import { create } from 'zustand'
import type { AppState, Property, PastSale, Assumptions, ChangeLogEntry } from '@/types'
import { DEFAULT_STATE, uid } from '@/types'

// ─── Save status ───────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface StoreState extends AppState {
  // UI state
  saveStatus: SaveStatus
  compareIds: string[]
  // Actions
  hydrate: (state: AppState) => void
  saveNow: () => Promise<void>
  // Properties
  addProperty: (p: Property) => void
  updateProperty: (id: string, patch: Partial<Property>) => void
  archiveProperty: (id: string, outcome: Property['outcome'], reason: string) => void
  duplicateProperty: (id: string) => Property
  // Past sales
  addPastSale: (s: PastSale) => void
  updatePastSale: (id: string, patch: Partial<PastSale>) => void
  // Compare
  toggleCompare: (id: string) => void
  clearCompare: () => void
  // Assumptions
  setAssumptions: (a: Partial<Assumptions>) => void
  // Changelog
  logChange: (pid: string, field: string, description: string, oldValue?: string, newValue?: string) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export const useStore = create<StoreState>((set, get) => ({
  ...DEFAULT_STATE,
  saveStatus: 'idle',

  // ── Hydrate from Drive on load ──────────────────────────────
  hydrate(state) {
    set({ ...state, saveStatus: 'idle' })
  },

  // ── Save to Drive via API route ─────────────────────────────
  async saveNow() {
    set({ saveStatus: 'saving' })
    try {
      const { saveStatus, hydrate, saveNow, addProperty, updateProperty,
              archiveProperty, duplicateProperty, addPastSale, updatePastSale,
              toggleCompare, clearCompare, setAssumptions, logChange, ...state } = get()
      const res = await fetch('/api/drive/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      })
      if (!res.ok) throw new Error('Save failed')
      set({ saveStatus: 'saved' })
      setTimeout(() => set({ saveStatus: 'idle' }), 2000)
    } catch {
      set({ saveStatus: 'error' })
    }
  },

  // ── Properties ─────────────────────────────────────────────
  addProperty(p) {
    set((s) => ({ properties: [p, ...s.properties] }))
    get().logChange(p.id, 'property', 'Property created')
    triggerSave(get)
  },

  updateProperty(id, patch) {
    set((s) => ({
      properties: s.properties.map((p) => p.id === id ? { ...p, ...patch } : p),
    }))
    triggerSave(get)
  },

  archiveProperty(id, outcome, reason) {
    set((s) => ({
      properties: s.properties.map((p) =>
        p.id === id
          ? { ...p, archived: true, outcome, archiveReason: reason, archivedDate: new Date().toISOString() }
          : p
      ),
      compareIds: s.compareIds.filter((cid) => cid !== id),
    }))
    get().logChange(id, 'archived', `Archived: ${outcome}`)
    triggerSave(get)
  },

  duplicateProperty(id) {
    const original = get().properties.find((p) => p.id === id)!
    const copy: Property = {
      ...JSON.parse(JSON.stringify(original)),
      id: uid(),
      address: `Copy of ${original.address}`,
      tags: [original.tags, 'Duplicate'].filter(Boolean).join(', '),
      archived: false,
      outcome: '',
      archiveReason: '',
      archivedDate: '',
    }
    set((s) => ({ properties: [copy, ...s.properties] }))
    get().logChange(copy.id, 'property', `Duplicated from ${original.address}`)
    triggerSave(get)
    return copy
  },

  // ── Past sales ─────────────────────────────────────────────
  addPastSale(s) {
    set((state) => ({ pastSales: [s, ...state.pastSales] }))
    triggerSave(get)
  },

  updatePastSale(id, patch) {
    set((state) => ({
      pastSales: state.pastSales.map((s) => s.id === id ? { ...s, ...patch } : s),
    }))
    triggerSave(get)
  },

  // ── Compare ────────────────────────────────────────────────
  toggleCompare(id) {
    set((s) => {
      const has = s.compareIds.includes(id)
      if (has) return { compareIds: s.compareIds.filter((x) => x !== id) }
      if (s.compareIds.length >= 5) return s
      return { compareIds: [...s.compareIds, id] }
    })
  },

  clearCompare() {
    set({ compareIds: [] })
  },

  // ── Assumptions ────────────────────────────────────────────
  setAssumptions(patch) {
    set((s) => ({ assumptions: { ...s.assumptions, ...patch } }))
    triggerSave(get)
  },

  // ── Changelog ──────────────────────────────────────────────
  logChange(pid, field, description, oldValue, newValue) {
    const entry: ChangeLogEntry = {
      id: uid(),
      pid,
      time: new Date().toISOString(),
      field,
      description,
      oldValue,
      newValue,
    }
    set((s) => ({ changelog: [entry, ...s.changelog].slice(0, 500) }))
  },
}))

// ─── Debounced auto-save ───────────────────────────────────────

function triggerSave(get: () => StoreState) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => get().saveNow(), 800)
}
