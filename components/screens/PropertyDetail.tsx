'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { gbp, pct } from '@/lib/format'
import { calcSDLT, calcFinancing, calcLeaseExtension, calcRenovation, calcYield } from '@/lib/calculations'
import { Sheet } from '@/components/ui/Sheet'
import { Btn } from '@/components/ui/Btn'
import { Collapsible } from '@/components/ui/Collapsible'
import { CalcTable } from '@/components/ui/CalcTable'
import { FormRow, Input, CInput, Textarea } from '@/components/ui/FormRow'
import { ComparablesMapDynamic } from '@/components/map/ComparablesMapDynamic'
import type { Property, Comparable, PastSale } from '@/types'
import { uid } from '@/types'

interface Props { propertyId: string; onClose: () => void }

// Compact inline input for calc tables — no background, just a plain number field
function TInput({ value, onChange, placeholder }: { value: string|number; onChange: (v: number) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      value={value === 0 ? '' : value}
      placeholder={placeholder || '0'}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      style={{ width: 90, textAlign: 'right', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: 'none', color: 'var(--ink)' }}
    />
  )
}

// Read-only value cell for calc tables
function Val({ children, colour }: { children: React.ReactNode; colour?: string }) {
  return <span style={{ fontSize: 13, fontWeight: 500, color: colour || 'var(--ink)' }}>{children}</span>
}

const SQM_PER_SQFT = 0.092903

