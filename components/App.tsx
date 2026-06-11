'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { SaveIndicator } from '@/components/layout/SaveIndicator'
import { PropertiesScreen } from '@/components/screens/PropertiesScreen'
import { HistoryScreen } from '@/components/screens/HistoryScreen'
import { PastSalesScreen } from '@/components/screens/PastSalesScreen'
import { CompareScreen } from '@/components/screens/CompareScreen'
import { AssumptionsScreen } from '@/components/screens/AssumptionsScreen'
import { PropertyDetail } from '@/components/screens/PropertyDetail'

type Screen = 'properties' | 'history' | 'pastsales' | 'compare' | 'assumptions'

const NAV: { id: Screen; label: string; icon: string }[] = [
  { id: 'properties',  label: 'Properties',  icon: 'ti-building' },
  { id: 'history',     label: 'History',     icon: 'ti-clock' },
  { id: 'pastsales',   label: 'Past Sales',  icon: 'ti-receipt' },
  { id: 'compare',     label: 'Compare',     icon: 'ti-columns' },
  { id: 'assumptions', label: 'Assumptions', icon: 'ti-settings' },
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
  const [detailId, setDetailId] = useState<string | null>(null)
  const [gsOpen, setGsOpen] = useState(false)
  const [gsQuery, setGsQuery] = useState('')
  const compareIds = useStore(s => s.compareIds)
  const properties = useStore(s => s.properties)
  const pastSales = useStore(s => s.pastSales)

  // Global search results
  const gsResults = gsQuery.trim().length > 0 ? [
    ...properties.filter(p => !p.archived && (p.address + ' ' + p.postcode + ' ' + (p.tags||'')).toLowerCase().includes(gsQuery.toLowerCase()))
      .map(p => ({ icon: 'ti-building', addr: p.address, meta: p.postcode, screen: 'Property', action: () => { setDetailId(p.id); setGsOpen(false) } })),
    ...properties.filter(p => p.archived && (p.address + ' ' + p.postcode).toLowerCase().includes(gsQuery.toLowerCase()))
      .map(p => ({ icon: 'ti-clock', addr: p.address, meta: p.postcode + ' · ' + p.outcome, screen: 'History', action: () => { setDetailId(p.id); setGsOpen(false) } })),
    ...pastSales.filter(s => (s.address + ' ' + s.postcode).toLowerCase().includes(gsQuery.toLowerCase()))
      .map(s => ({ icon: 'ti-receipt', addr: s.address, meta: s.postcode, screen: 'Past Sale', action: () => { setScreen('pastsales'); setGsOpen(false) } })),
  ] : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: 600, margin: '0 auto', overflow: 'hidden', position: 'relative' }}>

      {/* Top bar */}
      <div style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)', padding: '12px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, paddingTop: 'max(12px,env(safe-area-inset-top,12px))' }}>
        <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 21, letterSpacing: '-0.01em' }}>{TITLES[screen]}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SaveIndicator />
          <button onClick={() => { setGsOpen(true); setGsQuery('') }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink2)' }}>
            <i className="ti ti-search" style={{ fontSize: 16 }} />
          </button>
        </div>
      </div>

      {/* Screens */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '12px 16px 90px', display: screen === 'properties' ? 'block' : 'none' }}>
          <PropertiesScreen onOpenProperty={setDetailId} />
        </div>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '12px 16px 90px', display: screen === 'history' ? 'block' : 'none' }}>
          <HistoryScreen onOpenProperty={setDetailId} />
        </div>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '12px 16px 90px', display: screen === 'pastsales' ? 'block' : 'none' }}>
          <PastSalesScreen />
        </div>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '12px 16px 90px', display: screen === 'compare' ? 'block' : 'none' }}>
          <CompareScreen />
        </div>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '12px 16px 90px', display: screen === 'assumptions' ? 'block' : 'none' }}>
          <AssumptionsScreen />
        </div>
      </div>

      {/* Bottom nav */}
      <nav style={{ background: 'var(--cream)', borderTop: '1px solid var(--border)', display: 'flex', paddingBottom: 'calc(8px + env(safe-area-inset-bottom,0px))', flexShrink: 0 }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setScreen(n.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 0 4px', border: 'none', background: 'none', cursor: 'pointer', position: 'relative' }}>
            <i className={`ti ${n.icon}`} style={{ fontSize: 20, color: screen === n.id ? 'var(--accent)' : 'var(--ink3)', lineHeight: 1 }} />
            <span style={{ fontSize: 10, color: screen === n.id ? 'var(--accent)' : 'var(--ink3)', letterSpacing: '0.02em' }}>{n.label}</span>
            {n.id === 'compare' && compareIds.length > 0 && (
              <span style={{ position: 'absolute', top: 0, right: 'calc(50% - 20px)', background: 'var(--accent)', color: '#fff', fontSize: 9, borderRadius: 99, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{compareIds.length}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Property detail overlay */}
      {detailId && <PropertyDetail propertyId={detailId} onClose={() => setDetailId(null)} />}

      {/* Global search overlay */}
      {gsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--cream)', zIndex: 300, display: 'flex', flexDirection: 'column', maxWidth: 430, left: '50%', transform: 'translateX(-50%)' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingTop: 'max(10px,env(safe-area-inset-top,10px))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 11px', flex: 1 }}>
              <i className="ti ti-search" style={{ color: 'var(--ink3)', fontSize: 16 }} />
              <input autoFocus value={gsQuery} onChange={e => setGsQuery(e.target.value)} placeholder="Search everything…" style={{ border: 'none', background: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: 14, flex: 1, outline: 'none', color: 'var(--ink)' }} />
            </div>
            <button onClick={() => setGsOpen(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 11px', fontSize: 13, cursor: 'pointer', color: 'var(--ink2)', fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {gsQuery && !gsResults.length && <p style={{ color: 'var(--ink3)', fontSize: 13, textAlign: 'center', padding: 24 }}>No results</p>}
            {gsResults.map((r, i) => (
              <div key={i} onClick={r.action} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--cream2)', cursor: 'pointer' }}>
                <div style={{ width: 32, height: 32, background: 'var(--cream2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: 'var(--ink3)', flexShrink: 0 }}>
                  <i className={`ti ${r.icon}`} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.addr}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{r.meta}</div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--ink3)', background: 'var(--cream2)', padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap' }}>{r.screen}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
