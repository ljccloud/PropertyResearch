'use client'
import { useStore } from '@/lib/store'
import { gbp } from '@/lib/format'

export function CompareScreen() {
  const { properties, compareIds, toggleCompare } = useStore()
  const props = properties.filter(p => compareIds.includes(p.id))

  if (!props.length) {
    return <p style={{ textAlign: 'center', color: 'var(--ink3)', padding: 28, fontSize: 13 }}>No properties selected.<br />Tick the compare box on property cards.</p>
  }

  const rows = [
    { label: 'Address',    fn: (p: any) => p.address || '—' },
    { label: 'Postcode',   fn: (p: any) => p.postcode || '—' },
    { label: 'List price', fn: (p: any) => gbp(p.listPrice) },
    { label: 'Offer price',fn: (p: any) => gbp(p.offerPrice) },
    { label: 'Sq ft',      fn: (p: any) => p.sqft || '—' },
    { label: 'Sq m',       fn: (p: any) => p.sqm || '—' },
    { label: '£/sqft',     fn: (p: any) => p.sqft && p.listPrice ? '£' + Math.round(p.listPrice / p.sqft) : '—' },
    { label: 'Beds',       fn: (p: any) => p.beds || '—' },
    { label: 'Baths',      fn: (p: any) => p.baths || '—' },
    { label: 'Tags',       fn: (p: any) => p.tags || '—' },
  ]

  const lw = 95, cw = 140

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', minWidth: lw + cw * props.length }}>
        {/* Label column */}
        <div style={{ width: lw, flexShrink: 0, paddingRight: 8 }}>
          <div style={{ height: 46, marginBottom: 8 }} />
          {rows.map(r => (
            <div key={r.label} style={{ padding: '7px 0', borderBottom: '1px solid var(--cream2)', fontSize: 12, display: 'flex', alignItems: 'center', minHeight: 34, color: 'var(--ink2)' }}>{r.label}</div>
          ))}
        </div>
        {/* Property columns */}
        {props.map(p => (
          <div key={p.id} style={{ width: cw, flexShrink: 0, padding: '0 4px' }}>
            <div style={{ background: 'var(--cream2)', borderRadius: 6, padding: '8px 6px', marginBottom: 8, fontSize: 11, fontWeight: 600, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, height: 46 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{p.address}</span>
              <span onClick={() => toggleCompare(p.id)} style={{ cursor: 'pointer', color: 'var(--ink3)', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</span>
            </div>
            {rows.map(r => (
              <div key={r.label} style={{ padding: '7px 4px', borderBottom: '1px solid var(--cream2)', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', minHeight: 34, wordBreak: 'break-word' }}>{r.fn(p)}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
