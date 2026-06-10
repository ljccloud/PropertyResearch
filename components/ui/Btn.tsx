'use client'
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  full?: boolean
}
export function Btn({ variant = 'ghost', full, style, children, ...rest }: BtnProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 6, padding: '10px 14px', fontFamily: "'DM Sans',sans-serif",
    fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
    flex: full ? 1 : undefined,
  }
  const variants = {
    primary: { background: 'var(--accent)', color: '#fff' },
    ghost: { background: 'none', border: '1px solid var(--border)', color: 'var(--ink2)' },
    danger: { background: 'none', border: '1px solid #dca8a8', color: 'var(--red)' },
  }
  return <button style={{ ...base, ...variants[variant], ...style }} {...rest}>{children}</button>
}
