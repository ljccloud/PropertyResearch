'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { £ } from '@/lib/format'
import { Sheet } from '@/components/ui/Sheet'
import { Btn } from '@/components/ui/Btn'
import { FormRow, Input, Textarea } from '@/components/ui/FormRow'
import type { PastSale } from '@/types'
import { uid } from '@/types'

export function PastSalesScreen() {
  const { pastSales, addPastSale } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all'|'sold'|'auction'>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [detailSale, setDetailSale] = useState<PastSale | null>(null)
  const [form, setForm] = useState({ address: '', postcode: '', guide: '', dateListed: '', dateSold: '', soldPrice: '', sqft: '', sqm: '', beds: '', outdoor: '', notes: '', auction: false })

  const filtered = pastSales.filter(s => {
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
      guide: parseFloat(form.guide) || 0, dateListed: form.dateListed,
      dateSold: form.dateSold, soldPrice: parseFloat(form.soldPrice) || 0,
      sqft: parseFloat(form.sqft) || 0, sqm: parseFloat(form.sqm) || 0,
      beds: parseFloat(form.beds) || 0, outdoor: form.outdoor,
      notes: form.notes, auction: form.auction,
    }
    addPastSale(s)
    setAddOpen(false)
    setForm({ address: '', postcode: '', guide: '', dateListed: '', dateSold: '', soldPrice: '', sqft: '', sqm: '', beds: '', outdoor: '', notes: '', auction: false })
  }

  function SaleRow({ s }: { s: PastSale }) {
    const psfVal = s.sqft ? Math.round(s.soldPrice / s.sqft) : 0
    return (
      <div onClick={() => setDetailSale(s)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--cream2)', cursor: 'pointer' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{s.address}</div>
          <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{s.postcode}{s.dateSold ? ` · ${s.dateSold}` : ''}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{£(s.soldPrice)}</div>
          <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{psfVal ? `£${psfVal}/sqft` : ''}</div>
        </div>
      </div>
    )
  }

  function Section({ title, items }: { title: string; items: PastSale[] }) {
    if (!items.length) return null
    return (
      <>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', letterSpacing: '.08em', textTransform: 'uppercase', margin: '14px 0 7px' }}>{title}</div>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 12px' }}>
          {items.map(s => <SaleRow key={s.id} s={s} />)}
        </div>
      </>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 11px', marginBottom: 10 }}>
        <i className="ti ti-search" style={{ color: 'var(--ink3)', fontSize: 16 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by postcode or keyword…" style={{ border: 'none', background: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: 14, flex: 1, outline: 'none', color: 'var(--ink)' }} />
      </div>

      <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
        {(['all', 'sold', 'auction'] as const).map(f => (
          <span key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? 'var(--accent)' : 'var(--cream2)', border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`, color: filter === f ? '#fff' : 'var(--ink2)', borderRadius: 99, padding: '4px 10px', fontSize: 11, cursor: 'pointer', textTransform: 'capitalize' }}>{f === 'all' ? 'All' : f === 'sold' ? 'Sold' : 'Auction'}</span>
        ))}
      </div>

      {filter !== 'auction' && <Section title="Sold" items={sold} />}
      {filter !== 'sold' && <Section title="Sold at auction" items={auction} />}
      {!filtered.length && <p style={{ textAlign: 'center', color: 'var(--ink3)', padding: 28, fontSize: 13 }}>No entries yet. Tap + to add.</p>}

      <button onClick={() => setAddOpen(true)} style={{ position: 'fixed', bottom: 'calc(84px + env(safe-area-inset-bottom,0px))', right: 16, width: 50, height: 50, background: 'var(--accent)', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', zIndex: 99, boxShadow: '0 2px 10px rgba(139,111,71,.3)' }}>
        <i className="ti ti-plus" />
      </button>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add past sale"
        footer={<><Btn onClick={() => setAddOpen(false)}>Cancel</Btn><Btn variant="primary" full onClick={handleAdd}>Save</Btn></>}>
        <FormRow label="Address"><Input value={form.address} onChange={e => setForm(s => ({ ...s, address: e.target.value }))} /></FormRow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
          <FormRow label="Postcode"><Input value={form.postcode} onChange={e => setForm(s => ({ ...s, postcode: e.target.value }))} /></FormRow>
          <FormRow label="Guide price"><Input type="number" value={form.guide} onChange={e => setForm(s => ({ ...s, guide: e.target.value }))} /></FormRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
          <FormRow label="Date listed"><Input type="date" value={form.dateListed} onChange={e => setForm(s => ({ ...s, dateListed: e.target.value }))} /></FormRow>
          <FormRow label="Date sold"><Input type="date" value={form.dateSold} onChange={e => setForm(s => ({ ...s, dateSold: e.target.value }))} /></FormRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
          <FormRow label="Sold price"><Input type="number" value={form.soldPrice} onChange={e => setForm(s => ({ ...s, soldPrice: e.target.value }))} /></FormRow>
          <FormRow label="Sq ft"><Input type="number" value={form.sqft} onChange={e => setForm(s => ({ ...s, sqft: e.target.value }))} /></FormRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
          <FormRow label="Sq m"><Input type="number" value={form.sqm} onChange={e => setForm(s => ({ ...s, sqm: e.target.value }))} /></FormRow>
          <FormRow label="Bedrooms"><Input type="number" value={form.beds} onChange={e => setForm(s => ({ ...s, beds: e.target.value }))} /></FormRow>
        </div>
        <FormRow label="Outdoor space"><Input value={form.outdoor} onChange={e => setForm(s => ({ ...s, outdoor: e.target.value }))} /></FormRow>
        <FormRow label="Notes"><Textarea value={form.notes} onChange={e => setForm(s => ({ ...s, notes: e.target.value }))} style={{ minHeight: 60 }} /></FormRow>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" id="as-auction" checked={form.auction} onChange={e => setForm(s => ({ ...s, auction: e.target.checked }))} />
          <label htmlFor="as-auction" style={{ fontSize: 13, cursor: 'pointer' }}>Sold at auction</label>
        </div>
      </Sheet>

      <Sheet open={!!detailSale} onClose={() => setDetailSale(null)} title="Sale details"
        footer={<Btn full onClick={() => setDetailSale(null)}>Close</Btn>}>
        {detailSale && (() => {
          const s = detailSale
          const psfVal = s.sqft ? Math.round(s.soldPrice / s.sqft) : 0
          const rows = [
            ['Address', s.address], ['Postcode', s.postcode],
            ['Guide price', £(s.guide)], ['Date listed', s.dateListed || '—'],
            ['Date sold', s.dateSold || '—'], ['Sold price', £(s.soldPrice)],
            ['Sq ft', s.sqft || '—'], ['Sq m', s.sqm || '—'],
            ['£/sqft', psfVal ? `£${psfVal}` : '—'], ['Bedrooms', s.beds || '—'],
            ['Outdoor', s.outdoor || '—'], ['Auction', s.auction ? '☑ Yes' : '☐ No'],
            ...(s.notes ? [['Notes', s.notes]] : []),
          ]
          return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {rows.map(([label, value]) => (
                  <tr key={label as string}>
                    <td style={{ padding: '6px 4px', borderBottom: '1px solid var(--cream2)', color: 'var(--ink3)' }}>{label}</td>
                    <td style={{ padding: '6px 4px', borderBottom: '1px solid var(--cream2)', fontWeight: 500, textAlign: 'right' }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        })()}
      </Sheet>
    </div>
  )
}
