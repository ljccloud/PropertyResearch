'use client'
import { useState, Fragment } from 'react'
import { useStore } from '@/lib/store'
import { gbp, pct, ppsf, ppsm } from '@/lib/format'
import { calcSDLT, calcFinancing, calcLeaseExtension, calcRenoTotal, calcYield } from '@/lib/calculations'
import { Sheet } from '@/components/ui/Sheet'
import { Btn } from '@/components/ui/Btn'
import { Collapsible } from '@/components/ui/Collapsible'
import { CalcTable } from '@/components/ui/CalcTable'
import { FormRow, Input, CInput, Textarea } from '@/components/ui/FormRow'
import { ComparablesMapDynamic } from '@/components/map/ComparablesMapDynamic'
import type { Property, Comparable, PastSale } from '@/types'
import { uid } from '@/types'

interface Props { propertyId: string; onClose: () => void; asPanel?: boolean; searchBtn?: React.ReactNode }

// Compact inline input for calc tables — no background, just a plain number field
function TInput({ value, onChange, placeholder }: { value: string|number; onChange: (v: number) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      value={value === 0 || value === '0' ? '' : value}
      placeholder={placeholder || '0'}
      onChange={e => {
        const raw = e.target.value
        if (raw === '' || raw === '-') { onChange(0); return }
        const n = parseFloat(raw)
        if (!isNaN(n)) onChange(n)
      }}
      style={{ width: 90, textAlign: 'right', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: 'none', color: 'var(--ink)' }}
    />
  )
}

// Read-only value cell for calc tables
function Val({ children, colour }: { children: React.ReactNode; colour?: string }) {
  return <span style={{ fontSize: 13, fontWeight: 500, color: colour || 'var(--ink)' }}>{children}</span>
}

const SQM_PER_SQFT = 0.092903

function fmtDate(d: string): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

