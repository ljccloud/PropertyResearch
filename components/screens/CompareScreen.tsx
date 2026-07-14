'use client'
import { useStore } from '@/lib/store'
import { gbp } from '@/lib/format'
import { calcSDLT, calcFinancing, calcLeaseExtension, calcRenoTotal } from '@/lib/calculations'
import type { Property } from '@/types'

function fmtDate(d: string): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

function psf(price: number, sqft: number): string {
  if (!price || !sqft) return '—'
  return '£' + Math.round(price / sqft).toLocaleString('en-GB') + '/ft'
}

const OUTDOOR_LABELS: Record<string, string> = {
  'none': 'None', 'shared-garden': 'Shared garden', 'garden': 'Garden',
  'balcony': 'Balcony', 'terrace': 'Terrace', 'roof-terrace': 'Roof terrace',
}
const TENURE_LABELS: Record<string, string> = {
  'freehold': 'Freehold', 'leasehold': 'Leasehold', 'share-of-freehold': 'Share of freehold',
}

export function CompareScreen() {
  const { properties, compareIds, toggleCompare, assumptions } = useStore()
  const props = properties.filter(p => compareIds.includes(p.id) && !p.archived && !(p as any).deleted)

  if (!props.length) {
    return <p style={{ textAlign: 'center', color: 'var(--ink3)', padding: 28, fontSize: 13 }}>No properties selected.<br />Tick the compare box on property cards.</p>
  }

  // Calculate derived values per property
  function derived(p: Property) {
    const sdlt = calcSDLT(p.offerPrice, assumptions.sdltType)
    const auctionFee = p.purchaseFees?.auctionFeeFlat || 0
    const scPct = p.purchaseFees?.specialConditionsPct || 0
    const sc = Math.round(p.offerPrice * (scPct / 100) * 1.2) // +VAT
    const legal = p.purchaseFees?.legalFees ?? assumptions.defLegal
    const totalFees = sdlt.total + auctionFee + sc + legal
    const vatIncluded = (p as any).renoVatIncluded || false
    const { total: reno } = calcRenoTotal(p.renovation as any, assumptions.vatRate, vatIncluded)
    const lease = calcLeaseExtension(p.leaseExtension?.cost || 0, p.leaseExtension?.legal || 0)
    const sub = p.offerPrice + totalFees + reno
    const totalCost = sub + lease.total
    // Use stored loan if overridden, otherwise auto = totalCost
    const loanAmt = (p as any).loanOverride ? (p.financing?.loan || 0) : totalCost
    const fin = calcFinancing(loanAmt, p.financing?.rate || assumptions.defRate, p.financing?.months || 6)
    const profit = p.resaleEst ? p.resaleEst - totalCost : 0
    return { totalFees, reno, totalCost, fin, profit }
  }

  const rows: { label: string; fn: (p: Property) => string }[] = [
    { label: 'List price',            fn: p => gbp(p.listPrice) },
    { label: 'Sq ft',                 fn: p => p.sqft ? p.sqft.toLocaleString('en-GB') : '—' },
    { label: 'Guide £/sqft',          fn: p => psf(p.listPrice, p.sqft) },
    { label: 'Offer price',           fn: p => gbp(p.offerPrice) },
    { label: 'Offer £/sqft',          fn: p => psf(p.offerPrice, p.sqft) },
    { label: 'Renovation cost',       fn: p => gbp(derived(p).reno) },
    { label: 'Total cost',            fn: p => gbp(derived(p).totalCost) },
    { label: 'Total cost £/sqft',     fn: p => psf(derived(p).totalCost, p.sqft) },
    { label: 'Potential resale',      fn: p => gbp(p.resaleEst) },
    { label: 'Potential profit',      fn: p => { const d = derived(p); return p.resaleEst ? gbp(p.resaleEst - d.totalCost) : '—' } },
    { label: 'Beds / baths',          fn: p => `${p.beds || '—'}/${p.baths || '—'}` },
    { label: 'Tenure',                fn: p => TENURE_LABELS[p.tenure || ''] || '—' },
    { label: 'Outdoor',               fn: p => OUTDOOR_LABELS[p.outdoorSpace || ''] || '—' },
    { label: 'Service charge',        fn: p => p.serviceCharge ? gbp(p.serviceCharge) + ' pa' : '—' },
    { label: 'Date listed',           fn: p => fmtDate(p.dateListed) },
  ]

  const lw = 140
  const cw = 160

  const compTypes: { type: 'forsale'|'sold'|'auction'; label: string; dateLabel: string }[] = [
    { type: 'forsale', label: 'For sale comparables', dateLabel: 'Listed' },
    { type: 'sold',    label: 'Sold comparables',     dateLabel: 'Sold'   },
    { type: 'auction', label: 'Auction comparables',  dateLabel: 'Sold'   },
  ]

  // Gather all ticked comparables of a given type across all compared properties
  function tickedComps(type: 'forsale'|'sold'|'auction') {
    const seen = new Set<string>()
    const out: { prop: Property; comp: any }[] = []
    for (const p of props) {
      for (const c of (p.comparables?.[type] || []) as any[]) {
        if (c.ticked && !seen.has(c.id)) {
          seen.add(c.id)
          out.push({ prop: p, comp: c })
        }
      }
    }
    return out
  }

  const compLabelW = 140
  const compColW = 200

  function CompsTable({ type, label, dateLabel }: { type: 'forsale'|'sold'|'auction'; label: string; dateLabel: string }) {
    const entries = tickedComps(type)
    if (!entries.length) return null

    const compRows: { label: string; fn: (c: any) => string }[] = [
      { label: 'Address',       fn: c => c.address || '—' },
      { label: 'Postcode',      fn: c => c.postcode || '—' },
      { label: dateLabel + ' price', fn: c => c.price ? gbp(c.price) : '—' },
      { label: 'Guide price',   fn: c => c.guidePrice ? gbp(c.guidePrice) : '—' },
      { label: dateLabel + ' date',  fn: c => fmtDate(c.date) },
      { label: 'Sq ft',        fn: c => c.sqft ? c.sqft.toLocaleString('en-GB') : '—' },
      { label: '£/sqft',       fn: c => c.psf ? '£' + c.psf.toLocaleString('en-GB') + '/ft' : (c.sqft && c.price ? '£' + Math.round(c.price / c.sqft).toLocaleString('en-GB') + '/ft' : '—') },
      { label: 'Beds',         fn: c => c.beds ? String(c.beds) : '—' },
      { label: 'Outdoor',      fn: c => OUTDOOR_LABELS[c.outdoorSpace || ''] || '—' },
      { label: 'Notes',        fn: c => c.notes || '—' },
    ]

    // For for-sale, hide guide price
    const filteredRows = type === 'forsale'
      ? compRows.filter(r => r.label !== 'Guide price')
      : compRows

    return (
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8, paddingLeft: compLabelW }}>{label}</div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', minWidth: compLabelW + compColW * entries.length }}>
            {/* Label column */}
            <div style={{ width: compLabelW, flexShrink: 0 }}>
              <div style={{ height: 54, marginBottom: 8 }} />
              {filteredRows.map(r => (
                <div key={r.label} style={{ height: 36, display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--ink2)', borderBottom: '1px solid var(--cream2)', paddingRight: 8 }}>
                  {r.label}
                </div>
              ))}
            </div>
            {/* Comparable columns */}
            {entries.map(({ prop: p, comp: c }, i) => (
              <div key={c.id} style={{ width: compColW, flexShrink: 0, padding: '0 4px' }}>
                <div style={{ background: 'var(--cream2)', borderRadius: 10, padding: '8px 10px', marginBottom: 8, height: 54, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address}</div>
                  <div style={{ fontSize: 9, color: 'var(--ink3)' }}>via {p.address}</div>
                </div>
                {filteredRows.map(r => (
                  <div key={r.label} style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: 12, fontWeight: 500, borderBottom: '1px solid var(--cream2)', textAlign: 'right' }}>
                    {r.fn(c)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', minWidth: lw + cw * props.length }}>

        {/* Label column */}
        <div style={{ width: lw, flexShrink: 0 }}>
          {/* Header spacer matching property header height */}
          <div style={{ height: 54, marginBottom: 8 }} />
          {rows.map((r, i) => (
            <div key={r.label} style={{
              height: 36,
              display: 'flex', alignItems: 'center',
              fontSize: 12, color: 'var(--ink2)',
              borderBottom: '1px solid var(--cream2)',
              paddingRight: 8,
            }}>
              {r.label}
            </div>
          ))}
        </div>

        {/* Property columns */}
        {props.map(p => (
          <div key={p.id} style={{ width: cw, flexShrink: 0, padding: '0 4px' }}>
            {/* Column header */}
            <div style={{
              background: 'var(--cream2)', borderRadius: 10, padding: '8px 10px',
              marginBottom: 8, height: 54, display: 'flex', flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.address}</span>
                <span onClick={() => toggleCompare(p.id)} style={{ cursor: 'pointer', color: 'var(--ink3)', fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{p.postcode}</div>
            </div>

            {/* Value rows — same height as label rows */}
            {rows.map(r => (
              <div key={r.label} style={{
                height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                fontSize: 12, fontWeight: 500,
                borderBottom: '1px solid var(--cream2)',
                textAlign: 'right',
              }}>
                {r.fn(p)}
              </div>
            ))}
          </div>
        ))}
      </div>

      {compTypes.map(({ type, label, dateLabel }) => (
        <div key={type}>{CompsTable({ type, label, dateLabel })}</div>
      ))}
    </div>
  )
}
