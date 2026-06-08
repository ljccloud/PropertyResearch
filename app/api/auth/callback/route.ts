/**
 * GET /api/auth/callback
 * Google redirects here after the user grants consent.
 * We exchange the code for tokens and store them in an httpOnly cookie.
 */

import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

function getClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const client = getClient()
  const { tokens } = await client.getToken(code)

  // Store tokens in httpOnly cookie (not accessible to JS)
  // In production you'd want to encrypt this or use a proper session store
  const cookieStore = cookies()
  cookieStore.set('drive_tokens', JSON.stringify(tokens), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  return NextResponse.redirect(new URL('/', req.url))
}
