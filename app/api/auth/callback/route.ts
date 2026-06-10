/**
 * GET /api/auth/callback
 * Google redirects here after the user grants consent.
 * Exchanges the auth code for tokens and stores them in an httpOnly cookie.
 *
 * Common errors and causes:
 * - "redirect_uri_mismatch": GOOGLE_REDIRECT_URI env var doesn't exactly match
 *   the URI registered in Google Cloud Console (check for trailing slash,
 *   http vs https, typos)
 * - "access_denied": the Google account used is not added as a Test User in
 *   Google Cloud Console → APIs & Services → OAuth consent screen → Test users
 * - "invalid_client": GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing
 *   or incorrect in Vercel environment variables
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
  const error = req.nextUrl.searchParams.get('error')

  // Google returned an error (e.g. user denied, wrong account)
  if (error) {
    const messages: Record<string, string> = {
      access_denied: 'This Google account is not authorised. Make sure you are signing in with an account added as a Test User in Google Cloud Console.',
      redirect_uri_mismatch: 'Redirect URI mismatch. Check GOOGLE_REDIRECT_URI in Vercel matches the URI in Google Cloud Console exactly.',
    }
    const msg = messages[error] || `Google auth error: ${error}`
    return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(msg)}`, req.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?auth_error=Missing+authorisation+code', req.url))
  }

  try {
    const client = getClient()
    const { tokens } = await client.getToken(code)

    // Store tokens in httpOnly cookie — not accessible to JavaScript
    const cookieStore = cookies()
    cookieStore.set('drive_tokens', JSON.stringify(tokens), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    return NextResponse.redirect(new URL('/', req.url))
  } catch (err: any) {
    console.error('OAuth token exchange error:', err?.message || err)
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent('Failed to complete sign in. Please try again.')}`, req.url)
    )
  }
}
