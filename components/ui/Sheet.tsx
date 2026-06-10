'use client'
import { useEffect } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(28,26,22,.5)',
        zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none', transition: 'opacity .2s',
      }}
    >
      <div style={{
        background: 'var(--cream)', borderRadius: '16px 16px 0 0', width: '100%',
        maxWidth: 430, maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform .25s cubic-bezier(.32,.72,0,1)',
      }}>
        <div style={{ width: 36, height: 4, background: 'var(--border2)', borderRadius: 99, margin: '10px auto 0', flexShrink: 0 }} />
        <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>{title}</div>
        <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ padding: '10px 16px calc(10px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
