'use client'
import { useStore } from '@/lib/store'

const BANDS = {
  additional: ['Up to £250,000: 3%','£250,001 – £925,000: 8%','£925,001 – £1,500,000: 13%','Over £1,500,000: 15%'],
  standard:   ['Up to £250,000: 0%','£250,001 – £925,000: 5%','£925,001 – £1,500,000: 10%','Over £1,500,000: 12%'],
  ftb:        ['Up to £425,000: 0%','£425,001 – £625,000: 5%','£625,001 – £925,000: 5%','£925,001 – £1,500,000: 10%','Over £1,500,000: 12%'],
}

export function AssumptionsScreen() {
  const { assumptions, setAssumptions } = useStore()

  const row = (label: string, children: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--cream2)' }}>
      <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{children}</div>
    </div>
  )

  const ci = (value: number, key: keyof typeof assumptions, suffix?: string) => (
    <>
      {!suffix && <span style={{ color: 'var(--ink3)' }}>£</span>}
      <input
        type="number"
        value={value}
        onChange={e => setAssumptions({ [key]: parseFloat(e.target.value) || 0 })}
        style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 6px', fontSize: 12, width: 70, textAlign: 'right', fontFamily: "'DM Sans',sans-serif", outline: 'none' }}
      />
      {suffix && <span style={{ color: 'var(--ink3)' }}>{suffix}</span>}
    </>
  )

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', letterSpacing: '.08em', textTransform: 'uppercase', margin: '14px 0 7px' }}>Stamp duty</div>
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--cream2)' }}>
          <span style={{ fontSize: 13, color: 'var(--ink2)' }}>Property type</span>
          <select
            value={assumptions.sdltType}
            onChange={e => setAssumptions({ sdltType: e.target.value as any })}
            style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: 'none', color: 'var(--ink)', WebkitAppearance: 'none', appearance: 'none' }}
          >
            <option value="additional">Additional / BTL (default)</option>
            <option value="standard">Standard residential</option>
            <option value="ftb">First-time buyer</option>
          </select>
        </div>
        <div style={{ padding: '8px 0' }}>
          {BANDS[assumptions.sdltType].map(b => (
            <div key={b} style={{ fontSize: 11, color: 'var(--ink3)', padding: '2px 0' }}>{b}</div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', letterSpacing: '.08em', textTransform: 'uppercase', margin: '14px 0 7px' }}>VAT</div>
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 12px' }}>
        {row('VAT rate', ci(assumptions.vatRate, 'vatRate', '%'))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', letterSpacing: '.08em', textTransform: 'uppercase', margin: '14px 0 7px' }}>Defaults</div>
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 12px' }}>
        {row('Default interest rate', ci(assumptions.defRate, 'defRate', '%'))}
        {row('Auction buyer fee', ci(assumptions.defAF, 'defAF', '%'))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0' }}>
          <span style={{ fontSize: 13, color: 'var(--ink2)' }}>Default legal fees</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--ink3)' }}>£</span>
            <input
              type="number"
              value={assumptions.defLegal}
              onChange={e => setAssumptions({ defLegal: parseFloat(e.target.value) || 0 })}
              style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 6px', fontSize: 12, width: 80, textAlign: 'right', fontFamily: "'DM Sans',sans-serif", outline: 'none' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
