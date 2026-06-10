'use client'
import { useState } from 'react'
interface CollapsibleProps { title: string; children: React.ReactNode; defaultOpen?: boolean }
export function Collapsible({ title, children, defaultOpen = false }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 8 }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--cream2)', border: '1px solid var(--border)', borderRadius: open ? '6px 6px 0 0' : 6, padding: '9px 12px', cursor: 'pointer', fontWeight: 500, fontSize: 13, userSelect: 'none' }}>
        <span>{title}</span>
        <i className="ti ti-chevron-down" style={{ fontSize: 14, color: 'var(--ink3)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </div>
      {open && (
        <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: 12, background: '#fff' }}>
          {children}
        </div>
      )}
    </div>
  )
}
