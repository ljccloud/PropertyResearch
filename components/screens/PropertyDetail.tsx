'use client'
import { useState, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { £, pct } from '@/lib/format'
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

export function PropertyDetail({ propertyId, onClose }: Props) {
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
  const [compForm, setCompForm] = useState({ address: '', postcode: '', price: '', date: '', sqft: '' })
  const [compDateFilter, setCompDateFilter] = useState<'all'|'12'|'24'>('all')
  const [extraRenoRows, setExtraRenoRows] = useState<{id:string;label:string;value:string}[]>([])
  const [extraPFRows, setExtraPFRows] = useState<{id:string;label:string;value:string}[]>([])
  const [renoVat, setRenoVat] = useState(false)

  if (!p) return null

  const up = (patch: Partial<Property>) => updateProperty(propertyId, patch)

  // ── Calculations ──────────────────────────────────────────────
  const sdlt = calcSDLT(p.offerPrice, assumptions.sdltType)
  const af = Math.round(p.offerPrice * (assumptions.defAF / 100))
  const scPct = p.purchaseFees?.specialConditionsPct || 0
  const sc = Math.round(p.offerPrice * (scPct / 100))
  const extraPFTotal = extraPFRows.reduce((s, r) => s + (parseFloat(r.value) || 0), 0)
  const totalFees = sdlt.total + af + sc + assumptions.defLegal + extraPFTotal

  const renoBase = Object.entries(p.renovation || {}).reduce((s, [k, v]) => k !== 'extra' ? s + (Number(v) || 0) : s, 0)
    + extraRenoRows.reduce((s, r) => s + (parseFloat(r.value) || 0), 0)
  const { withVat: renoTotal } = calcRenovation({ total: renoBase }, assumptions.vatRate, renoVat)

  const lease = calcLeaseExtension(p.leaseExtension?.cost || 0, p.leaseExtension?.legal || 1500)
  const fin = calcFinancing(p.financing?.loan || 0, p.financing?.rate || assumptions.defRate, p.financing?.months || 6)

  const sub = p.offerPrice + totalFees + renoTotal
  const totalCost = sub + lease.total
  const caf = totalCost + fin.total
  const pbf = p.resaleEst - totalCost
  const paf = p.resaleEst - caf

  const yld = calcYield(p.rent, p.runningCosts, totalCost)

  // Sensitivity
  const sensCells = [-0.10, -0.05, 0, 0.05, 0.10].map(d => {
    const o2 = p.offerPrice * (1 + d)
    const s2 = calcSDLT(o2, assumptions.sdltType)
    const f2 = s2.total + Math.round(o2 * assumptions.defAF / 100) + Math.round(o2 * scPct / 100) + assumptions.defLegal + extraPFTotal
    const profit = p.resaleEst - (o2 + f2 + renoTotal + lease.total + fin.total)
    return { profit: Math.round(profit) }
  })

  // Filter comparables by date
  function fByDate(comps: Comparable[]) {
    if (compDateFilter === 'all') return comps
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - parseInt(compDateFilter))
    return comps.filter(c => c.date && new Date(c.date) >= cutoff)
  }

  // Market summary
  function ms(type: 'forsale'|'sold'|'auction') {
    const ticked = fByDate(p.comparables?.[type] || []).filter(c => c.ticked && c.psf)
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
    const comps = { ...p.comparables, [compType]: [...(p.comparables?.[compType]||[]), c] }
    up({ comparables: comps })
    // Also add to past sales
    const sale: PastSale = { id: c.id, address: c.address, postcode: c.postcode, guide: 0, dateListed: '', dateSold: c.date, soldPrice: c.price, sqft: c.sqft, sqm: 0, beds: 0, outdoor: '', notes: '', auction: compType === 'auction' }
    addPastSale(sale)
    setAddCompOpen(false)
    setCompForm({ address: '', postcode: '', price: '', date: '', sqft: '' })
  }

  function tickComp(type: 'forsale'|'sold'|'auction', idx: number) {
    const list = fByDate(p.comparables?.[type] || [])
    list[idx].ticked = !list[idx].ticked
    up({ comparables: { ...p.comparables, [type]: p.comparables?.[type] || [] } })
  }

  function CompTable({ type, dateLabel }: { type: 'forsale'|'sold'|'auction'; dateLabel: string }) {
    const comps = fByDate(p.comparables?.[type] || [])
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
                <td style={td}><div onClick={() => tickComp(type, i)} style={{ width:16,height:16,border:`1.5px solid ${c.ticked?'var(--accent)':'var(--border)'}`,borderRadius:4,display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:10,background:c.ticked?'var(--accent)':'#fff',color:'#fff' }}>{c.ticked?'✓':''}</div></td>
                <td style={td}><div style={{fontSize:11,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.address}</div><div style={{fontSize:10,color:'var(--ink3)'}}>{c.postcode}</div></td>
                <td style={{...td,fontSize:11,color:'var(--ink3)'}}>{c.date}</td>
                <td style={{...td,fontSize:11}}>{£(c.price)}</td>
                <td style={{...td,fontSize:11}}>{c.psf?'£'+c.psf:'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const th: React.CSSProperties = { padding: '5px 5px', borderBottom: '1px solid var(--border)', color: 'var(--ink3)', fontWeight: 500, fontSize: 11, textAlign: 'left' }
  const td: React.CSSProperties = { padding: '6px 5px', borderBottom: '1px solid var(--cream2)', verticalAlign: 'middle' }

  const sectionLabel = (text: string) => (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', letterSpacing: '.08em', textTransform: 'uppercase', margin: '14px 0 7px' }}>{text}</div>
  )

  const card = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, ...style }}>{children}</div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--cream)', zIndex: 150, display: 'flex', flexDirection: 'column', maxWidth: 430, left: '50%', transform: 'translateX(-50%)' }}>

      {/* Top bar */}
      <div style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingTop: 'max(10px,env(safe-area-inset-top,10px))' }}>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink2)', flexShrink: 0 }}>
          <i className="ti ti-arrow-left" style={{ fontSize: 15 }} />
        </button>
        <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 15, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.address || 'Property'}</span>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {p.url && <button onClick={() => window.open(p.url,'_blank')} style={{ background:'none',border:'1px solid var(--border)',borderRadius:6,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--ink2)' }}><i className="ti ti-external-link" /></button>}
          <button onClick={() => setClOpen(true)} style={{ background:'none',border:'1px solid var(--border)',borderRadius:6,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--ink2)' }}><i className="ti ti-history" /></button>
          <div style={{ position: 'relative' }}>
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

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--cream)', flexShrink: 0 }}>
        {(['overview','comparables','resale'] as const).map((t, i) => (
          <div key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '9px 4px', textAlign: 'center', fontSize: 11, fontWeight: 500, cursor: 'pointer', borderBottom: `2px solid ${tab===t?'var(--accent)':'transparent'}`, color: tab===t?'var(--accent)':'var(--ink3)', whiteSpace: 'nowrap' }}>
            {['Overview & Financials','Comparables','Sale & Resale'][i]}
          </div>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 80px' }}>

        {/* ── TAB 1: OVERVIEW & FINANCIALS ── */}
        {tab === 'overview' && (
          <>
            {sectionLabel('Property details')}
            {card(<>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11 }}>
                <FormRow label="Address"><Input value={p.address||''} onChange={e=>up({address:e.target.value})} /></FormRow>
                <FormRow label="Postcode"><Input value={p.postcode||''} onChange={e=>up({postcode:e.target.value})} /></FormRow>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11 }}>
                <FormRow label="Listing price"><Input type="number" value={p.listPrice||''} onChange={e=>up({listPrice:+e.target.value})} /></FormRow>
                <FormRow label="Date listed"><Input type="date" value={p.dateListed||''} onChange={e=>up({dateListed:e.target.value})} /></FormRow>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11 }}>
                <FormRow label="Sq ft">
                  <Input type="number" value={p.sqft||''} onChange={e=>up({sqft:+e.target.value})} />
                  {p.sqft && p.listPrice ? <div style={{fontSize:11,color:'var(--ink3)',marginTop:2}}>£{Math.round(p.listPrice/p.sqft)}/sqft</div> : null}
                </FormRow>
                <FormRow label="Sq m">
                  <Input type="number" value={p.sqm||''} onChange={e=>up({sqm:+e.target.value})} />
                  {p.sqm && p.listPrice ? <div style={{fontSize:11,color:'var(--ink3)',marginTop:2}}>£{Math.round(p.listPrice/p.sqm)}/sqm</div> : null}
                </FormRow>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:11 }}>
                <FormRow label="Beds"><Input type="number" value={p.beds||''} onChange={e=>up({beds:+e.target.value})} /></FormRow>
                <FormRow label="Baths"><Input type="number" value={p.baths||''} onChange={e=>up({baths:+e.target.value})} /></FormRow>
              </div>
              <FormRow label="Listing URL"><Input value={p.url||''} onChange={e=>up({url:e.target.value})} placeholder="https://rightmove.co.uk/…" /></FormRow>
              <FormRow label="Tags"><Input value={p.tags||''} onChange={e=>up({tags:e.target.value})} placeholder="Leasehold, Needs work…" /></FormRow>
            </>)}

            {sectionLabel('Price history')}
            {card(
              !p.priceHistory?.length
                ? <div style={{fontSize:12,color:'var(--ink3)',textAlign:'center',padding:6}}>No history yet</div>
                : p.priceHistory.slice().sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime()).map((h,i,arr) => {
                    const prev = i > 0 ? arr[i-1].price : null
                    const mv = prev !== null ? h.price - prev : null
                    return (
                      <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderBottom: i<arr.length-1?'1px solid var(--cream2)':'none',fontSize:12}}>
                        <span style={{color:'var(--ink2)',minWidth:82}}>{h.date}</span>
                        <span style={{fontWeight:500,flex:1}}>{£(h.price)}</span>
                        {mv !== null && mv !== 0 && <span style={{fontSize:11,padding:'2px 6px',borderRadius:99,background:mv>0?'var(--red-bg)':'var(--green-bg)',color:mv>0?'var(--red)':'var(--green)'}}>{mv>0?'+':''}{£(mv)}</span>}
                      </div>
                    )
                  }),
              { padding: '2px 12px' }
            )}
            <button onClick={() => setAddPhOpen(true)} style={{width:'100%',marginBottom:12,fontSize:13,background:'none',border:'1px solid var(--border)',borderRadius:6,padding:'10px 14px',cursor:'pointer',color:'var(--ink2)',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              <i className="ti ti-plus" style={{fontSize:12}} /> Add price point
            </button>

            {sectionLabel('Rental estimate')}
            {card(<>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <label style={{fontSize:13,color:'var(--ink2)'}}>Monthly rent estimate</label>
                <CInput type="number" value={p.rent||''} onChange={e=>up({rent:+e.target.value})} placeholder="0" />
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <label style={{fontSize:13,color:'var(--ink2)'}}>Annual running costs</label>
                <CInput type="number" value={p.runningCosts||''} onChange={e=>up({runningCosts:+e.target.value})} placeholder="0" />
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

            {sectionLabel('Offer considerations')}
            {card(<>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <label style={{fontSize:13,color:'var(--ink2)'}}>Offer price</label>
                <CInput type="number" value={p.offerPrice||''} onChange={e=>up({offerPrice:+e.target.value})} placeholder="0" />
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <label style={{fontSize:13,color:'var(--ink2)'}}>Potential resale price</label>
                <CInput type="number" value={p.resaleEst||''} onChange={e=>up({resaleEst:+e.target.value})} placeholder="0" />
              </div>
              <CalcTable rows={[
                {label:'Offer price',value:£(p.offerPrice)},
                {label:'Purchase fees',value:£(totalFees)},
                {label:'Renovation cost',value:£(renoTotal)},
                {label:'Sub-total',value:£(sub),type:'subtotal'},
                {label:'Lease extension',value:£(lease.total)},
                {label:'Total cost',value:£(totalCost),type:'subtotal'},
                {label:'Financing costs',value:£(fin.total)},
                {label:'Cost after finance',value:£(caf),type:'subtotal'},
                {label:'Potential resale',value:£(p.resaleEst)},
                {label:'Profit before finance',value:£(pbf)},
                {label:<span>Profit after finance</span>,value:<span style={{color:paf>=0?'var(--green)':'var(--red)'}}>{£(paf)}</span>,type:'total'},
              ]} />
            </>)}

            {sectionLabel('Sensitivity analysis')}
            {card(<>
              <div style={{fontSize:11,color:'var(--ink3)',marginBottom:6}}>Profit after finance at offer price ±%</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr>{['−10%','−5%','Base','+5%','+10%'].map(h=><th key={h} style={{background:'var(--cream2)',padding:'5px 6px',textAlign:'center',fontSize:11,color:'var(--ink2)',fontWeight:500}}>{h}</th>)}</tr></thead>
                <tbody><tr>{sensCells.map((c,i)=><td key={i} style={{padding:'5px 6px',textAlign:'center',borderBottom:'1px solid var(--cream2)',color:c.profit>=0?'var(--green)':'var(--red)'}}>{£(c.profit)}</td>)}</tr></tbody>
              </table>
            </>)}

            <Collapsible title="Purchase fees">
              <CalcTable rows={[
                {label:'Stamp duty (SDLT)',value:£(sdlt.total)},
                {label:<span style={{fontSize:11,color:'var(--ink3)'}}>{sdlt.breakdown.map(b=>`${b.band} @ ${b.rate}% = ${£(b.tax)}`).join(' | ')}</span>,value:''},
                {label:`Auction fee (${assumptions.defAF}%)`,value:£(af)},
                {label:<span>Special conditions (<input value={scPct} type="number" onChange={e=>up({purchaseFees:{...p.purchaseFees,specialConditionsPct:+e.target.value}})} style={{width:36,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:3,padding:'2px 4px',fontSize:11,textAlign:'right',fontFamily:"'DM Sans',sans-serif",outline:'none'}} />%)</span>,value:£(sc)},
                {label:'Legal fees',value:£(assumptions.defLegal)},
                ...extraPFRows.map(r=>({label:<input value={r.label} onChange={e=>setExtraPFRows(rows=>rows.map(x=>x.id===r.id?{...x,label:e.target.value}:x))} placeholder="Item name" style={{width:120,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:4,padding:'4px 6px',fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:'none'}}/>,value:<CInput type="number" value={r.value} onChange={e=>setExtraPFRows(rows=>rows.map(x=>x.id===r.id?{...x,value:e.target.value}:x))} style={{width:80}} />})),
                {label:'Total fees',value:£(totalFees),type:'total'},
              ]} />
              <button onClick={()=>setExtraPFRows(r=>[...r,{id:uid(),label:'',value:''}])} style={{fontSize:12,marginTop:8,padding:'6px 10px',background:'none',border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',color:'var(--ink2)',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:4}}>
                <i className="ti ti-plus" style={{fontSize:11}} /> Add item
              </button>
            </Collapsible>

            <Collapsible title="Renovation costs">
              <CalcTable rows={[
                ...(['paint','kitchen','bathroom','electrics','boiler','windows','builder'] as const).map(k=>({
                  label:{'paint':'Painting & decorating','kitchen':'Kitchen','bathroom':'Bathroom','electrics':'Electrics','boiler':'Boiler','windows':'New windows','builder':"Builder's estimate"}[k],
                  value:<CInput type="number" value={p.renovation?.[k]||0} onChange={e=>up({renovation:{...p.renovation,[k]:+e.target.value}})} />
                })),
                ...extraRenoRows.map(r=>({
                  label:<input value={r.label} onChange={e=>setExtraRenoRows(rows=>rows.map(x=>x.id===r.id?{...x,label:e.target.value}:x))} placeholder="Item name" style={{width:120,background:'var(--cream)',border:'1px solid var(--border)',borderRadius:4,padding:'4px 6px',fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:'none'}}/>,
                  value:<CInput type="number" value={r.value} onChange={e=>setExtraRenoRows(rows=>rows.map(x=>x.id===r.id?{...x,value:e.target.value}:x))} />
                })),
                {label:'Total estimate',value:£(renoBase),type:'subtotal'},
                {label:<label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}><input type="checkbox" checked={renoVat} onChange={e=>setRenoVat(e.target.checked)} /> Incl. VAT ({assumptions.vatRate}%)</label>,value:renoVat?£(renoTotal):'—'},
              ]} />
              <button onClick={()=>setExtraRenoRows(r=>[...r,{id:uid(),label:'',value:''}])} style={{fontSize:12,marginTop:8,padding:'6px 10px',background:'none',border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',color:'var(--ink2)',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:4}}>
                <i className="ti ti-plus" style={{fontSize:11}} /> Add item
              </button>
            </Collapsible>

            <Collapsible title="Lease extension">
              <CalcTable rows={[
                {label:'Cost of extending',value:<CInput type="number" value={p.leaseExtension?.cost||0} onChange={e=>up({leaseExtension:{...p.leaseExtension,cost:+e.target.value}})} />},
                {label:'SDLT on extension (5%)',value:£(lease.sdlt)},
                {label:'Legal fees',value:<CInput type="number" value={p.leaseExtension?.legal||1500} onChange={e=>up({leaseExtension:{...p.leaseExtension,legal:+e.target.value}})} />},
                {label:'Total',value:£(lease.total),type:'total'},
              ]} />
            </Collapsible>

            <Collapsible title="Financing charges">
              <CalcTable rows={[
                {label:'Loan amount',value:<CInput type="number" value={p.financing?.loan||''} onChange={e=>up({financing:{...p.financing,loan:+e.target.value}})} />},
                {label:'Interest rate (%)',value:<CInput type="number" value={p.financing?.rate||assumptions.defRate} onChange={e=>up({financing:{...p.financing,rate:+e.target.value}})} />},
                {label:'Annual interest',value:£(fin.annual)},
                {label:'Monthly interest',value:£(fin.monthly)},
                {label:'Months to complete',value:<CInput type="number" value={p.financing?.months||6} onChange={e=>up({financing:{...p.financing,months:+e.target.value}})} />},
                {label:'Financing cost',value:£(fin.total),type:'total'},
              ]} />
            </Collapsible>

            {sectionLabel('Notes')}
            <Textarea value={p.notes||''} onChange={e=>up({notes:e.target.value})} placeholder="Add notes about this property…" style={{minHeight:100,marginBottom:16}} />
          </>
        )}

        {/* ── TAB 2: COMPARABLES ── */}
        {tab === 'comparables' && (
          <>
            {/* Market summary */}
            <div style={{background:'var(--cream2)',border:'1px solid var(--border)',borderRadius:10,padding:12,marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:600,color:'var(--ink)',marginBottom:8}}>Market summary — ticked comparables</div>
              <div style={{display:'grid',gridTemplateColumns:'68px 1fr 1fr 1fr',gap:3}}>
                {['','High','Mid','Low'].map(h=><div key={h} style={{fontSize:10,color:'var(--ink3)',textAlign:'center',fontWeight:500,padding:3}}>{h}</div>)}
                {[['For sale',msFS],['Sold',msS],['Auction',msA]].map(([lbl,s]:any)=>[
                  <div key={lbl} style={{fontSize:11,color:'var(--ink2)',display:'flex',alignItems:'center'}}>{lbl}</div>,
                  ...(['h','m','l'] as const).map(k=><div key={k} style={{fontSize:11,fontWeight:600,textAlign:'center',padding:'4px 2px',background:'#fff',borderRadius:4,border:'1px solid var(--border)'}}>{s[k]}</div>)
                ])}
              </div>
            </div>

            {/* Date filter */}
            <div style={{display:'flex',gap:5,marginBottom:10}}>
              {([['all','All dates'],['12','Last 12 months'],['24','Last 24 months']] as const).map(([f,lbl])=>(
                <span key={f} onClick={()=>setCompDateFilter(f)} style={{background:compDateFilter===f?'var(--accent)':'var(--cream2)',border:`1px solid ${compDateFilter===f?'var(--accent)':'var(--border)'}`,color:compDateFilter===f?'#fff':'var(--ink2)',borderRadius:99,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>{lbl}</span>
              ))}
            </div>

            {/* Map */}
            <ComparablesMapDynamic subjectPostcode={p.postcode} subjectAddress={p.address} comparables={p.comparables||{forsale:[],sold:[],auction:[]}} />

            {[{type:'forsale' as const,label:'For sale',dateLabel:'Listed'},{type:'sold' as const,label:'Sold',dateLabel:'Sold'},{type:'auction' as const,label:'Sold at auction',dateLabel:'Sold'}].map(({type,label,dateLabel})=>(
              <div key={type}>
                {sectionLabel(label)}
                <CompTable type={type} dateLabel={dateLabel} />
                <button onClick={()=>{setCompType(type);setAddCompOpen(true)}} style={{width:'100%',fontSize:13,marginBottom:12,background:'none',border:'1px solid var(--border)',borderRadius:6,padding:'10px 14px',cursor:'pointer',color:'var(--ink2)',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                  <i className="ti ti-plus" style={{fontSize:12}} /> Add comparable
                </button>
              </div>
            ))}
          </>
        )}

        {/* ── TAB 3: SALE & RESALE ── */}
        {tab === 'resale' && (
          <>
            {sectionLabel('Sale details')}
            {card(<>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <FormRow label="Final sold price"><Input type="number" value={p.finalSoldPrice||''} onChange={e=>up({finalSoldPrice:+e.target.value})} placeholder="0" /></FormRow>
                <FormRow label="Date sold"><Input type="date" value={p.finalSoldDate||''} onChange={e=>up({finalSoldDate:e.target.value})} /></FormRow>
              </div>
            </>)}

            {sectionLabel('Resale')}
            {card(<>
              <FormRow label="Target resale price"><Input type="number" value={p.targetResale||''} onChange={e=>up({targetResale:+e.target.value})} placeholder="0" /></FormRow>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <FormRow label="Actual resale price"><Input type="number" value={p.actualResale||''} onChange={e=>up({actualResale:+e.target.value})} placeholder="0" /></FormRow>
                <FormRow label="Date resold"><Input type="date" value={p.actualResaleDate||''} onChange={e=>up({actualResaleDate:e.target.value})} /></FormRow>
              </div>
            </>)}

            {sectionLabel('Implied outcome')}
            {card(
              (!p.finalSoldPrice && !p.targetResale && !p.actualResale)
                ? <div style={{fontSize:12,color:'var(--ink3)'}}>Enter prices to see implied outcome</div>
                : <>
                    {[
                      p.finalSoldPrice ? ['Purchase price', £(p.finalSoldPrice), null] : null,
                      p.targetResale   ? ['Target resale',  £(p.targetResale),  null] : null,
                      p.actualResale   ? ['Actual resale',  £(p.actualResale),  null] : null,
                      (p.finalSoldPrice && p.actualResale) ? ['Gross gain', £(p.actualResale - p.finalSoldPrice), p.actualResale >= p.finalSoldPrice ? 'var(--green)' : 'var(--red)'] : null,
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

      {/* ── SHEETS ── */}
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
        footer={<><Btn onClick={()=>setAddPhOpen(false)}>Cancel</Btn><Btn variant="primary" full onClick={()=>{if(!phDate&&!phPrice)return;up({priceHistory:[...(p.priceHistory||[]),{date:phDate,price:parseFloat(phPrice)||0}]});setAddPhOpen(false);setPhDate('');setPhPrice('');}}>Add</Btn></>}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <FormRow label="Date"><Input type="date" value={phDate} onChange={e=>setPhDate(e.target.value)} /></FormRow>
          <FormRow label="Price"><Input type="number" value={phPrice} onChange={e=>setPhPrice(e.target.value)} /></FormRow>
        </div>
      </Sheet>

      <Sheet open={addCompOpen} onClose={()=>setAddCompOpen(false)} title={{forsale:'Add for-sale comparable',sold:'Add sold comparable',auction:'Add auction comparable'}[compType]}
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
