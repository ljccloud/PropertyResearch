'use client'
interface FormRowProps { label: string; children: React.ReactNode; half?: boolean }
export function FormRow({ label, children }: FormRowProps) {
  return (
    <div style={{ marginBottom: 11 }}>
      <label style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 4, display: 'block' }}>{label}</label>
      {children}
    </div>
  )
}
export function Input({ style, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input style={{ width: '100%', background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'var(--ink)', outline: 'none', WebkitAppearance: 'none', appearance: 'none', ...style }} {...rest} />
  )
}
export function CInput({ style, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 6px', fontSize: 12, width: 90, textAlign: 'right', fontFamily: "'DM Sans',sans-serif", color: 'var(--ink)', outline: 'none', ...style }} {...rest} />
  )
}
export function Textarea({ style, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea style={{ width: '100%', background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'var(--ink)', outline: 'none', resize: 'vertical', minHeight: 80, lineHeight: 1.5, ...style }} {...rest} />
  )
}
