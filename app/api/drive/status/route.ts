import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = cookies()
  const raw = cookieStore.get('drive_tokens')?.value
  return NextResponse.json({ authenticated: !!raw })
}
