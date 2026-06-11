'use client'

interface Row {
  label: React.ReactNode
  value: React.ReactNode
  type?: 'normal' | 'subtotal' | 'total'
}

export function CalcTable({ rows }: { rows: Row[] }) {
  return (
    <table style={{
      width: '100%',
      borderCollapse: 'collapse',
      background: '#fff',
      borderRadius: 14,
      overflow: 'hidden',
      border: '1px solid var(--border)',
      marginBottom: 12,
      fontSize: 12,
    }}>
      <tbody>
        {rows.map((r, i) => {
          const isSub = r.type === 'subtotal'
          const isTotal = r.type === 'total'
          const isAccent = isSub || isTotal
          const rowStyle: React.CSSProperties = {
            borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
            background: isAccent ? 'var(--cream2)' : '#fff',
          }
          const labelStyle: React.CSSProperties = {
            padding: '6px 10px',
            verticalAlign: 'middle',
            whiteSpace: 'nowrap',
            color: isAccent ? 'var(--ink)' : 'var(--ink2)',
            fontWeight: isTotal ? 700 : isSub ? 600 : 400,
            width: '55%',
          }
          const valueStyle: React.CSSProperties = {
            padding: '6px 10px',
            verticalAlign: 'middle',
            textAlign: 'right',
            fontWeight: isTotal ? 700 : isSub ? 600 : 500,
          }
          return (
            <tr key={i} style={rowStyle}>
              <td style={labelStyle}>{r.label}</td>
              <td style={valueStyle}>{r.value}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
