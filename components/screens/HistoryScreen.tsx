'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { gbp } from '@/lib/format'
import { Sheet } from '@/components/ui/Sheet'
import { Btn } from '@/components/ui/Btn'

interface Props { onOpenProperty: (id: string) => void }

export function HistoryScreen({ onOpenProperty }: Props) {
  const { properties, updateProperty } = useStore()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const archived = properties.filter(p => p.archived)

  function handleDelete(id: string) {
    // Mark as deleted by removing from active list — use a deleted flag
    updateProperty(id, { deleted: true } as any)
    setConfirmId(null)
  }

  function handleUnarchive(id: string) {
    updateProperty(id, { archived: false, outcome: '' as any, archivedDate: '', archiveReason: '' })
  }

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

  const confirmProp = properties.find(p => p.id === confirmId)

  return (
    <div>
      {Object.keys(byYear).sort((a, b) => Number(b) - Number(a)).map(yr => (
        <div key={yr}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', letterSpacing: '.08em', textTransform: 'uppercase', margin: '14px 0 7px' }}>{yr}</div>
          {byYear[yr].filter((p: any) => !p.deleted).map(p => (
            <div key={p.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div onClick={() => onOpenProperty(p.id)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.address}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{p.postcode}</div>
                  </div>
                  <span style={{ display: 'inline-flex', borderRadius: 99, padding: '2px 9px', fontSize: 11, fontWeight: 500, flexShrink: 0, ...(outcomeStyle[p.outcome] || {}) }}>{p.outcome}</span>
                </div>
                {p.archiveReason && <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 4 }}>{p.archiveReason}</div>}
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>{gbp(p.listPrice)}{p.sqft ? ` · ${p.sqft.toLocaleString('en-GB')} sqft` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--cream2)', paddingTop: 8 }}>
                <button onClick={() => handleUnarchive(p.id)} style={{ flex: 1, fontSize: 11, padding: '5px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--ink2)', fontFamily: "'DM Sans',sans-serif" }}>
                  <i className="ti ti-arrow-back-up" style={{ fontSize: 11, marginRight: 3 }} />Unarchive
                </button>
                <button onClick={() => setConfirmId(p.id)} style={{ flex: 1, fontSize: 11, padding: '5px 8px', background: 'none', border: '1px solid #dca8a8', borderRadius: 6, cursor: 'pointer', color: 'var(--red)', fontFamily: "'DM Sans',sans-serif" }}>
                  <i className="ti ti-trash" style={{ fontSize: 11, marginRight: 3 }} />Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      <Sheet open={!!confirmId} onClose={() => setConfirmId(null)} title="Delete property"
        footer={<>
          <Btn onClick={() => setConfirmId(null)}>Cancel</Btn>
          <Btn variant="danger" full onClick={() => confirmId && handleDelete(confirmId)}>Delete permanently</Btn>
        </>}>
        <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
          Are you sure you want to permanently delete <strong>{confirmProp?.address}</strong>?
        </p>
        <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>This cannot be undone.</p>
      </Sheet>
    </div>
  )
}
