'use client'
interface Row { label: React.ReactNode; value: React.ReactNode; type?: 'normal' | 'subtotal' | 'total' }
export function CalcTable({ rows }: { rows: Row[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{
              padding: '6px 4px', borderBottom: r.type === 'total' ? 'none' : '1px solid var(--cream2)',
              borderTop: (r.type === 'subtotal' || r.type === 'total') ? `${r.type === 'total' ? 1.5 : 1}px solid var(--border)` : undefined,
              color: r.type ? 'var(--ink)' : 'var(--ink3)',
              fontWeight: (r.type === 'subtotal' || r.type === 'total') ? 600 : 400,
              fontSize: r.type === 'total' ? 14 : 13,
              paddingTop: (r.type === 'subtotal' || r.type === 'total') ? 7 : 6,
            }}>{r.label}</td>
            <td style={{
              padding: '6px 4px', textAlign: 'right', fontWeight: 500,
              borderBottom: r.type === 'total' ? 'none' : '1px solid var(--cream2)',
              borderTop: (r.type === 'subtotal' || r.type === 'total') ? `${r.type === 'total' ? 1.5 : 1}px solid var(--border)` : undefined,
              fontSize: r.type === 'total' ? 14 : 13,
              fontWeight: (r.type === 'subtotal' || r.type === 'total') ? 700 : 500,
              paddingTop: (r.type === 'subtotal' || r.type === 'total') ? 7 : 6,
            }}>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
