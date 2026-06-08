import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { loadFromDrive } from '@/lib/drive'

export async function GET() {
  const cookieStore = cookies()
  const raw = cookieStore.get('drive_tokens')?.value
  if (!raw) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const tokens = JSON.parse(raw)
    const state = await loadFromDrive(tokens.access_token)
    return NextResponse.json(state)
  } catch (err) {
    console.error('Drive load error:', err)
    return NextResponse.json({ error: 'Failed to load from Drive' }, { status: 500 })
  }
}
