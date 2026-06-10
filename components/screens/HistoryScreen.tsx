'use client'
import { useStore } from '@/lib/store'
import { £ } from '@/lib/format'

interface Props { onOpenProperty: (id: string) => void }

export function HistoryScreen({ onOpenProperty }: Props) {
  const properties = useStore(s => s.properties)
  const archived = properties.filter(p => p.archived)

  if (!archived.length) {
    return <p style={{ textAlign: 'center', color: 'var(--ink3)', padding: 28, fontSize: 13 }}>No archived properties yet</p>
  }

  const byYear: Record<string, typeof archived> = {}
  archived.forEach(p => {
    const yr = p.archivedDate ? new Date(p.archivedDate).getFullYear().toString() : 'Unknown'
    if (!byYear[yr]) byYear[yr] = []
    byYear[yr].push(p)
  })

  const outcomeStyle: Record<string, React.CSSProperties> = {
    Purchased: { background: 'var(--green-bg)', color: 'var(--green)' },
    Passed:    { background: 'var(--cream2)',   color: 'var(--ink2)' },
    Outbid:    { background: 'var(--red-bg)',   color: 'var(--red)' },
  }

  return (
    <div>
      {Object.keys(byYear).sort((a, b) => Number(b) - Number(a)).map(yr => (
        <div key={yr}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', letterSpacing: '.08em', textTransform: 'uppercase', margin: '14px 0 7px' }}>{yr}</div>
          {byYear[yr].map(p => (
            <div key={p.id} onClick={() => onOpenProperty(p.id)} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 8, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.address}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{p.postcode}</div>
                </div>
                <span style={{ display: 'inline-flex', borderRadius: 99, padding: '2px 9px', fontSize: 11, fontWeight: 500, ...(outcomeStyle[p.outcome] || {}) }}>{p.outcome}</span>
              </div>
              {p.archiveReason && <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 4 }}>{p.archiveReason}</div>}
              <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{£(p.listPrice)}{p.sqft ? ` · ${p.sqft} sqft` : ''}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
