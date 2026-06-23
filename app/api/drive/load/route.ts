import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { loadFromDrive } from '@/lib/drive'
import type { StoredTokens } from '@/lib/drive'

const TOKEN_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
  path: '/',
}

export async function GET() {
  const cookieStore = cookies()
  const raw = cookieStore.get('drive_tokens')?.value
  if (!raw) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const stored: StoredTokens = JSON.parse(raw)
    const { state, refreshedTokens } = await loadFromDrive(stored)

    const res = NextResponse.json(state)

    // Persist refreshed tokens so the next request doesn't re-auth
    if (refreshedTokens) {
      res.cookies.set('drive_tokens', JSON.stringify(refreshedTokens), TOKEN_COOKIE_OPTS)
    }

    return res
  } catch (err: any) {
    console.error('Drive load error:', err)
    // If token is permanently invalid, clear cookie so the UI shows the reconnect screen
    if (err?.message?.includes('refresh_token')) {
      const res = NextResponse.json({ error: 'Session expired. Please reconnect.' }, { status: 401 })
      res.cookies.delete('drive_tokens')
      return res
    }
    return NextResponse.json({ error: 'Failed to load from Drive' }, { status: 500 })
  }
}
