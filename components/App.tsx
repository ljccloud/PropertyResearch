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

  const gsResults = gsQuery.trim().length > 0 ? [
    ...properties.filter(p => !p.archived && (p.address + ' ' + p.postcode + ' ' + (p.tags||'')).toLowerCase().includes(gsQuery.toLowerCase()))
      .map(p => ({ icon: 'ti-building', addr: p.address, meta: p.postcode, screen: 'Property', action: () => { setDetailId(p.id); setGsOpen(false) } })),
    ...properties.filter(p => p.archived && (p.address + ' ' + p.postcode).toLowerCase().includes(gsQuery.toLowerCase()))
      .map(p => ({ icon: 'ti-clock', addr: p.address, meta: p.postcode + ' · ' + p.outcome, screen: 'History', action: () => { setDetailId(p.id); setGsOpen(false) } })),
    ...pastSales.filter((s: any) => !s.deleted && (s.address + ' ' + s.postcode).toLowerCase().includes(gsQuery.toLowerCase()))
      .map(s => ({ icon: 'ti-receipt', addr: s.address, meta: s.postcode, screen: 'Past Sale', action: () => { setScreen('pastsales'); setGsOpen(false) } })),
  ] : []

  function goScreen(s: Screen) {
    setScreen(s)
    // On mobile, opening a screen closes the detail
    // On tablet+ the detail stays open
  }

  const showFab = screen === 'properties' || screen === 'pastsales'

  return (
    <div id="app-root">
      {/* ── LEFT SIDEBAR / PHONE SHELL ── */}
      <div className="app-shell">

        {/* Topbar */}
        <div style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)', padding: '12px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, paddingTop: 'max(12px,var(--safe-top))' }}>
          <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, letterSpacing: '-0.01em' }}>{TITLES[screen]}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SaveIndicator />
            <button onClick={() => { setGsOpen(true); setGsQuery('') }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink2)' }}>
              <i className="ti ti-search" style={{ fontSize: 15 }} />
            </button>
          </div>
        </div>

        {/* Screen content */}
        <div className="screen-content" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 16px 90px' }}>
          {screen === 'properties'  && <PropertiesScreen onOpenProperty={id => setDetailId(id)} />}
          {screen === 'history'     && <HistoryScreen onOpenProperty={id => setDetailId(id)} />}
          {screen === 'pastsales'   && <PastSalesScreen />}
          {screen === 'compare'     && <CompareScreen />}
          {screen === 'assumptions' && <AssumptionsScreen />}
        </div>

        {/* Bottom / sidebar nav */}
        <nav className="bottom-nav" style={{ background: 'var(--cream)', borderTop: '1px solid var(--border)', display: 'flex', paddingBottom: 'calc(8px + var(--safe-bottom))', flexShrink: 0 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => goScreen(n.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 0 4px', border: 'none', background: 'none', cursor: 'pointer', position: 'relative' }}>
              <i className={`ti ${n.icon}`} style={{ fontSize: 20, color: screen === n.id ? 'var(--accent)' : 'var(--ink3)', lineHeight: 1 }} />
              <span style={{ fontSize: 10, color: screen === n.id ? 'var(--accent)' : 'var(--ink3)', letterSpacing: '0.02em' }}>{n.label}</span>
              {n.id === 'compare' && compareIds.length > 0 && (
                <span style={{ position: 'absolute', top: 0, right: 'calc(50% - 20px)', background: 'var(--accent)', color: '#fff', fontSize: 9, borderRadius: 99, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{compareIds.length}</span>
              )}
            </button>
          ))}
        </nav>

        {/* FAB */}
        {showFab && (
          <button
            className="fab-btn"
            onClick={() => {
              // Trigger the FAB in the active screen via a custom event
              window.dispatchEvent(new CustomEvent('fab-action'))
            }}
            style={{ position: 'fixed', bottom: 'calc(84px + var(--safe-bottom))', right: 16, width: 50, height: 50, background: 'var(--accent)', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', zIndex: 99, boxShadow: '0 2px 10px rgba(139,111,71,.3)' }}>
            <i className="ti ti-plus" />
          </button>
        )}

        {/* Global search overlay */}
        {gsOpen && (
          <div style={{ position: 'absolute', inset: 0, background: 'var(--cream)', zIndex: 300, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingTop: 'max(10px,var(--safe-top))' }}>
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

      {/* ── RIGHT PANEL — property detail or empty state ── */}
      {detailId ? (
        <PropertyDetail
          propertyId={detailId}
          onClose={() => setDetailId(null)}
          asPanel={true}
        />
      ) : (
        <div className="detail-panel-empty">
          <i className="ti ti-building" style={{ fontSize: 32, color: 'var(--ink3)' }} />
          <span>Select a property to view details</span>
        </div>
      )}
    </div>
  )
}
