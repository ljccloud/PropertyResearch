/**
 * DriveProvider
 *
 * Wraps the app. On mount:
 *   1. Checks for auth_error in the URL (redirect from failed OAuth)
 *   2. Checks /api/drive/status for existing session
 *   3. If authenticated, loads state from Drive and hydrates the store
 *   4. If not, shows the Connect Google Drive prompt
 *
 * Google Cloud Console requirements:
 * - OAuth consent screen must have your Google account added as a Test User
 *   (APIs & Services → OAuth consent screen → Test users)
 * - Authorised redirect URI must exactly match GOOGLE_REDIRECT_URI
 *   (including https://, no trailing slash)
 * - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI must all
 *   be set in Vercel environment variables, then redeployed
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
    // Check for auth error passed back from OAuth callback
    const params = new URLSearchParams(window.location.search)
    const authError = params.get('auth_error')
    if (authError) {
      setErrorMsg(decodeURIComponent(authError))
      setStatus('unauthenticated')
      // Clean the URL
      window.history.replaceState({}, '', '/')
      return
    }

    async function init() {
      try {
        const statusRes = await fetch('/api/drive/status')
        const { authenticated } = await statusRes.json()

        if (!authenticated) {
          setStatus('unauthenticated')
          return
        }

        setStatus('loading')
        const loadRes = await fetch('/api/drive/load')

        // 401 means the session expired and the refresh token was missing —
        // show the reconnect screen rather than a generic error
        if (loadRes.status === 401) {
          setStatus('unauthenticated')
          return
        }

        if (!loadRes.ok) throw new Error('Failed to load data from Drive')
        const state: AppState = await loadRes.json()
        hydrate(state)
        setStatus('ready')
      } catch (err: any) {
        setErrorMsg(err?.message || 'Something went wrong')
        setStatus('error')
      }
    }

    init()
  }, [hydrate])

  if (status === 'checking' || status === 'loading') {
    return (
      <div style={s.center}>
        <div style={s.spinner} />
        <p style={s.hint}>{status === 'checking' ? 'Connecting…' : 'Loading your data…'}</p>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div style={s.center}>
        <div style={s.card}>
          <h1 style={s.heading}>Property Tracker</h1>

          {errorMsg && (
            <div style={s.errorBox}>
              <strong style={{ display: 'block', marginBottom: 4 }}>Sign in failed</strong>
              {errorMsg}
            </div>
          )}

          <p style={s.body}>Connect your Google Drive to load and save your property data.</p>
          <a href="/api/auth" style={s.btn}>
            {errorMsg ? 'Try again' : 'Connect Google Drive'}
          </a>

          <p style={s.note}>Only accesses files created by this app. Nothing else in your Drive is touched.</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={s.center}>
        <div style={s.card}>
          <h1 style={s.heading}>Something went wrong</h1>
          <div style={s.errorBox}>{errorMsg}</div>
          <a href="/api/auth" style={s.btn}>Reconnect Google Drive</a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

const s: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100dvh', background: '#FAF8F4',
    fontFamily: "'DM Sans', sans-serif", padding: 16,
  },
  spinner: {
    width: 28, height: 28,
    border: '2px solid #D8D4CA', borderTop: '2px solid #8B6F47',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    position: 'absolute',
  },
  hint: { marginTop: 44, fontSize: 13, color: '#9A9690' },
  card: {
    background: '#fff', border: '1px solid #D8D4CA', borderRadius: 12,
    padding: '28px 24px', maxWidth: 420, width: '100%', textAlign: 'center',
  },
  heading: {
    fontFamily: "'DM Serif Display', serif", fontSize: 22,
    color: '#1C1A16', marginBottom: 12,
  },
  body: { fontSize: 14, color: '#5A5650', lineHeight: 1.6, marginBottom: 18 },
  btn: {
    display: 'inline-block', background: '#8B6F47', color: '#fff',
    borderRadius: 6, padding: '10px 20px', fontSize: 14, fontWeight: 500,
    textDecoration: 'none', marginBottom: 16,
  },
  errorBox: {
    background: '#F4E8E8', border: '1px solid #dca8a8', borderRadius: 8,
    padding: '10px 12px', fontSize: 12, color: '#8B2020',
    textAlign: 'left', marginBottom: 16, lineHeight: 1.5,
  },
  note: { fontSize: 11, color: '#9A9690', lineHeight: 1.5 },
}