export function PropertyDetail({ propertyId, onClose, searchBtn }: Props) {
  const { properties, pastSales, assumptions, updateProperty, archiveProperty, duplicateProperty, addPastSale, changelog } = useStore()
  const p = properties.find(x => x.id === propertyId)

  const [tab, setTab] = useState<'overview'|'comparables'|'resale'>('overview')
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveOutcome, setArchiveOutcome] = useState<'Purchased'|'Passed'|'Outbid'>('Purchased')
  const [archiveReason, setArchiveReason] = useState('')
  const [clOpen, setClOpen] = useState(false)
  const [ovfOpen, setOvfOpen] = useState(false)
  const [addPhOpen, setAddPhOpen] = useState(false)
  const [phDate, setPhDate] = useState('')
  const [phPrice, setPhPrice] = useState('')
  const [addCompOpen, setAddCompOpen] = useState(false)
  const [compType, setCompType] = useState<'forsale'|'sold'|'auction'>('sold')
  const [compForm, setCompForm] = useState({ address: '', postcode: '', price: '', date: '', dateListed: '', sqft: '', sqm: '', beds: '', baths: '', tenure: '', outdoorSpace: '', guidePrice: '', notes: '' })
  const [compDateFilter, setCompDateFilter] = useState<'all'|'12'|'24'>('all')
  const [importPSOpen, setImportPSOpen] = useState(false)
  const [importPSType, setImportPSType] = useState<'forsale'|'sold'|'auction'>('sold')
  const [importPSSearch, setImportPSSearch] = useState('')
  const [archiveSaleOpen, setArchiveSaleOpen] = useState(false)
  const [pendingArchiveOutcome, setPendingArchiveOutcome] = useState<'Purchased'|'Passed'|'Outbid'>('Purchased')
  const [pendingArchiveReason, setPendingArchiveReason] = useState('')
  // extraRenoRows are stored in prop.renovation.extra — no local state needed
  // extraPFRows stored in prop.purchaseFees.extraItems — no local state needed
  // renoVat and loanOverride stored on property so they persist
  // Track whether loan has been manually overridden

  // Collect previously used tags for autocomplete
  const allUsedTags = Array.from(new Set(
    properties.flatMap(pr => (pr.tags||'').split(',').map((t: string) => t.trim()).filter((t: string) => t && t.toLowerCase() !== 'auction' && t.toLowerCase() !== 'leasehold'))
  ))

  if (!p) return null
  const prop = p as Property
  const up = (patch: Partial<Property>) => updateProperty(propertyId, patch)
  const renoVat = prop.renoVatIncluded || false
  const loanOverride = prop.loanOverride || false

  // ── Sq ft / sq m auto-conversion ──────────────────────────────
  function onSqftChange(val: number) {
    const sqm = val ? Math.round(val * SQM_PER_SQFT * 100) / 100 : 0
    up({ sqft: val, sqm })
  }
  function onSqmChange(val: number) {
    const sqft = val ? Math.round(val / SQM_PER_SQFT) : 0
    up({ sqm: val, sqft })
  }

  // ── Calculations ──────────────────────────────────────────────
  const sdlt = calcSDLT(prop.offerPrice, assumptions.sdltType)
  const af = prop.purchaseFees?.auctionFeeFlat || 0
  const scPct = prop.purchaseFees?.specialConditionsPct || 0
  const sc = Math.round(prop.offerPrice * (scPct / 100) * 1.2)
  const extraPFItems: {id:string;label:string;value:string}[] = (prop.purchaseFees as any)?.extraItems || []
  const extraPFTotal = extraPFItems.reduce((s: number, r: any) => s + (parseFloat(r.value) || 0), 0)
  // Purchase fees excludes SDLT (shown separately)
  const legalFees = prop.purchaseFees?.legalFees ?? assumptions.defLegal
  const otherFees = af + sc + legalFees + extraPFTotal
  const totalFees = sdlt.total + otherFees

  const renoExtra: {id:string;label:string;value:string}[] = (prop.renovation as any)?.extra || []
  const { subtotal: renoBase, total: renoTotal } = calcRenoTotal(prop.renovation as any, assumptions.vatRate, renoVat)

  const lease = calcLeaseExtension(prop.leaseExtension?.cost || 0, prop.leaseExtension?.legal || 0)
  const sub = prop.offerPrice + totalFees + renoTotal
  const totalCost = sub + lease.total

  // Loan amount: auto = totalCost, unless manually overridden
  const autoLoan = totalCost
  const loanAmount = loanOverride ? (prop.financing?.loan || 0) : autoLoan
  const fin = calcFinancing(loanAmount, prop.financing?.rate || assumptions.defRate, prop.financing?.months || 6)

  const caf = totalCost + fin.total
  const pbf = prop.resaleEst - totalCost
  const paf = prop.resaleEst - caf
  const yld = calcYield(prop.rent, prop.runningCosts, totalCost)

  // Sensitivity
  const sensCells = [-0.10, -0.05, 0, 0.05, 0.10].map(d => {
    const o2 = prop.offerPrice * (1 + d)
    const s2 = calcSDLT(o2, assumptions.sdltType)
    const f2 = s2.total + af + Math.round(o2 * scPct / 100) + legalFees + extraPFTotal
    const profit = prop.resaleEst - (o2 + f2 + renoTotal + lease.total + fin.total)
    return { profit: Math.round(profit) }
  })

  // ── Comparables ───────────────────────────────────────────────
  function fByDate(comps: Comparable[]) {
    if (compDateFilter === 'all') return comps
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - parseInt(compDateFilter))
    return comps.filter(c => c.date && new Date(c.date) >= cutoff)
  }

  function ms(type: 'forsale'|'sold'|'auction') {
    const ticked = fByDate(prop.comparables?.[type] || []).filter((c: any) => c.ticked && c.psf)
    if (!ticked.length) return null
    const vals = ticked.map((c: any) => c.psf as number).sort((a, b) => b - a)
    const sqft = prop.sqft || 0
    function cell(psfVal: number) {
      const implied = sqft ? Math.round(psfVal * sqft) : null
      return { psf: psfVal, implied }
    }
    return {
      h: cell(vals[0]),
      m: cell(Math.round(vals.reduce((a,b)=>a+b,0)/vals.length)),
      l: cell(vals[vals.length-1]),
    }
  }
  const msFS = ms('forsale'), msS = ms('sold'), msA = ms('auction')

  function addComp() {
    const c: Comparable = {
      id: uid(), address: compForm.address, postcode: compForm.postcode,
      price: parseFloat(compForm.price)||0,
      date: compForm.date ? compForm.date + '-01' : '',
      dateListed: compForm.dateListed ? compForm.dateListed + '-01' : '',
      sqft: parseFloat(compForm.sqft)||undefined,
      sqm: parseFloat(compForm.sqm)||undefined,
      ticked: false,
      beds: parseFloat(compForm.beds)||undefined,
      baths: parseFloat(compForm.baths)||undefined,
      tenure: compForm.tenure as any,
      outdoorSpace: compForm.outdoorSpace as any,
      guidePrice: parseFloat(compForm.guidePrice)||undefined,
      notes: compForm.notes || undefined,
    } as any
    if (c.sqft) c.psf = Math.round(c.price / c.sqft)
    const comps = { ...prop.comparables, [compType]: [...(prop.comparables?.[compType]||[]), c] }
    up({ comparables: comps })
    // Also add to past sales if it is a sold/auction comparable
    if (compType === 'sold' || compType === 'auction') {
      const alreadyInSales = pastSales.some(s => s.id === c.id)
      if (!alreadyInSales) {
        const sale: PastSale = {
          id: c.id, address: c.address, postcode: c.postcode,
          guide: parseFloat(compForm.guidePrice)||0,
          dateListed: c.dateListed || '',
          dateSold: c.date,
          soldPrice: c.price,
          sqft: c.sqft,
          sqm: parseFloat(compForm.sqm)||undefined,
          beds: parseFloat(compForm.beds)||undefined,
          outdoor: compForm.outdoorSpace || '',
          notes: compForm.notes || '',
          auction: compType === 'auction',
        }
        addPastSale(sale)
      }
    }
    setAddCompOpen(false)
    setCompForm({ address: '', postcode: '', price: '', date: '', dateListed: '', sqft: '', sqm: '', beds: '', baths: '', tenure: '', outdoorSpace: '', guidePrice: '', notes: '' })
  }

  function tickComp(type: 'forsale'|'sold'|'auction', id: string) {
    const all = (prop.comparables?.[type] || []).map((c: any) =>
      c.id === id ? { ...c, ticked: !c.ticked } : c
    )
    up({ comparables: { ...prop.comparables, [type]: all } })
  }

  function removeComp(type: 'forsale'|'sold'|'auction', id: string) {
    // Remove from comparables list only — data in pastSales is untouched
    const all = (prop.comparables?.[type] || []).filter((c: any) => c.id !== id)
    up({ comparables: { ...prop.comparables, [type]: all } })
  }

  // ── Style helpers ─────────────────────────────────────────────
  const th: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--border)', color: 'var(--ink3)', fontWeight: 700, fontSize: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.05em', background: 'var(--cream2)' }
  const td: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }

  const sL = (text: string) => (
    <div style={{ margin: '22px 0 12px', paddingBottom: 8, borderBottom: '1px solid var(--border)', fontSize: 10, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>{text}</div>
  )
  const card = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '10px 12px', marginBottom: 12, ...style }}>{children}</div>
  )

  // Compact table row helper
  const row = (label: React.ReactNode, value: React.ReactNode, muted = false) => ({ label: muted ? <span style={{color:'var(--ink3)'}}>{label}</span> : label, value })
  const subtotalRow = (label: string, value: string) => ({ label, value, type: 'subtotal' as const })
  const totalRow = (label: string, value: React.ReactNode) => ({ label, value, type: 'total' as const })

  function CompTable({ type, dateLabel }: { type: 'forsale'|'sold'|'auction'; dateLabel: string }) {
    const comps = fByDate(prop.comparables?.[type] || [])
    if (!comps.length) return <div style={{ fontSize: 12, color: 'var(--ink3)', padding: '4px 0 8px' }}>None added yet</div>
    const showExtra = type === 'sold' || type === 'auction'
    const TENURE: Record<string,string> = { freehold:'Freehold', leasehold:'Leasehold', 'share-of-freehold':'Share of freehold' }
    const OUTDOOR: Record<string,string> = { none:'None','shared-garden':'Shared garden',garden:'Garden',balcony:'Balcony',terrace:'Terrace','roof-terrace':'Roof terrace' }
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:14, overflow:'hidden', border:'1px solid var(--border)', marginBottom:8, fontSize:12 }}>
          <thead>
            <tr>
              <th style={{...th,width:20}}></th>
              <th style={th}>Address</th>
              <th style={{...th,width:44}}>Sqft</th>
              <th style={{...th,width:36}}>Beds</th>
              {type==='auction' && <th style={{...th,width:60}}>Guide</th>}
              <th style={{...th,width:60}}>{dateLabel}</th>
              <th style={{...th,width:68}}>Price</th>
              <th style={{...th,width:56}}>£/sqft</th>
              <th style={{...th,width:24}}></th>
            </tr>
          </thead>
          <tbody>
            {comps.map((c: any, i: number) => (
              <Fragment key={c.id}>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  <td style={td}>
                    <div onClick={() => tickComp(type, c.id)} style={{ width:16,height:16,border:`1.5px solid ${c.ticked?'var(--accent)':'var(--border)'}`,borderRadius:4,display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:10,background:c.ticked?'var(--accent)':'#fff',color:'#fff' }}>{c.ticked?'✓':''}</div>
                  </td>
                  <td style={td}>
                    <div style={{fontSize:11,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.address}</div>
                    <div style={{fontSize:10,color:'var(--ink3)',display:'flex',gap:4,flexWrap:'wrap',marginTop:1}}>
                      <span>{c.postcode}</span>
                      {c.tenure ? <span>· {TENURE[c.tenure]||c.tenure}</span> : null}
                      {c.outdoorSpace ? <span>· {OUTDOOR[c.outdoorSpace]||c.outdoorSpace}</span> : null}
                    </div>
                  </td>
                  <td style={{...td,fontSize:11,color:'var(--ink3)'}}>{c.sqft && c.sqft > 0 ? c.sqft.toLocaleString('en-GB') : '—'}</td>
                  <td style={{...td,fontSize:11,color:'var(--ink3)'}}>{c.beds && c.beds > 0 ? c.beds : '—'}</td>
                  {type==='auction' && <td style={{...td,fontSize:11,color:'var(--ink3)'}}>{c.guidePrice ? gbp(c.guidePrice) : '—'}</td>}
                  <td style={{...td,fontSize:11,color:'var(--ink3)'}}>{c.date ? fmtDate(c.date) : '—'}</td>
                  <td style={{...td,fontSize:11}}>{gbp(c.price)}</td>
                  <td style={{...td,fontSize:11}}>{c.psf ? '£'+c.psf.toLocaleString('en-GB') : '—'}</td>
                  <td style={{...td,width:24}}>
                    <div onClick={() => removeComp(type, c.id)} title="Remove from comparables" style={{width:18,height:18,display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--ink3)',fontSize:13,borderRadius:4,lineHeight:1}}>×</div>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--cream)', height: '100%' }}>

      {/* ── Top bar ── */}
      <div style={{ background:'var(--cream)', borderBottom:'1px solid var(--border)', padding:'0 12px', display:'flex', alignItems:'center', gap:8, flexShrink:0, height:52, paddingTop:'var(--safe-top)' }}>
        <button onClick={onClose} style={{ background:'none',border:'1px solid var(--border)',borderRadius:6,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--ink2)',flexShrink:0 }}>
          <i className="ti ti-arrow-left" style={{ fontSize:15 }} />
        </button>
        <span style={{ fontFamily:"'DM Serif Display',serif",fontSize:16,flex:1,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis' }}>{prop.address || 'Property'}</span>
        <div style={{ display:'flex',gap:6,alignItems:'center',flexShrink:0 }}>
          {prop.url && <button onClick={() => window.open(prop.url,'_blank')} style={{ background:'none',border:'1px solid var(--border)',borderRadius:6,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--ink2)' }}><i className="ti ti-external-link" /></button>}
          {searchBtn}
          <button onClick={() => setClOpen(true)} style={{ background:'none',border:'1px solid var(--border)',borderRadius:6,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--ink2)' }}><i className="ti ti-history" /></button>
          <div style={{ position:'relative' }}>
            <button onClick={() => setOvfOpen(!ovfOpen)} style={{ background:'none',border:'1px solid var(--border)',borderRadius:6,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--ink2)' }}><i className="ti ti-dots" /></button>
            {ovfOpen && (
              <div style={{ position:'absolute',top:38,right:0,background:'#fff',border:'1px solid var(--border)',borderRadius:10,zIndex:10,minWidth:140,overflow:'hidden',boxShadow:'0 4px 16px rgba(0,0,0,.08)' }}>
                <div onClick={() => { setOvfOpen(false); duplicateProperty(propertyId); onClose() }} style={{ padding:'11px 14px',fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:8 }}><i className="ti ti-copy" />Duplicate</div>
                <div onClick={() => { setOvfOpen(false); setPendingArchiveOutcome('Purchased'); setPendingArchiveReason(''); setArchiveSaleOpen(true) }} style={{ padding:'11px 14px',fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:8,color:'var(--red)' }}><i className="ti ti-archive" />Archive</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:'flex',borderBottom:'1px solid var(--border)',background:'var(--cream)',flexShrink:0 }}>
        {(['overview','comparables','resale'] as const).map((t, i) => (
          <div key={t} onClick={() => setTab(t)} style={{ flex:1,padding:'9px 4px',textAlign:'center',fontSize:11,fontWeight:500,cursor:'pointer',borderBottom:`2px solid ${tab===t?'var(--accent)':'transparent'}`,color:tab===t?'var(--accent)':'var(--ink3)',whiteSpace:'nowrap' }}>
            {['Overview & Financials','Comparables','Sale & Resale'][i]}
          </div>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex:1,overflowY:'auto',overflowX:'hidden' }}>
        <div style={{width:'100%',maxWidth:900,margin:'0 auto',padding:'16px 20px 90px'}}>

        {/* TAB 1: OVERVIEW & FINANCIALS */}
        {tab === 'overview' && (
          <>
            {/* SUMMARY TILE */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 14px 12px', marginBottom: 8 }}>
              <input
                value={prop.address||''}
                onChange={e=>up({address:e.target.value})}
                placeholder="Address"
                style={{ width:'100%', fontFamily:"'DM Serif Display',serif", fontSize:17, color:'var(--ink)', background:'none', border:'none', outline:'none', marginBottom:2, padding:0 }}
              />
              <input
                value={prop.postcode||''}
                onChange={e=>up({postcode:e.target.value})} autoComplete="postal-code"
                placeholder="Postcode"
                style={{ width:'100%', fontSize:12, color:'var(--ink3)', background:'none', border:'none', outline:'none', marginBottom:8, padding:0, fontFamily:"'DM Sans',sans-serif" }}
              />
              {/* Tenure + method of sale row */}
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                <select value={prop.tenure||''} onChange={e=>up({tenure:e.target.value as any})} style={{flex:1,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',fontSize:11,fontFamily:"'DM Sans',sans-serif",outline:'none',color:prop.tenure?'var(--ink)':'var(--ink3)',WebkitAppearance:'none',appearance:'none'}}>
                  <option value="">Tenure...</option>
                  <option value="freehold">Freehold</option>
                  <option value="leasehold">Leasehold</option>
                  <option value="share-of-freehold">Share of freehold</option>
                </select>
                <select value={prop.methodOfSale||''} onChange={e=>up({methodOfSale:e.target.value as any})} style={{flex:1,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',fontSize:11,fontFamily:"'DM Sans',sans-serif",outline:'none',color:prop.methodOfSale?'var(--ink)':'var(--ink3)',WebkitAppearance:'none',appearance:'none'}}>
                  <option value="">Method of sale...</option>
                  <option value="private-treaty">Private Treaty</option>
                  <option value="auction">Auction</option>
                </select>
              </div>
              {/* Lease years + outdoor + service charge */}
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                {prop.tenure==='leasehold' && (
                  <div style={{display:'flex',alignItems:'center',gap:4,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',flex:1}}>
                    <span style={{fontSize:11,color:'var(--ink3)',whiteSpace:'nowrap'}}>Yrs left</span>
                    <input type="number" value={prop.leaseYears||''} onChange={e=>up({leaseYears:+e.target.value} as any)} style={{width:'100%',fontSize:11,background:'none',border:'none',outline:'none',fontFamily:"'DM Sans',sans-serif",color:'var(--ink)'}} />
                  </div>
                )}
                <select value={prop.outdoorSpace||''} onChange={e=>up({outdoorSpace:e.target.value as any})} style={{flex:1,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',fontSize:11,fontFamily:"'DM Sans',sans-serif",outline:'none',color:prop.outdoorSpace?'var(--ink)':'var(--ink3)',WebkitAppearance:'none',appearance:'none'}}>
                  <option value="">Outdoor...</option>
                  <option value="none">None</option>
                  <option value="shared-garden">Shared garden</option>
                  <option value="garden">Garden</option>
                  <option value="balcony">Balcony</option>
                  <option value="terrace">Terrace</option>
                  <option value="roof-terrace">Roof terrace</option>
                </select>
                <div style={{display:'flex',alignItems:'center',gap:4,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',flex:1}}>
                  <span style={{fontSize:11,color:'var(--ink3)',whiteSpace:'nowrap'}}>Service £</span>
                  <input type="number" value={prop.serviceCharge||''} onChange={e=>up({serviceCharge:+e.target.value} as any)} style={{width:'100%',fontSize:11,background:'none',border:'none',outline:'none',fontFamily:"'DM Sans',sans-serif",color:'var(--ink)'}} />
                </div>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                <div
                  onClick={() => {
                    const tags = (prop.tags||'').split(',').map((t: string)=>t.trim()).filter(Boolean)
                    const hasAuction = tags.some((t: string)=>t.toLowerCase()==='auction')
                    const newTags = hasAuction ? tags.filter((t: string)=>t.toLowerCase()!=='auction') : [...tags,'Auction']
                    up({ tags: newTags.join(', ') })
                  }}
                  style={{ display:'inline-flex', alignItems:'center', gap:4, borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:500, cursor:'pointer', border:'1px solid', background:(prop.tags||'').toLowerCase().includes('auction')?'var(--amber-bg)':'var(--cream2)', borderColor:(prop.tags||'').toLowerCase().includes('auction')?'#D4A800':'var(--border)', color:(prop.tags||'').toLowerCase().includes('auction')?'var(--amber)':'var(--ink3)' }}
                >
                  <i className="ti ti-gavel" style={{fontSize:10}} /> Auction
                </div>
                <div
                  onClick={() => {
                    const tags = (prop.tags||'').split(',').map((t: string)=>t.trim()).filter(Boolean)
                    const hasLease = tags.some((t: string)=>t.toLowerCase()==='leasehold')
                    const newTags = hasLease ? tags.filter((t: string)=>t.toLowerCase()!=='leasehold') : [...tags,'Leasehold']
                    up({ tags: newTags.join(', ') })
                  }}
                  style={{ display:'inline-flex', alignItems:'center', gap:4, borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:500, cursor:'pointer', border:'1px solid', background:(prop.tags||'').toLowerCase().includes('leasehold')?'var(--blue-bg)':'var(--cream2)', borderColor:(prop.tags||'').toLowerCase().includes('leasehold')?'#5A8AC0':'var(--border)', color:(prop.tags||'').toLowerCase().includes('leasehold')?'var(--blue)':'var(--ink3)' }}
                >
                  <i className="ti ti-building-estate" style={{fontSize:10}} /> Leasehold
                </div>
                {(prop.tags||'').toLowerCase().includes('leasehold') && (
                  <div style={{ display:'inline-flex', alignItems:'center', gap:4, borderRadius:99, padding:'3px 10px', fontSize:11, border:'1px solid var(--border)', background:'var(--cream2)', color:'var(--ink2)' }}>
                    <input
                      type="number"
                      value={(prop as any).leaseYears||''}
                      onChange={e=>up({leaseYears:+e.target.value} as any)}
                      placeholder="Yrs"
                      onClick={e=>e.stopPropagation()}
                      style={{ width:40, background:'none', border:'none', outline:'none', fontSize:11, fontFamily:"'DM Sans',sans-serif", color:'var(--ink2)', padding:0, textAlign:'center' }}
                    />
                    <span style={{color:'var(--ink3)'}}>yrs left</span>
                  </div>
                )}
                {(prop.tags||'').split(',').map((t: string)=>t.trim()).filter((t: string)=>t && t.toLowerCase()!=='auction' && t.toLowerCase()!=='leasehold').map((t: string)=>(
                  <span key={t} style={{ display:'inline-flex', alignItems:'center', borderRadius:99, padding:'3px 10px', fontSize:11, background:'var(--cream2)', border:'1px solid var(--border)', color:'var(--ink2)' }}>{t}</span>
                ))}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, background:'var(--cream)', border:'1px solid var(--border)', borderRadius:6, padding:'5px 8px' }}>
                <i className="ti ti-link" style={{ fontSize:11, color:'var(--ink3)', flexShrink:0 }} />
                <input value={prop.url||''} onChange={e=>up({url:e.target.value})} placeholder="Listing URL" style={{ flex:1, fontSize:11, background:'none', border:'none', outline:'none', fontFamily:"'DM Sans',sans-serif", color:'var(--ink)', minWidth:0 }} />
              </div>
            </div>

            {/* FOUR METRIC TILES — single row, equal width */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:12, margin:'0 0 12px 0' }}>
              <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, padding:'10px 10px 8px' }}>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Price</div>
                <input type="number" value={prop.listPrice||''} onChange={e=>up({listPrice:+e.target.value})} placeholder="—" style={{ width:'100%', fontSize:14, fontWeight:700, color:'var(--ink)', background:'none', border:'none', outline:'none', padding:0, fontFamily:"'DM Sans',sans-serif", MozAppearance:'textfield' }} />
                <div style={{ fontSize:10, color:'var(--ink3)', marginTop:3 }}>
                  {prop.listPrice ? gbp(prop.listPrice) : ''}
                </div>
                <div style={{ fontSize:10, color:'var(--ink3)', marginTop:2 }}>
                  <input
                    type="month"
                    value={prop.dateListed ? prop.dateListed.slice(0,7) : ''}
                    onChange={e => up({ dateListed: e.target.value ? e.target.value + '-01' : '' })}
                    style={{ background:'none', border:'none', outline:'none', fontSize:10, color:'var(--ink3)', fontFamily:"'DM Sans',sans-serif", padding:0, width:'100%' }}
                  />
                </div>
              </div>
              <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, padding:'10px 10px 8px' }}>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Sq ft</div>
                <input type="number" value={prop.sqft||''} onChange={e=>onSqftChange(+e.target.value)} placeholder="—" style={{ width:'100%', fontSize:14, fontWeight:700, color:'var(--ink)', background:'none', border:'none', outline:'none', padding:0, fontFamily:"'DM Sans',sans-serif", MozAppearance:'textfield' }} />
                <div style={{ fontSize:10, color:'var(--ink3)', marginTop:3 }}>
                  {prop.sqft ? prop.sqft.toLocaleString('en-GB') : ''}
                </div>
                <div style={{ fontSize:10, marginTop:2, color: prop.sqft && prop.listPrice ? 'var(--accent)' : 'var(--ink3)', fontWeight:500 }}>
                  {prop.sqft && prop.listPrice ? `£${Math.round(prop.listPrice/prop.sqft).toLocaleString('en-GB')}/sqft` : '—'}
                </div>
              </div>
              <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, padding:'10px 10px 8px' }}>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Sq m</div>
                <input type="number" value={prop.sqm||''} onChange={e=>onSqmChange(+e.target.value)} placeholder="—" style={{ width:'100%', fontSize:14, fontWeight:700, color:'var(--ink)', background:'none', border:'none', outline:'none', padding:0, fontFamily:"'DM Sans',sans-serif", MozAppearance:'textfield' }} />
                <div style={{ fontSize:10, color:'var(--ink3)', marginTop:3 }}>
                  {prop.sqm ? prop.sqm.toLocaleString('en-GB') : ''}
                </div>
                <div style={{ fontSize:10, marginTop:2, color: prop.sqm && prop.listPrice ? 'var(--accent)' : 'var(--ink3)', fontWeight:500 }}>
                  {prop.sqm && prop.listPrice ? `£${Math.round(prop.listPrice/prop.sqm).toLocaleString('en-GB')}/sqm` : '—'}
                </div>
              </div>
              <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, padding:'10px 10px 8px' }}>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Bed/Bath</div>
                <div style={{ display:'flex', alignItems:'center', gap:2 }}>
                  <input type="number" value={prop.beds||''} onChange={e=>up({beds:+e.target.value})} placeholder="—" style={{ width:28, fontSize:14, fontWeight:700, color:'var(--ink)', background:'none', border:'none', outline:'none', padding:0, fontFamily:"'DM Sans',sans-serif", MozAppearance:'textfield' }} />
                  <span style={{ fontSize:13, color:'var(--ink3)' }}>/</span>
                  <input type="number" value={prop.baths||''} onChange={e=>up({baths:+e.target.value})} placeholder="—" style={{ width:28, fontSize:14, fontWeight:700, color:'var(--ink)', background:'none', border:'none', outline:'none', padding:0, fontFamily:"'DM Sans',sans-serif", MozAppearance:'textfield' }} />
                </div>
                <div style={{ fontSize:10, fontWeight:500, color:'var(--ink3)', marginTop:3 }}>bed/bath</div>
              </div>
            </div>

            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',margin:'22px 0 12px',paddingBottom:8,borderBottom:'1px solid var(--border)'}}>
              <span style={{fontSize:10,fontWeight:700,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:'.07em'}}>Price history</span>
              <button onClick={() => setAddPhOpen(true)} style={{fontSize:11,padding:'4px 10px',background:'none',border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',color:'var(--ink2)',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:4}}>
                <i className="ti ti-plus" style={{fontSize:10}} /> Add
              </button>
            </div>
            {card(
              !prop.priceHistory?.length
                ? null
                : prop.priceHistory.slice().sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime()).map((h,i,arr) => {
                    const prev = i > 0 ? arr[i-1].price : null
                    const mv = prev !== null ? h.price - prev : null
                    return (
                      <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderBottom:i<arr.length-1?'1px solid var(--cream2)':'none',fontSize:12}}>
                        <span style={{color:'var(--ink2)',minWidth:72}}>{fmtDate(h.date)}</span>
                        <span style={{fontWeight:500,flex:1}}>{gbp(h.price)}</span>
                        {mv !== null && mv !== 0 && <span style={{fontSize:11,padding:'2px 6px',borderRadius:99,background:mv>0?'var(--red-bg)':'var(--green-bg)',color:mv>0?'var(--red)':'var(--green)'}}>{mv>0?'+':''}{gbp(mv)}</span>}
                      </div>
                    )
                  }),
              { padding: '2px 12px' }
            )}


            {sL('Offer considerations')}
            {card(<>
              <CalcTable rows={[
                {
                  label: <span style={{color:'var(--ink2)'}}>Offer price</span>,
                  value: <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end'}}>
                    {prop.sqft ? <span style={{fontSize:10,color:'var(--ink3)'}}>{ppsf(prop.offerPrice,prop.sqft)}</span> : null}
                    <TInput value={prop.offerPrice||''} onChange={v=>up({offerPrice:v})} />
                  </span>
                },
                row('Stamp duty (SDLT)', <Val>{gbp(sdlt.total)}</Val>, true),
                row('Other purchase fees', <Val>{gbp(otherFees)}</Val>, true),
                row('Renovation cost', <Val>{gbp(renoTotal)}</Val>, true),
                {
                  label: <span style={{fontWeight:600}}>Sub-total</span>,
                  value: <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end'}}>
                    {prop.sqft ? <span style={{fontSize:10,color:'var(--ink3)'}}>{ppsf(sub,prop.sqft)}</span> : null}
                    <Val>{gbp(sub)}</Val>
                  </span>,
                  type: 'subtotal' as const
                },
                row('Lease extension', <Val>{gbp(lease.total)}</Val>, true),
                {
                  label: <span style={{fontWeight:600}}>Total cost</span>,
                  value: <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end'}}>
                    {prop.sqft ? <span style={{fontSize:10,color:'var(--ink3)'}}>{ppsf(totalCost,prop.sqft)}</span> : null}
                    <Val>{gbp(totalCost)}</Val>
                  </span>,
                  type: 'subtotal' as const
                },
                row('Financing costs', <Val>{gbp(fin.total)}</Val>, true),
                {
                  label: <span style={{fontWeight:600}}>Cost after finance</span>,
                  value: <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end'}}>
                    {prop.sqft ? <span style={{fontSize:10,color:'var(--ink3)'}}>{ppsf(caf,prop.sqft)}</span> : null}
                    <Val>{gbp(caf)}</Val>
                  </span>,
                  type: 'subtotal' as const
                },
                {
                  label: <span style={{color:'var(--ink2)',fontWeight:700}}>Potential resale</span>,
                  value: <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end'}}>
                    {prop.sqft ? <span style={{fontSize:10,color:'var(--ink3)'}}>{ppsf(prop.resaleEst,prop.sqft)}</span> : null}
                    <TInput value={prop.resaleEst||''} onChange={v=>up({resaleEst:v})} />
                  </span>
                },
                row('Profit before finance', <Val colour={pbf>=0?'var(--green)':'var(--red)'}>{gbp(pbf)}</Val>, true),
                totalRow('Profit after finance', <Val colour={paf>=0?'var(--green)':'var(--red)'}>{gbp(paf)}</Val>),
              ]} />
            </>)}

            {sL('Rental estimate')}
            {card(<>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <label style={{fontSize:13,color:'var(--ink2)'}}>Monthly rent estimate</label>
                <TInput value={prop.rent||''} onChange={v=>up({rent:v})} />
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom: yld ? 8 : 0}}>
                <label style={{fontSize:13,color:'var(--ink2)'}}>Annual running costs</label>
                <TInput value={prop.runningCosts||''} onChange={v=>up({runningCosts:v})} />
              </div>
              {yld && <>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',background:'var(--green-bg)',borderRadius:6,marginBottom:5}}>
                  <span style={{fontSize:12,color:'var(--green)'}}>Gross yield</span>
                  <span style={{fontSize:15,fontWeight:600,color:'var(--green)'}}>{pct(yld.gross)}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',background:'var(--green-bg)',borderRadius:6}}>
                  <span style={{fontSize:12,color:'var(--green)'}}>Net yield</span>
                  <span style={{fontSize:15,fontWeight:600,color:'var(--green)'}}>{pct(yld.net)}</span>
                </div>
              </>}
            </>)}

            {sL('Sensitivity analysis')}
            {card(<>
              <div style={{fontSize:11,color:'var(--ink3)',marginBottom:6}}>Profit after finance at offer price ±%</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>{['−10%','−5%','Base','+5%','+10%'].map(h=><th key={h} style={{background:'var(--cream2)',padding:'6px 10px',textAlign:'center',fontSize:11,color:'var(--ink2)',fontWeight:600,letterSpacing:'.02em'}}>{h}</th>)}</tr></thead>
                <tbody><tr>{sensCells.map((c,i)=><td key={i} style={{padding:'5px 6px',textAlign:'center',borderBottom:'1px solid var(--cream2)',color:c.profit>=0?'var(--green)':'var(--red)'}}>{gbp(c.profit)}</td>)}</tr></tbody>
              </table>
            </>)}

            {/* ── STAMP DUTY — shown separately ── */}
            <Collapsible title="Stamp duty (SDLT)">
              <CalcTable rows={[
                ...sdlt.breakdown.map(b => row(
                  <span style={{fontSize:11}}>{b.band} @ {b.rate}%</span>,
                  <Val>{gbp(b.tax)}</Val>,
                  true
                )),
                totalRow('Total SDLT', <Val>{gbp(sdlt.total)}</Val>),
              ]} />
            </Collapsible>

            {/* ── PURCHASE FEES (excl. SDLT) ── */}
            <Collapsible title="Purchase fees">
              <CalcTable rows={[
                {
                  label: <span style={{color:'var(--ink2)'}}>Auction fee</span>,
                  value: <TInput
                    value={prop.purchaseFees?.auctionFeeFlat ?? ''}
                    onChange={v=>up({purchaseFees:{...prop.purchaseFees,auctionFeeFlat:v}})}
                    placeholder="0"
                  />
                },
                row(
                  <span style={{display:'flex',alignItems:'center',gap:4,fontSize:13}}>
                    Special conditions
                    <input
                      value={scPct || ''}
                      type="number"
                      placeholder="0"
                      onChange={e=>up({purchaseFees:{...prop.purchaseFees,specialConditionsPct:+e.target.value}})}
                      style={{width:36,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:3,padding:'2px 4px',fontSize:11,textAlign:'right',fontFamily:"'DM Sans',sans-serif",outline:'none'}}
                    />
                    <span style={{fontSize:11,color:'var(--ink3)'}}>%</span>
                  </span>,
                  <Val>{gbp(sc)}</Val>,
                  true
                ),
                {
                  label: <span style={{color:'var(--ink2)'}}>Legal fees</span>,
                  value: <TInput
                    value={prop.purchaseFees?.legalFees ?? assumptions.defLegal}
                    onChange={v=>up({purchaseFees:{...prop.purchaseFees,legalFees:v}})}
                  />
                },
                ...extraPFItems.map((r:any)=>row(
                  <input value={r.label} onChange={e=>{
                    const updated=extraPFItems.map((x:any)=>x.id===r.id?{...x,label:e.target.value}:x)
                    up({purchaseFees:{...prop.purchaseFees,extraItems:updated as any}})
                  }} placeholder="Item name" style={{width:120,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:4,padding:'4px 6px',fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:'none'}} />,
                  <TInput value={r.value} onChange={v=>{
                    const updated=extraPFItems.map((x:any)=>x.id===r.id?{...x,value:String(v)}:x)
                    up({purchaseFees:{...prop.purchaseFees,extraItems:updated as any}})
                  }} />
                )),
                totalRow('Total purchase fees', <Val>{gbp(otherFees)}</Val>),
              ]} />
              <button onClick={()=>{
                const updated=[...extraPFItems,{id:uid(),label:'',value:'0'}]
                up({purchaseFees:{...prop.purchaseFees,extraItems:updated as any}})
              }} style={{fontSize:12,marginTop:8,padding:'6px 10px',background:'none',border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',color:'var(--ink2)',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:4}}>
                <i className="ti ti-plus" style={{fontSize:11}} /> Add item
              </button>
            </Collapsible>

            {/* ── RENOVATION ── */}
            <Collapsible title="Renovation costs">
              <CalcTable rows={[
                ...(['paint','kitchen','bathroom','electrics','boiler','windows','builder'] as const).map(k => row(
                  ({'paint':'Painting & decorating','kitchen':'Kitchen','bathroom':'Bathroom','electrics':'Electrics','boiler':'Boiler','windows':'New windows','builder':"Builder's estimate"} as Record<string,string>)[k],
                  <TInput value={prop.renovation?.[k]||''} onChange={v=>up({renovation:{...prop.renovation,[k]:v}})} />
                )),
                ...renoExtra.map((r: any) => row(
                  <input
                    value={r.label}
                    onChange={e=>{
                      const updated = renoExtra.map((x:any)=>x.id===r.id?{...x,label:e.target.value}:x)
                      up({renovation:{...prop.renovation,extra:updated}})
                    }}
                    placeholder="Item name"
                    style={{width:120,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:4,padding:'4px 6px',fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:'none'}}
                  />,
                  <TInput
                    value={r.value}
                    onChange={v=>{
                      const updated = renoExtra.map((x:any)=>x.id===r.id?{...x,value:String(v)}:x)
                      up({renovation:{...prop.renovation,extra:updated}})
                    }}
                  />
                )),
                subtotalRow('Total estimate', gbp(renoBase)),
                row(
                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
                    <input type="checkbox" checked={renoVat} onChange={e=>up({renoVatIncluded:e.target.checked})} />
                    Incl. VAT ({assumptions.vatRate}%)
                  </label>,
                  renoVat ? <Val>{gbp(renoTotal)}</Val> : <span style={{color:'var(--ink3)'}}>—</span>
                ),
              ]} />
              <button onClick={()=>{
                const updated = [...renoExtra, {id:uid(),label:'',value:'0'}]
                up({renovation:{...prop.renovation,extra:updated}})
              }} style={{fontSize:12,marginTop:8,padding:'6px 10px',background:'none',border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',color:'var(--ink2)',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:4}}>
                <i className="ti ti-plus" style={{fontSize:11}} /> Add item
              </button>
            </Collapsible>

            {/* ── LEASE EXTENSION ── */}
            <Collapsible title="Lease extension">
              <CalcTable rows={[
                row('Cost of extending', <TInput value={prop.leaseExtension?.cost||''} onChange={v=>up({leaseExtension:{...prop.leaseExtension,cost:v}})} />),
                row('SDLT on extension (5%)', <Val>{gbp(lease.sdlt)}</Val>, true),
                row('Legal fees', <TInput value={prop.leaseExtension?.legal !== undefined ? prop.leaseExtension.legal : ''} onChange={v=>up({leaseExtension:{...prop.leaseExtension,legal:v}})} placeholder="0" />),
                totalRow('Total', <Val>{gbp(lease.total)}</Val>),
              ]} />
            </Collapsible>

            {/* ── FINANCING ── */}
            <Collapsible title="Financing charges">
              <CalcTable rows={[
                row(
                  <span style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                    Loan amount
                    {loanOverride
                      ? <span onClick={()=>{up({loanOverride:false,financing:{...prop.financing,loan:autoLoan}})}} style={{fontSize:10,color:'var(--accent)',cursor:'pointer',textDecoration:'underline'}}>reset to auto</span>
                      : <span style={{fontSize:10,color:'var(--ink3)'}}>= total cost</span>
                    }
                  </span>,
                  <TInput
                    value={loanOverride ? (prop.financing?.loan||'') : autoLoan}
                    onChange={v=>{up({loanOverride:true,financing:{...prop.financing,loan:v}})}}
                  />,
                  true
                ),
                row('Interest rate (%)', <TInput value={prop.financing?.rate||assumptions.defRate} onChange={v=>up({financing:{...prop.financing,rate:v}})} />),
                row('Annual interest', <Val>{gbp(fin.annual)}</Val>, true),
                row('Monthly interest', <Val>{gbp(fin.monthly)}</Val>, true),
                row('Months to complete', <TInput value={prop.financing?.months||6} onChange={v=>up({financing:{...prop.financing,months:v}})} />),
                totalRow('Financing cost', <Val>{gbp(fin.total)}</Val>),
              ]} />
            </Collapsible>

            {sL('Tags')}
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,padding:'10px 12px',marginBottom:12}}>
              <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:6}}>
                {(prop.tags||'').split(',').map((t:string)=>t.trim()).filter((t:string)=>t && t.toLowerCase()!=='auction' && t.toLowerCase()!=='leasehold').map((t:string)=>(
                  <span key={t} onClick={()=>{
                    const base=(prop.tags||'').split(',').map((x:string)=>x.trim()).filter((x:string)=>x.toLowerCase()==='auction'||x.toLowerCase()==='leasehold')
                    const rest=(prop.tags||'').split(',').map((x:string)=>x.trim()).filter((x:string)=>x && x.toLowerCase()!=='auction' && x.toLowerCase()!=='leasehold' && x!==t)
                    up({tags:[...base,...rest].join(', ')})
                  }} style={{display:'inline-flex',alignItems:'center',gap:3,background:'var(--cream2)',border:'1px solid var(--border)',borderRadius:99,padding:'2px 8px',fontSize:11,color:'var(--ink2)',cursor:'pointer'}}>
                    {t} <span style={{fontSize:12,color:'var(--ink3)'}}>×</span>
                  </span>
                ))}
              </div>
              <input
                placeholder="Add tag and press Enter…"
                style={{width:'100%',fontSize:12,background:'none',border:'none',outline:'none',fontFamily:"'DM Sans',sans-serif",color:'var(--ink)'}}
                onKeyDown={e=>{
                  if(e.key==='Enter' || e.key===','){
                    e.preventDefault()
                    const val=(e.target as HTMLInputElement).value.trim().replace(/,$/,'')
                    if(!val)return
                    const base=(prop.tags||'').split(',').map((t:string)=>t.trim()).filter((t:string)=>t.toLowerCase()==='auction'||t.toLowerCase()==='leasehold')
                    const rest=(prop.tags||'').split(',').map((t:string)=>t.trim()).filter((t:string)=>t && t.toLowerCase()!=='auction' && t.toLowerCase()!=='leasehold')
                    if(!rest.includes(val)){up({tags:[...base,...rest,val].join(', ')})}
                    ;(e.target as HTMLInputElement).value=''
                  }
                }}
                list="tag-suggestions"
              />
              <datalist id="tag-suggestions">
                {allUsedTags.map((t:string)=><option key={t} value={t}/>)}
              </datalist>
              {allUsedTags.length>0 && <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:8,borderTop:'1px solid var(--cream2)',paddingTop:8}}>
                <span style={{fontSize:10,color:'var(--ink3)',marginRight:2}}>Recent:</span>
                {allUsedTags.slice(0,8).map((t:string)=>{
                  const already=(prop.tags||'').split(',').map((x:string)=>x.trim()).includes(t)
                  if(already)return null
                  return <span key={t} onClick={()=>{
                    const base=(prop.tags||'').split(',').map((x:string)=>x.trim()).filter((x:string)=>x.toLowerCase()==='auction'||x.toLowerCase()==='leasehold')
                    const rest=(prop.tags||'').split(',').map((x:string)=>x.trim()).filter((x:string)=>x && x.toLowerCase()!=='auction' && x.toLowerCase()!=='leasehold')
                    up({tags:[...base,...rest,t].join(', ')})
                  }} style={{display:'inline-flex',alignItems:'center',background:'var(--cream)',border:'1px solid var(--border)',borderRadius:99,padding:'2px 8px',fontSize:11,color:'var(--ink3)',cursor:'pointer'}}>+ {t}</span>
                })}
              </div>}
            </div>

            {sL('Notes')}
            <Textarea value={prop.notes||''} onChange={e=>up({notes:e.target.value})} placeholder="Add notes about this property…" style={{minHeight:100,marginBottom:16}} />
          </>
        )}

        {/* ════ TAB 2: COMPARABLES ════ */}
        {tab === 'comparables' && (
          <>
            <div style={{background:'var(--cream2)',border:'1px solid var(--border)',borderRadius:14,padding:12,marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:'var(--ink3)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:10}}>Market summary — ticked comparables</div>
              <div style={{display:'grid',gridTemplateColumns:'68px 1fr 1fr 1fr',gap:4}}>
                {['','High','Mid','Low'].map(h=>(
                  <div key={h} style={{fontSize:10,color:'var(--ink3)',textAlign:'center',fontWeight:700,padding:'3px 2px',textTransform:'uppercase',letterSpacing:'.04em'}}>{h}</div>
                ))}
                {([['For sale',msFS],['Sold',msS],['Auction',msA]] as [string,ReturnType<typeof ms>][]).map(([lbl,s])=>(
                  <Fragment key={lbl}>
                    <div style={{fontSize:11,color:'var(--ink2)',display:'flex',alignItems:'center',fontWeight:500}}>{lbl}</div>
                    {(['h','m','l'] as const).map(k=>(
                      <div key={k} style={{background:'#fff',borderRadius:8,border:'1px solid var(--border)',padding:'5px 4px',textAlign:'center'}}>
                        {s && s[k] ? (
                          <>
                            <div style={{fontSize:12,fontWeight:700,color:'var(--ink)',lineHeight:1.2}}>
                              {s[k]!.implied ? '£'+s[k]!.implied!.toLocaleString('en-GB') : '—'}
                            </div>
                            <div style={{fontSize:9,color:'var(--ink3)',marginTop:2,fontWeight:500}}>
                              £{s[k]!.psf.toLocaleString('en-GB')}/sqft
                            </div>
                          </>
                        ) : <span style={{fontSize:11,color:'var(--ink3)'}}>—</span>}
                      </div>
                    ))}
                  </Fragment>
                ))}
              </div>
              {!prop.sqft && (
                <div style={{fontSize:10,color:'var(--ink3)',marginTop:8,textAlign:'center'}}>Enter sq ft on Overview to see implied prices</div>
              )}
            </div>

            <div style={{display:'flex',gap:5,marginBottom:10}}>
              {([['all','All dates'],['12','Last 12 months'],['24','Last 24 months']] as const).map(([f,lbl])=>(
                <span key={f} onClick={()=>setCompDateFilter(f)} style={{background:compDateFilter===f?'var(--accent)':'var(--cream2)',border:`1px solid ${compDateFilter===f?'var(--accent)':'var(--border)'}`,color:compDateFilter===f?'#fff':'var(--ink2)',borderRadius:99,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>{lbl}</span>
              ))}
            </div>

            <ComparablesMapDynamic subjectPostcode={prop.postcode} subjectAddress={prop.address} comparables={prop.comparables||{forsale:[],sold:[],auction:[]}} />

            {[{type:'forsale' as const,label:'For sale',dateLabel:'Listed'},{type:'sold' as const,label:'Sold',dateLabel:'Sold'},{type:'auction' as const,label:'Sold at auction',dateLabel:'Sold'}].map(({type,label,dateLabel})=>(
              <div key={type}>
                {sL(label)}
                {CompTable({ type, dateLabel })}
                <div style={{display:'flex',gap:8,marginBottom:12}}>
                  <button onClick={()=>{setCompType(type);setAddCompOpen(true)}} style={{flex:1,fontSize:12,background:'none',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',cursor:'pointer',color:'var(--ink2)',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                    <i className="ti ti-plus" style={{fontSize:11}} /> Add
                  </button>
                  <button onClick={()=>{setImportPSType(type);setImportPSOpen(true)}} style={{flex:1,fontSize:12,background:'none',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',cursor:'pointer',color:'var(--ink2)',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                    <i className="ti ti-download" style={{fontSize:11}} /> Import from sales
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ════ TAB 3: SALE & RESALE ════ */}
        {tab === 'resale' && (
          <>
            {sL('Sale details')}
            {card(<>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <FormRow label="Final sold price"><Input type="number" value={prop.finalSoldPrice||''} onChange={e=>up({finalSoldPrice:+e.target.value})} placeholder="0" /></FormRow>
                <FormRow label="Date sold"><Input type="date" value={prop.finalSoldDate||''} onChange={e=>up({finalSoldDate:e.target.value})} /></FormRow>
              </div>
            </>)}

            {sL('Resale')}
            {card(<>
              <FormRow label="Target resale price"><Input type="number" value={prop.targetResale||''} onChange={e=>up({targetResale:+e.target.value})} placeholder="0" /></FormRow>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <FormRow label="Actual resale price"><Input type="number" value={prop.actualResale||''} onChange={e=>up({actualResale:+e.target.value})} placeholder="0" /></FormRow>
                <FormRow label="Date resold"><Input type="date" value={prop.actualResaleDate||''} onChange={e=>up({actualResaleDate:e.target.value})} /></FormRow>
              </div>
            </>)}

            {sL('Implied outcome')}
            {card(
              (!prop.finalSoldPrice && !prop.targetResale && !prop.actualResale)
                ? <div style={{fontSize:12,color:'var(--ink3)'}}>Enter prices to see implied outcome</div>
                : <>
                    {[
                      prop.finalSoldPrice ? ['Purchase price', gbp(prop.finalSoldPrice), null] : null,
                      prop.targetResale   ? ['Target resale',  gbp(prop.targetResale),  null] : null,
                      prop.actualResale   ? ['Actual resale',  gbp(prop.actualResale),  null] : null,
                      (prop.finalSoldPrice && prop.actualResale) ? ['Gross gain', gbp(prop.actualResale - prop.finalSoldPrice), prop.actualResale >= prop.finalSoldPrice ? 'var(--green)' : 'var(--red)'] : null,
                    ].filter(Boolean).map(([label, value, colour]: any) => (
                      <div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--cream2)',fontSize:13}}>
                        <span style={{color:'var(--ink2)'}}>{label}</span>
                        <span style={{fontWeight:600,color:colour||'var(--ink)'}}>{value}</span>
                      </div>
                    ))}
                  </>
            )}
          </>
        )}
        </div>
      </div>

      {/* ════ SHEETS ════ */}
      <Sheet open={archiveOpen} onClose={()=>setArchiveOpen(false)} title="Archive property"
        footer={<><Btn onClick={()=>setArchiveOpen(false)}>Cancel</Btn><Btn variant="primary" full onClick={()=>{archiveProperty(propertyId,archiveOutcome,archiveReason);setArchiveOpen(false);onClose()}}>Archive</Btn></>}>
        <FormRow label="Outcome">
          <div style={{display:'flex',gap:14,marginTop:6}}>
            {(['Purchased','Passed','Outbid'] as const).map(o=>(
              <label key={o} style={{display:'flex',alignItems:'center',gap:5,fontSize:13,cursor:'pointer'}}>
                <input type="radio" name="outcome" value={o} checked={archiveOutcome===o} onChange={()=>setArchiveOutcome(o)} />{o}
              </label>
            ))}
          </div>
        </FormRow>
        <FormRow label="Reason (optional)"><Input value={archiveReason} onChange={e=>setArchiveReason(e.target.value)} placeholder="Brief note…" /></FormRow>
      </Sheet>

      {/* Archive → past sales prompt */}
      <Sheet open={archiveSaleOpen} onClose={()=>setArchiveSaleOpen(false)} title="Archive property"
        footer={<>
          <Btn onClick={()=>setArchiveSaleOpen(false)}>Cancel</Btn>
          <Btn variant="ghost" full onClick={()=>{setArchiveSaleOpen(false);setArchiveOpen(true)}}>Skip</Btn>
          <Btn variant="primary" full onClick={()=>{
            const sale = {
              id: uid(), address: prop.address, postcode: prop.postcode,
              guide: prop.listPrice, dateListed: prop.dateListed, dateSold: '',
              soldPrice: prop.finalSoldPrice || 0, sqft: prop.sqft, sqm: prop.sqm,
              beds: prop.beds, outdoor: prop.outdoorSpace || '', notes: prop.notes || '',
              auction: prop.methodOfSale === 'auction',
            }
            addPastSale(sale)
            setArchiveSaleOpen(false)
            setArchiveOpen(true)
          }}>Add to past sales</Btn>
        </>}>
        <p style={{fontSize:13,color:'var(--ink2)',lineHeight:1.6,marginBottom:12}}>Would you like to add <strong>{prop.address}</strong> to Past Sales before archiving?</p>
        <p style={{fontSize:12,color:'var(--ink3)'}}>This lets you use it as a comparable on other properties.</p>
      </Sheet>

      <Sheet open={addPhOpen} onClose={()=>setAddPhOpen(false)} title="Add price point"
        footer={<><Btn onClick={()=>setAddPhOpen(false)}>Cancel</Btn><Btn variant="primary" full onClick={()=>{if(!phDate&&!phPrice)return;up({priceHistory:[...(prop.priceHistory||[]),{date:phDate,price:parseFloat(phPrice)||0}]});setAddPhOpen(false);setPhDate('');setPhPrice('');}}>Add</Btn></>}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <FormRow label="Date"><Input type="date" value={phDate} onChange={e=>setPhDate(e.target.value)} /></FormRow>
          <FormRow label="Price"><Input type="number" value={phPrice} onChange={e=>setPhPrice(e.target.value)} /></FormRow>
        </div>
      </Sheet>

      <Sheet open={addCompOpen} onClose={()=>setAddCompOpen(false)} title={({forsale:'Add for-sale comparable',sold:'Add sold comparable',auction:'Add auction comparable'})[compType]}
        footer={<><Btn onClick={()=>setAddCompOpen(false)}>Cancel</Btn><Btn variant="primary" full onClick={addComp}>Add</Btn></>}>
        <FormRow label="Address"><Input value={compForm.address} onChange={e=>setCompForm(s=>({...s,address:e.target.value}))} /></FormRow>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11}}>
          <FormRow label="Postcode"><Input value={compForm.postcode} onChange={e=>setCompForm(s=>({...s,postcode:e.target.value}))} /></FormRow>
          <FormRow label={compType==='forsale'?'Asking price':'Sold price'}><Input type="number" value={compForm.price} onChange={e=>setCompForm(s=>({...s,price:e.target.value}))} /></FormRow>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11}}>
          <FormRow label="Guide / list price"><Input type="number" value={compForm.guidePrice} onChange={e=>setCompForm(s=>({...s,guidePrice:e.target.value}))} /></FormRow>
          <FormRow label="Bedrooms"><Input type="number" value={compForm.beds} onChange={e=>setCompForm(s=>({...s,beds:e.target.value}))} /></FormRow>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11}}>
          <FormRow label="Date listed">
            <input type="month" value={compForm.dateListed} onChange={e=>setCompForm(s=>({...s,dateListed:e.target.value}))}
              style={{width:'100%',background:'#fff',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:'none',WebkitAppearance:'none',appearance:'none'}} />
          </FormRow>
          {(compType==='sold'||compType==='auction') ? (
            <FormRow label="Month / year sold">
              <input type="month" value={compForm.date} onChange={e=>setCompForm(s=>({...s,date:e.target.value}))}
                style={{width:'100%',background:'#fff',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:'none',WebkitAppearance:'none',appearance:'none'}} />
            </FormRow>
          ) : (
            <FormRow label="Sq ft"><Input type="number" value={compForm.sqft} onChange={e=>{const v=e.target.value;const sqm=v?String(Math.round(parseFloat(v)*0.092903*100)/100):'';setCompForm(s=>({...s,sqft:v,sqm}))}} /></FormRow>
          )}
        </div>
        {(compType==='sold'||compType==='auction') && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11}}>
            <FormRow label="Sq ft"><Input type="number" value={compForm.sqft} onChange={e=>{const v=e.target.value;const sqm=v?String(Math.round(parseFloat(v)*0.092903*100)/100):'';setCompForm(s=>({...s,sqft:v,sqm}))}} /></FormRow>
            <FormRow label="Sq m"><Input type="number" value={compForm.sqm} onChange={e=>{const v=e.target.value;const sqft=v?String(Math.round(parseFloat(v)/0.092903)):'';setCompForm(s=>({...s,sqm:v,sqft}))}} /></FormRow>
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11}}>
          <FormRow label="Baths"><Input type="number" value={compForm.baths} onChange={e=>setCompForm(s=>({...s,baths:e.target.value}))} /></FormRow>
          <FormRow label="Tenure">
            <select value={compForm.tenure} onChange={e=>setCompForm(s=>({...s,tenure:e.target.value}))} style={{width:'100%',background:'#fff',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:'none',WebkitAppearance:'none',appearance:'none',color:compForm.tenure?'var(--ink)':'var(--ink3)'}}>
              <option value="">Select...</option>
              <option value="freehold">Freehold</option>
              <option value="leasehold">Leasehold</option>
              <option value="share-of-freehold">Share of freehold</option>
            </select>
          </FormRow>
        </div>
        <FormRow label="Outdoor space">
          <select value={compForm.outdoorSpace} onChange={e=>setCompForm(s=>({...s,outdoorSpace:e.target.value}))} style={{width:'100%',background:'#fff',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:'none',WebkitAppearance:'none',appearance:'none',color:compForm.outdoorSpace?'var(--ink)':'var(--ink3)'}}>
            <option value="">Select...</option>
            <option value="none">None</option>
            <option value="shared-garden">Shared garden</option>
            <option value="garden">Garden</option>
            <option value="balcony">Balcony</option>
            <option value="terrace">Terrace</option>
            <option value="roof-terrace">Roof terrace</option>
          </select>
        </FormRow>
        <FormRow label="Notes"><Textarea value={compForm.notes} onChange={e=>setCompForm(s=>({...s,notes:e.target.value}))} style={{minHeight:60}} /></FormRow>
      </Sheet>

            {/* Import from past sales sheet */}
      <Sheet open={importPSOpen} onClose={()=>{setImportPSOpen(false);setImportPSSearch('')}} title={`Import ${importPSType === 'forsale' ? 'for-sale' : importPSType === 'auction' ? 'auction' : 'sold'} comparable`}
        footer={<Btn full onClick={()=>{setImportPSOpen(false);setImportPSSearch('')}}>Close</Btn>}>
        <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',marginBottom:12}}>
          <i className="ti ti-search" style={{color:'var(--ink3)',fontSize:14,flexShrink:0}} />
          <input
            value={importPSSearch}
            onChange={e=>setImportPSSearch(e.target.value)}
            placeholder="Search by address or postcode…"
            style={{border:'none',background:'none',fontFamily:"'DM Sans',sans-serif",fontSize:13,flex:1,outline:'none',color:'var(--ink)'}}
          />
          {importPSSearch && <span onClick={()=>setImportPSSearch('')} style={{cursor:'pointer',color:'var(--ink3)',fontSize:16,lineHeight:1}}>×</span>}
        </div>
        {(()=>{
          const base = (pastSales as any[]).filter(s => !s.deleted && (importPSType === 'auction' ? s.auction : importPSType === 'sold' ? !s.auction : true))
          const filtered = importPSSearch
            ? base.filter(s => (s.address+' '+s.postcode).toLowerCase().includes(importPSSearch.toLowerCase()))
            : base
          if (!filtered.length) return <p style={{fontSize:13,color:'var(--ink3)',textAlign:'center',padding:16}}>{importPSSearch ? 'No results' : 'No past sales entries yet'}</p>
          return filtered.map((s: any) => {
            const psf = s.sqft ? Math.round(s.soldPrice / s.sqft) : 0
            const alreadyAdded = (prop.comparables?.[importPSType] || []).some((c: any) => c.id === s.id)
            return (
              <div key={s.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--cream2)'}}>
                <div style={{flex:1,minWidth:0,marginRight:10}}>
                  <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.address}</div>
                  <div style={{fontSize:11,color:'var(--ink3)'}}>{s.postcode}{s.dateSold ? ' · '+fmtDate(s.dateSold) : ''}{s.soldPrice ? ' · '+gbp(s.soldPrice) : ''}{psf ? ' · £'+psf.toLocaleString('en-GB')+'/sqft' : ''}</div>
                </div>
                {alreadyAdded
                  ? <span style={{fontSize:11,color:'var(--green)',flexShrink:0}}>Added ✓</span>
                  : <button onClick={()=>{
                      const c = { id: s.id, address: s.address, postcode: s.postcode, price: s.soldPrice, date: s.dateSold, dateListed: s.dateListed, sqft: s.sqft, sqm: s.sqm, psf: psf||undefined, beds: s.beds, outdoorSpace: s.outdoor, guidePrice: s.guide, notes: s.notes, ticked: false }
                      const comps = { ...prop.comparables, [importPSType]: [...(prop.comparables?.[importPSType]||[]), c] }
                      up({ comparables: comps })
                    }} style={{fontSize:12,padding:'5px 10px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>
                      Add
                    </button>
                }
              </div>
            )
          })
        })()}
      </Sheet>

      <Sheet open={clOpen} onClose={()=>setClOpen(false)} title="Change log"
        footer={<Btn full onClick={()=>setClOpen(false)}>Close</Btn>}>
        {changelog.filter(c=>c.pid===propertyId).length === 0
          ? <p style={{textAlign:'center',color:'var(--ink3)',fontSize:13,padding:20}}>No changes recorded yet</p>
          : changelog.filter(c=>c.pid===propertyId).map(l=>(
              <div key={l.id} style={{padding:'9px 0',borderBottom:'1px solid var(--cream2)'}}>
                <div style={{fontSize:11,color:'var(--ink3)',marginBottom:2}}>{new Date(l.time).toLocaleDateString('en-GB')} {new Date(l.time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
                <div style={{fontSize:13}}>{l.description}</div>
              </div>
            ))
        }
      </Sheet>
    </div>
  )
}
