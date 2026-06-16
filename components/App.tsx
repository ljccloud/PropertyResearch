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
  properties: 'Properties', history: 'History', pastsales: 'Past Sales',
  compare: 'Compare', assumptions: 'Assumptions',
}

// Shared topbar used by both list and detail views
function Topbar({ title, left, right }: { title: string; left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, height: 52, paddingTop: 'var(--safe-top)' }}>
      {left}
      <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, letterSpacing: '-0.01em', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      {right}
    </div>
  )
}

export function App() {
  const [screen, setScreen] = useState<Screen>('properties')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [gsOpen, setGsOpen] = useState(false)
  const [gsQuery, setGsQuery] = useState('')
  const compareIds = useStore(s => s.compareIds)
  const properties = useStore(s => s.properties)
  const pastSales = useStore(s => s.pastSales)
  const showFab = !detailId && (screen === 'properties' || screen === 'pastsales')

  const gsResults = gsQuery.trim() ? [
    ...properties.filter(p => !p.archived && (p.address+' '+p.postcode+' '+(p.tags||'')).toLowerCase().includes(gsQuery.toLowerCase()))
      .map(p => ({ icon: 'ti-building', addr: p.address, meta: p.postcode, label: 'Property', action: () => { setDetailId(p.id); setGsOpen(false) } })),
    ...properties.filter(p => p.archived && (p.address+' '+p.postcode).toLowerCase().includes(gsQuery.toLowerCase()))
      .map(p => ({ icon: 'ti-clock', addr: p.address, meta: p.postcode+' · '+p.outcome, label: 'History', action: () => { setDetailId(p.id); setGsOpen(false) } })),
    ...(pastSales as any[]).filter(s => !s.deleted && (s.address+' '+s.postcode).toLowerCase().includes(gsQuery.toLowerCase()))
      .map(s => ({ icon: 'ti-receipt', addr: s.address, meta: s.postcode, label: 'Past Sale', action: () => { setScreen('pastsales'); setGsOpen(false) } })),
  ] : []

  const searchBtn = (
    <button onClick={() => { setGsOpen(true); setGsQuery('') }} style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--ink2)', flexShrink:0 }}>
      <i className="ti ti-search" style={{ fontSize:16 }} />
    </button>
  )

  return (
    <div id="app-root" style={{ display:'flex', flexDirection:'column', height:'100dvh', overflow:'hidden', background:'var(--cream)' }}>

      {/* ── Content area: list OR detail, never overlapping ── */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {detailId ? (
          // ── DETAIL VIEW ──
          <PropertyDetail
            propertyId={detailId}
            onClose={() => setDetailId(null)}
            searchBtn={searchBtn}
          />
        ) : (
          // ── LIST VIEW ──
          <>
            <Topbar
              title={TITLES[screen]}
              right={
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <SaveIndicator />
                  {searchBtn}
                </div>
              }
            />
            <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', display:'flex', justifyContent:'center' }}>
              <div style={{ width:'100%', maxWidth:860, padding:'12px 16px 90px' }}>
                {screen === 'properties'  && <PropertiesScreen onOpenProperty={setDetailId} />}
                {screen === 'history'     && <HistoryScreen onOpenProperty={setDetailId} />}
                {screen === 'pastsales'   && <PastSalesScreen />}
                {screen === 'compare'     && <CompareScreen />}
                {screen === 'assumptions' && <AssumptionsScreen />}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Bottom nav ── */}
      <nav style={{ background:'var(--cream)', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'center', flexShrink:0, paddingBottom:'calc(8px + var(--safe-bottom))' }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => { setDetailId(null); setScreen(n.id) }} style={{ flex:1, maxWidth:120, display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'8px 0 4px', border:'none', background:'none', cursor:'pointer', position:'relative' }}>
            <i className={`ti ${n.icon}`} style={{ fontSize:20, color: screen===n.id && !detailId ? 'var(--accent)' : 'var(--ink3)', lineHeight:1 }} />
            <span style={{ fontSize:10, color: screen===n.id && !detailId ? 'var(--accent)' : 'var(--ink3)', letterSpacing:'0.02em' }}>{n.label}</span>
            {n.id==='compare' && compareIds.length>0 && (
              <span style={{ position:'absolute', top:0, right:'calc(50% - 20px)', background:'var(--accent)', color:'#fff', fontSize:9, borderRadius:99, minWidth:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>{compareIds.length}</span>
            )}
          </button>
        ))}
      </nav>

      {/* ── FAB ── */}
      {showFab && (
        <button onClick={() => window.dispatchEvent(new CustomEvent('fab-action'))} style={{ position:'fixed', bottom:'calc(68px + var(--safe-bottom))', right:24, width:50, height:50, background:'var(--accent)', borderRadius:'50%', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, color:'#fff', zIndex:99, boxShadow:'0 2px 10px rgba(139,111,71,.3)' }}>
          <i className="ti ti-plus" />
        </button>
      )}

      {/* ── Global search ── */}
      {gsOpen && (
        <div style={{ position:'fixed', inset:0, background:'var(--cream)', zIndex:300, display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, flexShrink:0, paddingTop:'max(10px,var(--safe-top))' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1px solid var(--border)', borderRadius:6, padding:'8px 11px', flex:1 }}>
              <i className="ti ti-search" style={{ color:'var(--ink3)', fontSize:16 }} />
              <input autoFocus value={gsQuery} onChange={e=>setGsQuery(e.target.value)} placeholder="Search everything…" style={{ border:'none', background:'none', fontFamily:"'DM Sans',sans-serif", fontSize:14, flex:1, outline:'none', color:'var(--ink)' }} />
            </div>
            <button onClick={()=>setGsOpen(false)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'7px 14px', fontSize:13, cursor:'pointer', color:'var(--ink2)', fontFamily:"'DM Sans',sans-serif" }}>Cancel</button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'12px 16px', maxWidth:700, width:'100%', margin:'0 auto' }}>
            {gsQuery && !gsResults.length && <p style={{ color:'var(--ink3)', fontSize:13, textAlign:'center', padding:24 }}>No results</p>}
            {gsResults.map((r,i) => (
              <div key={i} onClick={r.action} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid var(--cream2)', cursor:'pointer' }}>
                <div style={{ width:34, height:34, background:'var(--cream2)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'var(--ink3)', flexShrink:0 }}>
                  <i className={`ti ${r.icon}`} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.addr}</div>
                  <div style={{ fontSize:12, color:'var(--ink3)' }}>{r.meta}</div>
                </div>
                <span style={{ fontSize:11, color:'var(--ink3)', background:'var(--cream2)', padding:'2px 8px', borderRadius:99, whiteSpace:'nowrap' }}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
