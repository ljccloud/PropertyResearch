'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { gbp } from '@/lib/format'
import { Sheet } from '@/components/ui/Sheet'
import { Btn } from '@/components/ui/Btn'
import { FormRow, Input, Textarea } from '@/components/ui/FormRow'
import type { PastSale } from '@/types'
import { uid } from '@/types'

function fmtDate(d: string): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export function PastSalesScreen() {
  const { pastSales, addPastSale, updatePastSale } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all'|'sold'|'auction'>('all')

  useEffect(() => {
    function handleFab() { setAddOpen(true) }
    window.addEventListener('fab-action', handleFab)
    return () => window.removeEventListener('fab-action', handleFab)
  }, [])
  const [addOpen, setAddOpen] = useState(false)
  const [detailSale, setDetailSale] = useState<PastSale | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<Partial<PastSale>>({})
  const [form, setForm] = useState({
    address: '', postcode: '', guide: '', dateListed: '', dateSold: '',
    soldPrice: '', sqft: '', sqm: '', beds: '', outdoor: '', notes: '', auction: false,
  })

  // We soft-delete by setting a deleted flag via updatePastSale
  const visibleSales = pastSales.filter((s: any) => !s.deleted)

  const filtered = visibleSales.filter(s => {
    if (filter === 'sold' && s.auction) return false
    if (filter === 'auction' && !s.auction) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(s.address + ' ' + s.postcode).toLowerCase().includes(q)) return false
    }
    return true
  })

  const sold = filtered.filter(s => !s.auction)
  const auction = filtered.filter(s => s.auction)

  function handleAdd() {
    const s: PastSale = {
      id: uid(), address: form.address, postcode: form.postcode,
      guide: parseFloat(form.guide) || 0,
      dateListed: form.dateListed ? form.dateListed + '-01' : '',
      dateSold: form.dateSold ? form.dateSold + '-01' : '',
      soldPrice: parseFloat(form.soldPrice) || 0,
      sqft: parseFloat(form.sqft) || 0, sqm: parseFloat(form.sqm) || 0,
      beds: parseFloat(form.beds) || 0, outdoor: form.outdoor,
      notes: form.notes, auction: form.auction,
    }
    addPastSale(s)
    setAddOpen(false)
    setForm({ address: '', postcode: '', guide: '', dateListed: '', dateSold: '', soldPrice: '', sqft: '', sqm: '', beds: '', outdoor: '', notes: '', auction: false })
  }

  function handleDelete(id: string) {
    updatePastSale(id, { deleted: true } as any)
    setConfirmDeleteId(null)
    if (detailSale?.id === id) setDetailSale(null)
  }

  function pctAbove(sold: number, guide: number): string | null {
    if (!sold || !guide) return null
    const diff = ((sold - guide) / guide) * 100
    if (Math.abs(diff) < 0.1) return null
    return (diff > 0 ? '+' : '') + diff.toFixed(1) + '% vs guide'
  }

  const confirmSale = pastSales.find(s => s.id === confirmDeleteId)

  function SaleRow({ s }: { s: PastSale }) {
    const psfVal = s.sqft ? Math.round(s.soldPrice / s.sqft) : 0
    const above = pctAbove(s.soldPrice, s.guide)
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--cream2)' }}>
        <div onClick={() => setDetailSale(s)} style={{ flex: 1, minWidth: 0, cursor: 'pointer', marginRight: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.address}</div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 1, display: 'flex', flexWrap: 'wrap', gap: '0 6px' }}>
            <span>{s.postcode}</span>
            {s.dateSold && <span>{fmtDate(s.dateSold)}</span>}
            {s.beds ? <span>{s.beds} bed</span> : null}
            {s.sqft ? <span>{s.sqft.toLocaleString('en-GB')} sqft</span> : null}
            {s.auction && <span style={{ color: 'var(--amber)', fontWeight: 500 }}>Auction</span>}
            {above && <span style={{ color: s.soldPrice > s.guide ? 'var(--red)' : 'var(--green)', fontWeight: 500 }}>{above}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{gbp(s.soldPrice)}</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{psfVal ? '£' + psfVal.toLocaleString('en-GB') + '/sqft' : ''}</div>
          </div>
          <button onClick={() => setConfirmDeleteId(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink3)', fontSize: 16, padding: '2px 4px', lineHeight: 1 }} title="Delete">
            <i className="ti ti-trash" style={{ fontSize: 14 }} />
          </button>
        </div>
      </div>
    )
  }

  function Section({ title, items }: { title: string; items: PastSale[] }) {
    if (!items.length) return null
    return (
      <>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', letterSpacing: '.07em', textTransform: 'uppercase', margin: '14px 0 7px', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>{title}</div>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '0 12px', marginBottom: 10 }}>
          {items.map(s => <SaleRow key={s.id} s={s} />)}
        </div>
      </>
    )
  }

  const mInput = (label: string, id: string, value: string, onChange: (v: string) => void) => (
    <FormRow label={label}>
      <input
        type="month"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: value ? 'var(--ink)' : 'var(--ink3)', outline: 'none', WebkitAppearance: 'none', appearance: 'none' }}
      />
    </FormRow>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 11px', marginBottom: 10 }}>
        <i className="ti ti-search" style={{ color: 'var(--ink3)', fontSize: 16 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by postcode or keyword…" style={{ border: 'none', background: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: 14, flex: 1, outline: 'none', color: 'var(--ink)' }} />
      </div>

      <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
        {(['all', 'sold', 'auction'] as const).map(f => (
          <span key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? 'var(--accent)' : 'var(--cream2)', border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`, color: filter === f ? '#fff' : 'var(--ink2)', borderRadius: 99, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
            {f === 'all' ? 'All' : f === 'sold' ? 'Sold' : 'Auction'}
          </span>
        ))}
      </div>

      {filter !== 'auction' && <Section title="Sold" items={sold} />}
      {filter !== 'sold' && <Section title="Sold at auction" items={auction} />}
      {!filtered.length && <p style={{ textAlign: 'center', color: 'var(--ink3)', padding: 28, fontSize: 13 }}>No entries yet. Tap + to add.</p>}



      {/* Add past sale sheet */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add past sale"
        footer={<><Btn onClick={() => setAddOpen(false)}>Cancel</Btn><Btn variant="primary" full onClick={handleAdd}>Save</Btn></>}>
        <FormRow label="Address"><Input value={form.address} onChange={e => setForm(s => ({ ...s, address: e.target.value }))} /></FormRow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
          <FormRow label="Postcode"><Input value={form.postcode} onChange={e => setForm(s => ({ ...s, postcode: e.target.value }))} /></FormRow>
          <FormRow label="Guide / list price"><Input type="number" value={form.guide} onChange={e => setForm(s => ({ ...s, guide: e.target.value }))} /></FormRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
          {mInput('Date listed', 'as-dlisted', form.dateListed, v => setForm(s => ({ ...s, dateListed: v })))}
          {mInput('Date sold', 'as-dsold', form.dateSold, v => setForm(s => ({ ...s, dateSold: v })))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
          <FormRow label="Sold price"><Input type="number" value={form.soldPrice} onChange={e => setForm(s => ({ ...s, soldPrice: e.target.value }))} /></FormRow>
          <FormRow label="Sq ft"><Input type="number" value={form.sqft} onChange={e => setForm(s => ({ ...s, sqft: e.target.value }))} /></FormRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
          <FormRow label="Sq m"><Input type="number" value={form.sqm} onChange={e => setForm(s => ({ ...s, sqm: e.target.value }))} /></FormRow>
          <FormRow label="Bedrooms"><Input type="number" value={form.beds} onChange={e => setForm(s => ({ ...s, beds: e.target.value }))} /></FormRow>
        </div>
        <FormRow label="Outdoor space">
          <select value={form.outdoor} onChange={e => setForm(s => ({ ...s, outdoor: e.target.value }))} style={{ width: '100%', background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontFamily: "'DM Sans',sans-serif", fontSize: 13, outline: 'none', WebkitAppearance: 'none', appearance: 'none', color: form.outdoor ? 'var(--ink)' : 'var(--ink3)' }}>
            <option value="">Select...</option>
            <option value="none">None</option>
            <option value="shared-garden">Shared garden</option>
            <option value="garden">Garden</option>
            <option value="balcony">Balcony</option>
            <option value="terrace">Terrace</option>
            <option value="roof-terrace">Roof terrace</option>
          </select>
        </FormRow>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
          <input type="checkbox" id="as-auction" checked={form.auction} onChange={e => setForm(s => ({ ...s, auction: e.target.checked }))} />
          <label htmlFor="as-auction" style={{ fontSize: 13, cursor: 'pointer' }}>Sold at auction</label>
        </div>
        <FormRow label="Notes"><Textarea value={form.notes} onChange={e => setForm(s => ({ ...s, notes: e.target.value }))} style={{ minHeight: 60 }} /></FormRow>
      </Sheet>

      {/* Detail sheet */}
      <Sheet open={!!detailSale} onClose={() => { setDetailSale(null); setEditMode(false) }} title={editMode ? 'Edit sale' : 'Sale details'}
        footer={
          editMode ? (
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <Btn onClick={() => setEditMode(false)}>Cancel</Btn>
              <Btn variant="primary" full onClick={() => {
                if (detailSale) {
                  updatePastSale(detailSale.id, {
                    address: editForm.address ?? detailSale.address,
                    postcode: editForm.postcode ?? detailSale.postcode,
                    guide: editForm.guide ?? detailSale.guide,
                    dateListed: editForm.dateListed ?? detailSale.dateListed,
                    dateSold: editForm.dateSold ?? detailSale.dateSold,
                    soldPrice: editForm.soldPrice ?? detailSale.soldPrice,
                    sqft: editForm.sqft ?? detailSale.sqft,
                    sqm: editForm.sqm ?? detailSale.sqm,
                    beds: editForm.beds ?? detailSale.beds,
                    outdoor: editForm.outdoor ?? detailSale.outdoor,
                    notes: editForm.notes ?? detailSale.notes,
                    auction: editForm.auction ?? detailSale.auction,
                  })
                  setDetailSale({ ...detailSale, ...editForm } as PastSale)
                  setEditMode(false)
                }
              }}>Save</Btn>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <Btn onClick={() => { setDetailSale(null); setEditMode(false) }}>Close</Btn>
              <Btn onClick={() => { setEditForm({ ...detailSale! }); setEditMode(true) }} style={{ flexShrink: 0 }}>
                <i className="ti ti-pencil" style={{ fontSize: 13 }} /> Edit
              </Btn>
              <Btn variant="danger" full onClick={() => { if (detailSale) { setConfirmDeleteId(detailSale.id); setDetailSale(null) } }}>
                <i className="ti ti-trash" style={{ fontSize: 13 }} /> Delete
              </Btn>
            </div>
          )
        }>
        {detailSale && !editMode && (() => {
          const s = detailSale
          const psfVal = s.sqft ? Math.round(s.soldPrice / s.sqft) : 0
          const above = pctAbove(s.soldPrice, s.guide)
          const rows: [string, string][] = [
            ['Address', s.address],
            ['Postcode', s.postcode],
            ['Guide price', gbp(s.guide)],
            ['Date listed', fmtDate(s.dateListed)],
            ['Date sold', fmtDate(s.dateSold)],
            ['Sold price', gbp(s.soldPrice)],
            ...(above ? [['vs Guide price', above] as [string, string]] : []),
            ['Sq ft', s.sqft ? s.sqft.toLocaleString('en-GB') : '—'],
            ['Sq m', s.sqm ? s.sqm.toLocaleString('en-GB') : '—'],
            ['£/sqft', psfVal ? '£' + psfVal.toLocaleString('en-GB') : '—'],
            ['Bedrooms', s.beds ? String(s.beds) : '—'],
            ['Outdoor', s.outdoor || '—'],
            ['Auction', s.auction ? '☑ Yes' : '☐ No'],
          ]
          return (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: s.notes ? 12 : 0 }}>
                <tbody>
                  {rows.map(([label, value]) => (
                    <tr key={label}>
                      <td style={{ padding: '6px 4px', borderBottom: '1px solid var(--cream2)', color: 'var(--ink3)', width: '40%' }}>{label}</td>
                      <td style={{ padding: '6px 4px', borderBottom: '1px solid var(--cream2)', fontWeight: 500, textAlign: 'right' }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {s.notes && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Notes</div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, background: 'var(--cream)', borderRadius: 8, padding: '8px 10px' }}>{s.notes}</div>
                </div>
              )}
            </>
          )
        })()}
        {detailSale && editMode && (
          <>
            <FormRow label="Address"><Input value={editForm.address ?? ''} onChange={e => setEditForm(s => ({ ...s, address: e.target.value }))} /></FormRow>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
              <FormRow label="Postcode"><Input value={editForm.postcode ?? ''} onChange={e => setEditForm(s => ({ ...s, postcode: e.target.value }))} /></FormRow>
              <FormRow label="Guide / list price"><Input type="number" value={editForm.guide ?? ''} onChange={e => setEditForm(s => ({ ...s, guide: parseFloat(e.target.value) || 0 }))} /></FormRow>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
              {mInput('Date listed', 'edit-dlisted', editForm.dateListed?.slice(0,7) ?? '', v => setEditForm(s => ({ ...s, dateListed: v ? v + '-01' : '' })))}
              {mInput('Date sold', 'edit-dsold', editForm.dateSold?.slice(0,7) ?? '', v => setEditForm(s => ({ ...s, dateSold: v ? v + '-01' : '' })))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
              <FormRow label="Sold price"><Input type="number" value={editForm.soldPrice ?? ''} onChange={e => setEditForm(s => ({ ...s, soldPrice: parseFloat(e.target.value) || 0 }))} /></FormRow>
              <FormRow label="Sq ft"><Input type="number" value={editForm.sqft ?? ''} onChange={e => setEditForm(s => ({ ...s, sqft: parseFloat(e.target.value) || 0 }))} /></FormRow>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
              <FormRow label="Sq m"><Input type="number" value={editForm.sqm ?? ''} onChange={e => setEditForm(s => ({ ...s, sqm: parseFloat(e.target.value) || 0 }))} /></FormRow>
              <FormRow label="Bedrooms"><Input type="number" value={editForm.beds ?? ''} onChange={e => setEditForm(s => ({ ...s, beds: parseFloat(e.target.value) || 0 }))} /></FormRow>
            </div>
            <FormRow label="Outdoor space">
              <select value={editForm.outdoor ?? ''} onChange={e => setEditForm(s => ({ ...s, outdoor: e.target.value }))} style={{width:'100%',background:'#fff',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:'none',WebkitAppearance:'none',appearance:'none',color:editForm.outdoor?'var(--ink)':'var(--ink3)'}}>
                <option value="">Select...</option>
                <option value="none">None</option>
                <option value="shared-garden">Shared garden</option>
                <option value="garden">Garden</option>
                <option value="balcony">Balcony</option>
                <option value="terrace">Terrace</option>
                <option value="roof-terrace">Roof terrace</option>
              </select>
            </FormRow>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
              <input type="checkbox" id="edit-auction" checked={editForm.auction ?? false} onChange={e => setEditForm(s => ({ ...s, auction: e.target.checked }))} />
              <label htmlFor="edit-auction" style={{ fontSize: 13, cursor: 'pointer' }}>Sold at auction</label>
            </div>
            <FormRow label="Notes"><Textarea value={editForm.notes ?? ''} onChange={e => setEditForm(s => ({ ...s, notes: e.target.value }))} style={{ minHeight: 80 }} /></FormRow>
          </>
        )}
      </Sheet>

            {/* Confirm delete sheet */}
      <Sheet open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="Delete entry"
        footer={<>
          <Btn onClick={() => setConfirmDeleteId(null)}>Cancel</Btn>
          <Btn variant="danger" full onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>Delete permanently</Btn>
        </>}>
        <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
          Are you sure you want to delete <strong>{confirmSale?.address}</strong>?
        </p>
        <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>This cannot be undone.</p>
      </Sheet>
    </div>
  )
}
