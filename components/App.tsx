/**
 * App shell — bottom navigation + screen routing.
 * Each screen is a separate client component.
 *
 * TODO: Replace placeholders with the full screen components
 * (ported from the self-contained HTML version).
 */
'use client'
import { useState } from 'react'
import { SaveIndicator } from '@/components/layout/SaveIndicator'

type Screen = 'properties' | 'history' | 'pastsales' | 'compare' | 'assumptions'

const SCREENS: { id: Screen; label: string; icon: string }[] = [
  { id: 'properties', label: 'Properties', icon: 'ti-building' },
  { id: 'history',    label: 'History',    icon: 'ti-clock' },
  { id: 'pastsales',  label: 'Past Sales', icon: 'ti-receipt' },
  { id: 'compare',    label: 'Compare',    icon: 'ti-columns' },
  { id: 'assumptions',label: 'Assumptions',icon: 'ti-settings' },
]

const TITLES: Record<Screen, string> = {
  properties:  'Properties',
  history:     'History',
  pastsales:   'Past Sales',
  compare:     'Compare',
  assumptions: 'Assumptions',
}

export function App() {
  const [screen, setScreen] = useState<Screen>('properties')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: 430, margin: '0 auto', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)', padding: '12px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, paddingTop: 'max(12px, var(--safe-top))' }}>
        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 21 }}>{TITLES[screen]}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SaveIndicator />
          <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink2)' }}>
            <i className="ti ti-search" style={{ fontSize: 16 }} />
          </button>
        </div>
      </div>

      {/* Screen content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '12px 16px 90px' }}>
          <p style={{ color: 'var(--ink3)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
            {TITLES[screen]} screen — components to be wired in.
          </p>
        </div>
      </div>

      {/* Bottom nav */}
      <nav style={{ background: 'var(--cream)', borderTop: '1px solid var(--border)', display: 'flex', paddingBottom: 'calc(8px + var(--safe-bottom))', flexShrink: 0 }}>
        {SCREENS.map((s) => (
          <button key={s.id} onClick={() => setScreen(s.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 0 4px', border: 'none', background: 'none', cursor: 'pointer' }}>
            <i className={`ti ${s.icon}`} style={{ fontSize: 20, color: screen === s.id ? 'var(--accent)' : 'var(--ink3)' }} />
            <span style={{ fontSize: 10, color: screen === s.id ? 'var(--accent)' : 'var(--ink3)', letterSpacing: '0.02em' }}>{s.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
