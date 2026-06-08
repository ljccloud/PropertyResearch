import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { saveToDrive } from '@/lib/drive'
import type { AppState } from '@/types'

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const raw = cookieStore.get('drive_tokens')?.value
  if (!raw) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const tokens = JSON.parse(raw)
    const state: AppState = await req.json()
    await saveToDrive(tokens.access_token, state)
    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() })
  } catch (err) {
    console.error('Drive save error:', err)
    return NextResponse.json({ error: 'Failed to save to Drive' }, { status: 500 })
  }
}
