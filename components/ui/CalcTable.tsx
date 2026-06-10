'use client'

interface Row {
  label: React.ReactNode
  value: React.ReactNode
  type?: 'normal' | 'subtotal' | 'total'
}

export function CalcTable({ rows }: { rows: Row[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <tbody>
        {rows.map((r, i) => {
          const isAccent = r.type === 'subtotal' || r.type === 'total'
          const labelStyle: React.CSSProperties = {
            padding: '6px 4px',
            borderBottom: r.type === 'total' ? 'none' : '1px solid var(--cream2)',
            borderTop: isAccent ? (r.type === 'total' ? '1.5px solid var(--border)' : '1px solid var(--border)') : undefined,
            color: isAccent ? 'var(--ink)' : 'var(--ink3)',
            fontWeight: isAccent ? 600 : 400,
            fontSize: r.type === 'total' ? 14 : 13,
            paddingTop: isAccent ? 7 : 6,
          }
          const valueStyle: React.CSSProperties = {
            padding: '6px 4px',
            textAlign: 'right',
            borderBottom: r.type === 'total' ? 'none' : '1px solid var(--cream2)',
            borderTop: isAccent ? (r.type === 'total' ? '1.5px solid var(--border)' : '1px solid var(--border)') : undefined,
            fontWeight: isAccent ? 700 : 500,
            fontSize: r.type === 'total' ? 14 : 13,
            paddingTop: isAccent ? 7 : 6,
          }
          return (
            <tr key={i}>
              <td style={labelStyle}>{r.label}</td>
              <td style={valueStyle}>{r.value}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
