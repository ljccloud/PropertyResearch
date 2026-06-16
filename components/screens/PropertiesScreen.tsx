'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { newProperty } from '@/types'
import type { Property } from '@/types'
import { gbp } from '@/lib/format'
import { Sheet } from '@/components/ui/Sheet'
import { Btn } from '@/components/ui/Btn'
import { FormRow, Input } from '@/components/ui/FormRow'

interface Props { onOpenProperty: (id: string) => void }

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'sort-price', label: '↑ Price' },
  { id: 'sort-psf', label: '£/sqft' },
  { id: 'sort-beds', label: 'Beds' },
  { id: 'tag-leasehold', label: 'Leasehold' },
  { id: 'tag-freehold', label: 'Freehold' },
  { id: 'tag-auction', label: 'Auction' },
  { id: 'tag-needs work', label: 'Needs work' },
]

const SQM_PER_SQFT = 0.092903

const OUTDOOR_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'none', label: 'None' },
  { value: 'shared-garden', label: 'Shared garden' },
  { value: 'garden', label: 'Garden' },
  { value: 'balcony', label: 'Balcony' },
  { value: 'terrace', label: 'Terrace' },
  { value: 'roof-terrace', label: 'Roof terrace' },
]

export function PropertiesScreen({ onOpenProperty }: Props) {
  const { properties, compareIds, toggleCompare, addProperty } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    function handleFab() { setSheetOpen(true) }
    window.addEventListener('fab-action', handleFab)
    return () => window.removeEventListener('fab-action', handleFab)
  }, [])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState({
    address: '', postcode: '', listPrice: '', sqft: '', sqm: '',
    beds: '', baths: '', url: '', tags: '', dateListed: '',
    tenure: '', leaseYears: '', serviceCharge: '',
    methodOfSale: '', outdoorSpace: '',
  })

  const filtered = properties
    .filter(p => {
      if (p.archived) return false
      if (search) {
        const q = search.toLowerCase()
        if (!(p.address + ' ' + p.postcode + ' ' + (p.tags || '')).toLowerCase().includes(q)) return false
      }
      if (filter.startsWith('tag-')) {
        const t = filter.replace('tag-', '')
        return (p.tags || '').toLowerCase().includes(t)
      }
      return true
    })
    .sort((a, b) => {
      if (filter === 'sort-price') return a.listPrice - b.listPrice
      if (filter === 'sort-psf') return (a.sqft ? a.listPrice / a.sqft : 0) - (b.sqft ? b.listPrice / b.sqft : 0)
      if (filter === 'sort-beds') return b.beds - a.beds
      return 0
    })

  function onSqftChange(val: string) {
    const n = parseFloat(val) || 0
    const sqm = n ? String(Math.round(n * SQM_PER_SQFT * 100) / 100) : ''
    setForm(s => ({ ...s, sqft: val, sqm }))
  }
  function onSqmChange(val: string) {
    const n = parseFloat(val) || 0
    const sqft = n ? String(Math.round(n / SQM_PER_SQFT)) : ''
    setForm(s => ({ ...s, sqm: val, sqft }))
  }

  function handleAdd() {
    if (!form.address.trim()) return
    const p = newProperty()
    p.address = form.address.trim()
    p.postcode = form.postcode.trim()
    p.listPrice = parseFloat(form.listPrice) || 0
    p.sqft = parseFloat(form.sqft) || 0
    p.sqm = parseFloat(form.sqm) || 0
    p.beds = parseFloat(form.beds) || 0
    p.baths = parseFloat(form.baths) || 0
    p.url = form.url.trim()
    p.dateListed = form.dateListed
    p.tenure = form.tenure as any
    p.leaseYears = parseFloat(form.leaseYears) || undefined
    p.serviceCharge = parseFloat(form.serviceCharge) || undefined
    p.methodOfSale = form.methodOfSale as any
    p.outdoorSpace = form.outdoorSpace as any
    // Set tags from tenure
    const tagParts: string[] = []
    if (form.tenure === 'leasehold') tagParts.push('Leasehold')
    if (form.tenure === 'freehold') tagParts.push('Freehold')
    if (form.methodOfSale === 'auction') tagParts.push('Auction')
    if (form.tags.trim()) tagParts.push(...form.tags.split(',').map(t => t.trim()).filter(Boolean))
    p.tags = tagParts.join(', ')
    addProperty(p)
    setSheetOpen(false)
    setForm({ address: '', postcode: '', listPrice: '', sqft: '', sqm: '', beds: '', baths: '', url: '', tags: '', dateListed: '', tenure: '', leaseYears: '', serviceCharge: '', methodOfSale: '', outdoorSpace: '' })
    onOpenProperty(p.id)
  }

  const sel = (id: string, value: string, onChange: (v: string) => void, options: {value:string;label:string}[]) => (
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ width: '100%', background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: value ? 'var(--ink)' : 'var(--ink3)', outline: 'none', WebkitAppearance: 'none', appearance: 'none' }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )

  return (
    <div>
      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 11px', marginBottom: 10 }}>
        <i className="ti ti-search" style={{ color: 'var(--ink3)', fontSize: 16 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search properties…" style={{ border: 'none', background: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: 14, flex: 1, outline: 'none', color: 'var(--ink)' }} />
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 11, overflowX: 'auto', paddingBottom: 2 }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{ background: filter === f.id ? 'var(--accent)' : '#fff', border: `1px solid ${filter === f.id ? 'var(--accent)' : 'var(--border)'}`, color: filter === f.id ? '#fff' : 'var(--ink2)', borderRadius: 99, padding: '5px 10px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Property cards */}
      {filtered.length === 0
        ? <p style={{ textAlign: 'center', color: 'var(--ink3)', padding: 28, fontSize: 13 }}>No properties. Tap + to add one.</p>
        : filtered.map(p => <PropertyCard key={p.id} property={p} onOpen={onOpenProperty} compareIds={compareIds} onToggleCompare={toggleCompare} />)
      }



      {/* Quick add sheet */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Add property"
        footer={<><Btn onClick={() => setSheetOpen(false)}>Cancel</Btn><Btn variant="primary" full onClick={handleAdd}>Add property</Btn></>}>

        <FormRow label="Address"><Input value={form.address} onChange={e => setForm(s => ({ ...s, address: e.target.value }))} placeholder="e.g. 14 Victoria Street" /></FormRow>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
          <FormRow label="Postcode"><Input value={form.postcode} onChange={e => setForm(s => ({ ...s, postcode: e.target.value }))} /></FormRow>
          <FormRow label="Date listed"><Input type="date" value={form.dateListed} onChange={e => setForm(s => ({ ...s, dateListed: e.target.value }))} /></FormRow>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
          <FormRow label="Listing price"><Input type="number" value={form.listPrice} onChange={e => setForm(s => ({ ...s, listPrice: e.target.value }))} placeholder="0" /></FormRow>
          <FormRow label="Method of sale">
            {sel('mos', form.methodOfSale, v => setForm(s => ({ ...s, methodOfSale: v })), [
              { value: '', label: 'Select...' },
              { value: 'private-treaty', label: 'Private Treaty' },
              { value: 'auction', label: 'Auction' },
            ])}
          </FormRow>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
          <FormRow label="Sq ft"><Input type="number" value={form.sqft} onChange={e => onSqftChange(e.target.value)} placeholder="e.g. 850" /></FormRow>
          <FormRow label="Sq m"><Input type="number" value={form.sqm} onChange={e => onSqmChange(e.target.value)} placeholder="auto" /></FormRow>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
          <FormRow label="Beds"><Input type="number" value={form.beds} onChange={e => setForm(s => ({ ...s, beds: e.target.value }))} /></FormRow>
          <FormRow label="Baths"><Input type="number" value={form.baths} onChange={e => setForm(s => ({ ...s, baths: e.target.value }))} /></FormRow>
        </div>

        <FormRow label="Tenure">
          {sel('tenure', form.tenure, v => setForm(s => ({ ...s, tenure: v })), [
            { value: '', label: 'Select...' },
            { value: 'freehold', label: 'Freehold' },
            { value: 'leasehold', label: 'Leasehold' },
            { value: 'share-of-freehold', label: 'Share of freehold' },
          ])}
        </FormRow>

        {form.tenure === 'leasehold' && (
          <FormRow label="Years remaining on lease">
            <Input type="number" value={form.leaseYears} onChange={e => setForm(s => ({ ...s, leaseYears: e.target.value }))} placeholder="e.g. 85" />
          </FormRow>
        )}

        <FormRow label="Outdoor space">
          {sel('outdoor', form.outdoorSpace, v => setForm(s => ({ ...s, outdoorSpace: v })), OUTDOOR_OPTIONS)}
        </FormRow>

        <FormRow label="Service charge (annual)">
          <Input type="number" value={form.serviceCharge} onChange={e => setForm(s => ({ ...s, serviceCharge: e.target.value }))} placeholder="0" />
        </FormRow>

        <FormRow label="Listing URL"><Input value={form.url} onChange={e => setForm(s => ({ ...s, url: e.target.value }))} placeholder="https://rightmove.co.uk/…" /></FormRow>
        <FormRow label="Tags"><Input value={form.tags} onChange={e => setForm(s => ({ ...s, tags: e.target.value }))} placeholder="Needs work, Chain free…" /></FormRow>
      </Sheet>
    </div>
  )
}

function PropertyCard({ property: p, onOpen, compareIds, onToggleCompare }: { property: Property; onOpen: (id: string) => void; compareIds: string[]; onToggleCompare: (id: string) => void }) {
  const ticked = compareIds.includes(p.id)
  const psfVal = p.sqft ? Math.round(p.listPrice / p.sqft) : 0
  const tags = (p.tags || '').split(',').filter(Boolean)

  return (
    <div onClick={() => onOpen(p.id)} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10, cursor: 'pointer', position: 'relative' }}>
      <div onClick={e => { e.stopPropagation(); onToggleCompare(p.id) }} style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, border: `1.5px solid ${ticked ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ticked ? 'var(--accent)' : '#fff', cursor: 'pointer', fontSize: 12, color: '#fff' }}>
        {ticked ? '✓' : ''}
      </div>

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, paddingRight: 30 }}>{p.address}</div>
      <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 8 }}>
        {p.postcode}
        {p.url && <> · <a href={p.url} onClick={e => e.stopPropagation()} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 11 }}>View listing ↗</a></>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: tags.length ? 8 : 0 }}>
        {[
          { label: 'List price', val: gbp(p.listPrice), sub: p.dateListed ? fmtDate(p.dateListed) : '' },
          { label: 'Sq ft', val: p.sqft ? p.sqft.toLocaleString('en-GB') : '—', sub: psfVal ? `£${psfVal.toLocaleString('en-GB')}/sqft` : '' },
          { label: 'Beds/Baths', val: `${p.beds || '—'}/${p.baths || '—'}` },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--cream)', borderRadius: 6, padding: '6px 8px' }}>
            <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{m.val}</div>
            {m.sub && <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 1 }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      {tags.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {tags.map(t => (
            <span key={t} style={{ display: 'inline-flex', background: 'var(--cream2)', border: '1px solid var(--border)', borderRadius: 99, padding: '2px 8px', fontSize: 11, color: 'var(--ink2)', margin: 2 }}>{t.trim()}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function fmtDate(d: string): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}
