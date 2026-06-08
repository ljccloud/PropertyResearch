/**
 * DriveProvider
 * Wraps the app. On mount:
 *   1. Checks /api/drive/status
 *   2. If authenticated, loads state from /api/drive/load and hydrates the store
 *   3. If not, shows a "Connect Google Drive" prompt
 *
 * This is a client component — all Drive interaction happens via the API routes.
 */

'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import type { AppState } from '@/types'

type Status = 'checking' | 'unauthenticated' | 'loading' | 'ready' | 'error'

export function DriveProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('checking')
  const [errorMsg, setErrorMsg] = useState('')
  const hydrate = useStore((s) => s.hydrate)

  useEffect(() => {
    async function init() {
      // 1. Check auth
      const statusRes = await fetch('/api/drive/status')
      const { authenticated } = await statusRes.json()

      if (!authenticated) {
        setStatus('unauthenticated')
        return
      }

      // 2. Load state
      setStatus('loading')
      try {
        const loadRes = await fetch('/api/drive/load')
        if (!loadRes.ok) throw new Error('Load failed')
        const state: AppState = await loadRes.json()
        hydrate(state)
        setStatus('ready')
      } catch (err) {
        setErrorMsg(String(err))
        setStatus('error')
      }
    }
    init()
  }, [hydrate])

  if (status === 'checking' || status === 'loading') {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.label}>{status === 'checking' ? 'Connecting…' : 'Loading your data…'}</p>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h1 style={styles.heading}>Property Tracker</h1>
          <p style={styles.body}>Connect your Google Drive to load and save your property data securely.</p>
          <a href="/api/auth" style={styles.btn}>Connect Google Drive</a>
          <p style={styles.note}>Only accesses files created by this app. Nothing else in your Drive is touched.</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h1 style={styles.heading}>Something went wrong</h1>
          <p style={styles.body}>{errorMsg || 'Could not load your data from Drive.'}</p>
          <a href="/api/auth" style={styles.btn}>Reconnect</a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100dvh', background: '#FAF8F4', fontFamily: "'DM Sans', sans-serif",
  },
  spinner: {
    width: 32, height: 32,
    border: '2px solid #D8D4CA', borderTop: '2px solid #8B6F47',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    position: 'absolute',
  },
  label: { marginTop: 48, fontSize: 13, color: '#9A9690' },
  card: {
    background: '#fff', border: '1px solid #D8D4CA', borderRadius: 12,
    padding: '32px 28px', maxWidth: 340, width: '90%', textAlign: 'center',
  },
  heading: {
    fontFamily: "'DM Serif Display', serif", fontSize: 24, color: '#1C1A16', marginBottom: 12,
  },
  body: { fontSize: 14, color: '#5A5650', lineHeight: 1.6, marginBottom: 20 },
  btn: {
    display: 'inline-block', background: '#8B6F47', color: '#fff',
    borderRadius: 6, padding: '10px 20px', fontSize: 14, fontWeight: 500,
    textDecoration: 'none', marginBottom: 14,
  },
  note: { fontSize: 11, color: '#9A9690', lineHeight: 1.5 },
}