export function PropertyDetail({ propertyId, onClose }: Props) {
  const { properties, assumptions, updateProperty, archiveProperty, duplicateProperty, addPastSale, changelog } = useStore()
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
  const [compForm, setCompForm] = useState({ address: '', postcode: '', price: '', date: '', sqft: '' })
  const [compDateFilter, setCompDateFilter] = useState<'all'|'12'|'24'>('all')
  const [extraRenoRows, setExtraRenoRows] = useState<{id:string;label:string;value:string}[]>([])
  const [extraPFRows, setExtraPFRows] = useState<{id:string;label:string;value:string}[]>([])
  const [renoVat, setRenoVat] = useState(false)
  // Track whether loan has been manually overridden
  const [loanOverride, setLoanOverride] = useState(false)

  if (!p) return null
  const prop = p as Property
  const up = (patch: Partial<Property>) => updateProperty(propertyId, patch)

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
  const af = Math.round(prop.offerPrice * (assumptions.defAF / 100))
  const scPct = prop.purchaseFees?.specialConditionsPct || 0
  const sc = Math.round(prop.offerPrice * (scPct / 100))
  const extraPFTotal = extraPFRows.reduce((s, r) => s + (parseFloat(r.value) || 0), 0)
  // Purchase fees excludes SDLT (shown separately)
  const otherFees = af + sc + assumptions.defLegal + extraPFTotal
  const totalFees = sdlt.total + otherFees

  const renoBase = Object.entries(prop.renovation || {})
    .reduce((s, [k, v]) => k !== 'extra' ? s + (Number(v) || 0) : s, 0)
    + extraRenoRows.reduce((s, r) => s + (parseFloat(r.value) || 0), 0)
  const { withVat: renoTotal } = calcRenovation({ total: renoBase }, assumptions.vatRate, renoVat)

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
    const f2 = s2.total + Math.round(o2 * assumptions.defAF / 100) + Math.round(o2 * scPct / 100) + assumptions.defLegal + extraPFTotal
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
    const ticked = fByDate(prop.comparables?.[type] || []).filter(c => c.ticked && c.psf)
    if (!ticked.length) return { h: '—', m: '—', l: '—' }
    const vals = ticked.map(c => c.psf!).sort((a, b) => b - a)
    return { h: '£'+vals[0], m: '£'+Math.round(vals.reduce((a,b)=>a+b,0)/vals.length), l: '£'+vals[vals.length-1] }
  }
  const msFS = ms('forsale'), msS = ms('sold'), msA = ms('auction')

  function addComp() {
    const c: Comparable = {
      id: uid(), address: compForm.address, postcode: compForm.postcode,
      price: parseFloat(compForm.price)||0, date: compForm.date,
      sqft: parseFloat(compForm.sqft)||0, ticked: false,
    }
    if (c.sqft) c.psf = Math.round(c.price / c.sqft)
    const comps = { ...prop.comparables, [compType]: [...(prop.comparables?.[compType]||[]), c] }
    up({ comparables: comps })
    const sale: PastSale = { id: c.id, address: c.address, postcode: c.postcode, guide: 0, dateListed: '', dateSold: c.date, soldPrice: c.price, sqft: c.sqft, sqm: 0, beds: 0, outdoor: '', notes: '', auction: compType === 'auction' }
    addPastSale(sale)
    setAddCompOpen(false)
    setCompForm({ address: '', postcode: '', price: '', date: '', sqft: '' })
  }

  function tickComp(type: 'forsale'|'sold'|'auction', idx: number) {
    const all = prop.comparables?.[type] || []
    const filtered = fByDate(all)
    filtered[idx].ticked = !filtered[idx].ticked
    up({ comparables: { ...prop.comparables, [type]: all } })
  }

  // ── Style helpers ─────────────────────────────────────────────
  const th: React.CSSProperties = { padding: '5px', borderBottom: '1px solid var(--border)', color: 'var(--ink3)', fontWeight: 500, fontSize: 11, textAlign: 'left' }
  const td: React.CSSProperties = { padding: '6px 5px', borderBottom: '1px solid var(--cream2)', verticalAlign: 'middle' }

  const sL = (text: string) => (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', letterSpacing: '.08em', textTransform: 'uppercase', margin: '14px 0 7px' }}>{text}</div>
  )
  const card = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, ...style }}>{children}</div>
  )

  // Compact table row helper
  const row = (label: React.ReactNode, value: React.ReactNode, muted = false) => ({ label: muted ? <span style={{color:'var(--ink3)'}}>{label}</span> : label, value })
  const subtotalRow = (label: string, value: string) => ({ label, value, type: 'subtotal' as const })
  const totalRow = (label: string, value: React.ReactNode) => ({ label, value, type: 'total' as const })

  function CompTable({ type, dateLabel }: { type: 'forsale'|'sold'|'auction'; dateLabel: string }) {
    const comps = fByDate(prop.comparables?.[type] || [])
    if (!comps.length) return <div style={{ fontSize: 12, color: 'var(--ink3)', padding: '4px 0 8px' }}>None added yet</div>
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <colgroup><col style={{width:20}}/><col/><col style={{width:72}}/><col style={{width:68}}/><col style={{width:56}}/></colgroup>
          <thead><tr>
            <th style={th}></th><th style={th}>Address</th><th style={th}>{dateLabel}</th><th style={th}>Price</th><th style={th}>£/sqft</th>
          </tr></thead>
          <tbody>
            {comps.map((c, i) => (
              <tr key={c.id}>
                <td style={td}>
                  <div onClick={() => tickComp(type, i)} style={{ width:16,height:16,border:`1.5px solid ${c.ticked?'var(--accent)':'var(--border)'}`,borderRadius:4,display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:10,background:c.ticked?'var(--accent)':'#fff',color:'#fff' }}>{c.ticked?'✓':''}</div>
                </td>
                <td style={td}><div style={{fontSize:11,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.address}</div><div style={{fontSize:10,color:'var(--ink3)'}}>{c.postcode}</div></td>
                <td style={{...td,fontSize:11,color:'var(--ink3)'}}>{c.date}</td>
                <td style={{...td,fontSize:11}}>{gbp(c.price)}</td>
                <td style={{...td,fontSize:11}}>{c.psf ? '£'+c.psf : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--cream)', zIndex: 150, display: 'flex', flexDirection: 'column', maxWidth: 430, left: '50%', transform: 'translateX(-50%)' }}>

      {/* ── Top bar ── */}
      <div style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingTop: 'max(10px,env(safe-area-inset-top,10px))' }}>
        <button onClick={onClose} style={{ background:'none',border:'1px solid var(--border)',borderRadius:6,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--ink2)',flexShrink:0 }}>
          <i className="ti ti-arrow-left" style={{ fontSize: 15 }} />
        </button>
        <span style={{ fontFamily:"'DM Serif Display',serif",fontSize:15,flex:1,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis' }}>{prop.address || 'Property'}</span>
        <div style={{ display:'flex',gap:6,flexShrink:0 }}>
          {prop.url && <button onClick={() => window.open(prop.url,'_blank')} style={{ background:'none',border:'1px solid var(--border)',borderRadius:6,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--ink2)' }}><i className="ti ti-external-link" /></button>}
          <button onClick={() => setClOpen(true)} style={{ background:'none',border:'1px solid var(--border)',borderRadius:6,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--ink2)' }}><i className="ti ti-history" /></button>
          <div style={{ position:'relative' }}>
            <button onClick={() => setOvfOpen(!ovfOpen)} style={{ background:'none',border:'1px solid var(--border)',borderRadius:6,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--ink2)' }}><i className="ti ti-dots" /></button>
            {ovfOpen && (
              <div style={{ position:'absolute',top:38,right:0,background:'#fff',border:'1px solid var(--border)',borderRadius:10,zIndex:10,minWidth:140,overflow:'hidden',boxShadow:'0 4px 16px rgba(0,0,0,.08)' }}>
                <div onClick={() => { setOvfOpen(false); duplicateProperty(propertyId); onClose() }} style={{ padding:'11px 14px',fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:8 }}><i className="ti ti-copy" />Duplicate</div>
                <div onClick={() => { setOvfOpen(false); setArchiveOpen(true) }} style={{ padding:'11px 14px',fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:8,color:'var(--red)' }}><i className="ti ti-archive" />Archive</div>
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
      <div style={{ flex:1,overflowY:'auto',padding:'12px 16px 80px' }}>

        {/* ════ TAB 1: OVERVIEW & FINANCIALS ════ */}
        {tab === 'overview' && (
          <>
            {sL('Property details')}
            {card(<>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11 }}>
                <FormRow label="Address"><Input value={prop.address||''} onChange={e=>up({address:e.target.value})} /></FormRow>
                <FormRow label="Postcode"><Input value={prop.postcode||''} onChange={e=>up({postcode:e.target.value})} /></FormRow>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11 }}>
                <FormRow label="Listing price"><Input type="number" value={prop.listPrice||''} onChange={e=>up({listPrice:+e.target.value})} /></FormRow>
                <FormRow label="Date listed"><Input type="date" value={prop.dateListed||''} onChange={e=>up({dateListed:e.target.value})} /></FormRow>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11 }}>
                <FormRow label="Sq ft">
                  <Input type="number" value={prop.sqft||''} onChange={e => onSqftChange(+e.target.value)} placeholder="e.g. 850" />
                  {prop.sqft && prop.listPrice ? <div style={{fontSize:11,color:'var(--ink3)',marginTop:2}}>£{Math.round(prop.listPrice/prop.sqft)}/sqft</div> : null}
                </FormRow>
                <FormRow label="Sq m">
                  <Input type="number" value={prop.sqm||''} onChange={e => onSqmChange(+e.target.value)} placeholder="e.g. 79" />
                  {prop.sqm && prop.listPrice ? <div style={{fontSize:11,color:'var(--ink3)',marginTop:2}}>£{Math.round(prop.listPrice/prop.sqm)}/sqm</div> : null}
                </FormRow>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11 }}>
                <FormRow label="Beds"><Input type="number" value={prop.beds||''} onChange={e=>up({beds:+e.target.value})} /></FormRow>
                <FormRow label="Baths"><Input type="number" value={prop.baths||''} onChange={e=>up({baths:+e.target.value})} /></FormRow>
              </div>
              <FormRow label="Listing URL"><Input value={prop.url||''} onChange={e=>up({url:e.target.value})} placeholder="https://rightmove.co.uk/…" /></FormRow>
              <FormRow label="Tags"><Input value={prop.tags||''} onChange={e=>up({tags:e.target.value})} placeholder="Leasehold, Needs work…" /></FormRow>
            </>)}

            {sL('Price history')}
            {card(
              !prop.priceHistory?.length
                ? <div style={{fontSize:12,color:'var(--ink3)',textAlign:'center',padding:6}}>No history yet</div>
                : prop.priceHistory.slice().sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime()).map((h,i,arr) => {
                    const prev = i > 0 ? arr[i-1].price : null
                    const mv = prev !== null ? h.price - prev : null
                    return (
                      <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderBottom:i<arr.length-1?'1px solid var(--cream2)':'none',fontSize:12}}>
                        <span style={{color:'var(--ink2)',minWidth:82}}>{h.date}</span>
                        <span style={{fontWeight:500,flex:1}}>{gbp(h.price)}</span>
                        {mv !== null && mv !== 0 && <span style={{fontSize:11,padding:'2px 6px',borderRadius:99,background:mv>0?'var(--red-bg)':'var(--green-bg)',color:mv>0?'var(--red)':'var(--green)'}}>{mv>0?'+':''}{gbp(mv)}</span>}
                      </div>
                    )
                  }),
              { padding: '2px 12px' }
            )}
            <button onClick={() => setAddPhOpen(true)} style={{width:'100%',marginBottom:12,fontSize:13,background:'none',border:'1px solid var(--border)',borderRadius:6,padding:'10px 14px',cursor:'pointer',color:'var(--ink2)',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              <i className="ti ti-plus" style={{fontSize:12}} /> Add price point
            </button>

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

            {sL('Offer considerations')}
            {card(<>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <label style={{fontSize:13,color:'var(--ink2)'}}>Offer price</label>
                <TInput value={prop.offerPrice||''} onChange={v=>up({offerPrice:v})} />
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <label style={{fontSize:13,color:'var(--ink2)'}}>Potential resale price</label>
                <TInput value={prop.resaleEst||''} onChange={v=>up({resaleEst:v})} />
              </div>
              <CalcTable rows={[
                row('Offer price', <Val>{gbp(prop.offerPrice)}</Val>, true),
                row('Stamp duty (SDLT)', <Val>{gbp(sdlt.total)}</Val>, true),
                row('Other purchase fees', <Val>{gbp(otherFees)}</Val>, true),
                row('Renovation cost', <Val>{gbp(renoTotal)}</Val>, true),
                subtotalRow('Sub-total', gbp(sub)),
                row('Lease extension', <Val>{gbp(lease.total)}</Val>, true),
                subtotalRow('Total cost', gbp(totalCost)),
                row('Financing costs', <Val>{gbp(fin.total)}</Val>, true),
                subtotalRow('Cost after finance', gbp(caf)),
                row('Potential resale', <Val>{gbp(prop.resaleEst)}</Val>, true),
                row('Profit before finance', <Val>{gbp(pbf)}</Val>, true),
                totalRow('Profit after finance', <Val colour={paf>=0?'var(--green)':'var(--red)'}>{gbp(paf)}</Val>),
              ]} />
            </>)}

            {sL('Sensitivity analysis')}
            {card(<>
              <div style={{fontSize:11,color:'var(--ink3)',marginBottom:6}}>Profit after finance at offer price ±%</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>{['−10%','−5%','Base','+5%','+10%'].map(h=><th key={h} style={{background:'var(--cream2)',padding:'5px 6px',textAlign:'center',fontSize:11,color:'var(--ink2)',fontWeight:500}}>{h}</th>)}</tr></thead>
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
                row(`Auction fee (${assumptions.defAF}%)`, <Val>{gbp(af)}</Val>, true),
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
                row('Legal fees', <Val>{gbp(assumptions.defLegal)}</Val>, true),
                ...extraPFRows.map(r => row(
                  <input value={r.label} onChange={e=>setExtraPFRows(rows=>rows.map(x=>x.id===r.id?{...x,label:e.target.value}:x))} placeholder="Item name" style={{width:120,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:4,padding:'4px 6px',fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:'none'}} />,
                  <TInput value={r.value} onChange={v=>setExtraPFRows(rows=>rows.map(x=>x.id===r.id?{...x,value:String(v)}:x))} />
                )),
                totalRow('Total purchase fees', <Val>{gbp(otherFees)}</Val>),
              ]} />
              <button onClick={()=>setExtraPFRows(r=>[...r,{id:uid(),label:'',value:''}])} style={{fontSize:12,marginTop:8,padding:'6px 10px',background:'none',border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',color:'var(--ink2)',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:4}}>
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
                ...extraRenoRows.map(r => row(
                  <input value={r.label} onChange={e=>setExtraRenoRows(rows=>rows.map(x=>x.id===r.id?{...x,label:e.target.value}:x))} placeholder="Item name" style={{width:120,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:4,padding:'4px 6px',fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:'none'}} />,
                  <TInput value={r.value} onChange={v=>setExtraRenoRows(rows=>rows.map(x=>x.id===r.id?{...x,value:String(v)}:x))} />
                )),
                subtotalRow('Total estimate', gbp(renoBase)),
                row(
                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
                    <input type="checkbox" checked={renoVat} onChange={e=>setRenoVat(e.target.checked)} />
                    Incl. VAT ({assumptions.vatRate}%)
                  </label>,
                  renoVat ? <Val>{gbp(renoTotal)}</Val> : <span style={{color:'var(--ink3)'}}>—</span>
                ),
              ]} />
              <button onClick={()=>setExtraRenoRows(r=>[...r,{id:uid(),label:'',value:''}])} style={{fontSize:12,marginTop:8,padding:'6px 10px',background:'none',border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',color:'var(--ink2)',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:4}}>
                <i className="ti ti-plus" style={{fontSize:11}} /> Add item
              </button>
            </Collapsible>

            {/* ── LEASE EXTENSION ── */}
            <Collapsible title="Lease extension">
              <CalcTable rows={[
                row('Cost of extending', <TInput value={prop.leaseExtension?.cost||''} onChange={v=>up({leaseExtension:{...prop.leaseExtension,cost:v}})} />),
                row('SDLT on extension (5%)', <Val>{gbp(lease.sdlt)}</Val>, true),
                row('Legal fees', <TInput value={prop.leaseExtension?.legal||''} onChange={v=>up({leaseExtension:{...prop.leaseExtension,legal:v}})} placeholder="0" />),
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
                      ? <span onClick={()=>{setLoanOverride(false);up({financing:{...prop.financing,loan:autoLoan}})}} style={{fontSize:10,color:'var(--accent)',cursor:'pointer',textDecoration:'underline'}}>reset to auto</span>
                      : <span style={{fontSize:10,color:'var(--ink3)'}}>= total cost</span>
                    }
                  </span>,
                  <TInput
                    value={loanOverride ? (prop.financing?.loan||'') : autoLoan}
                    onChange={v=>{setLoanOverride(true);up({financing:{...prop.financing,loan:v}})}}
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

            {sL('Notes')}
            <Textarea value={prop.notes||''} onChange={e=>up({notes:e.target.value})} placeholder="Add notes about this property…" style={{minHeight:100,marginBottom:16}} />
          </>
        )}

        {/* ════ TAB 2: COMPARABLES ════ */}
        {tab === 'comparables' && (
          <>
            <div style={{background:'var(--cream2)',border:'1px solid var(--border)',borderRadius:10,padding:12,marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:600,color:'var(--ink)',marginBottom:8}}>Market summary — ticked comparables</div>
              <div style={{display:'grid',gridTemplateColumns:'68px 1fr 1fr 1fr',gap:3}}>
                {['','High','Mid','Low'].map(h=><div key={h} style={{fontSize:10,color:'var(--ink3)',textAlign:'center',fontWeight:500,padding:3}}>{h}</div>)}
                {([['For sale',msFS],['Sold',msS],['Auction',msA]] as const).map(([lbl,s]:any)=>[
                  <div key={lbl} style={{fontSize:11,color:'var(--ink2)',display:'flex',alignItems:'center'}}>{lbl}</div>,
                  ...(['h','m','l'] as const).map(k=><div key={k} style={{fontSize:11,fontWeight:600,textAlign:'center',padding:'4px 2px',background:'#fff',borderRadius:4,border:'1px solid var(--border)'}}>{s[k]}</div>)
                ])}
              </div>
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
                <CompTable type={type} dateLabel={dateLabel} />
                <button onClick={()=>{setCompType(type);setAddCompOpen(true)}} style={{width:'100%',fontSize:13,marginBottom:12,background:'none',border:'1px solid var(--border)',borderRadius:6,padding:'10px 14px',cursor:'pointer',color:'var(--ink2)',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                  <i className="ti ti-plus" style={{fontSize:12}} /> Add comparable
                </button>
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
          <FormRow label="Price"><Input type="number" value={compForm.price} onChange={e=>setCompForm(s=>({...s,price:e.target.value}))} /></FormRow>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <FormRow label="Date"><Input type="date" value={compForm.date} onChange={e=>setCompForm(s=>({...s,date:e.target.value}))} /></FormRow>
          <FormRow label="Sq ft"><Input type="number" value={compForm.sqft} onChange={e=>setCompForm(s=>({...s,sqft:e.target.value}))} /></FormRow>
        </div>
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
