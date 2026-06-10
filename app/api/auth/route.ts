/**
 * GET /api/auth
 * Redirects the user to Google's OAuth consent screen.
 *
 * - prompt: 'select_account consent' forces the account picker every time
 * - authuser=-1 appended to the URL tells Google not to pre-select any
 *   signed-in browser session, ensuring the picker always appears
 */

import { google } from 'googleapis'
import { NextResponse } from 'next/server'

function getClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
}

export async function GET() {
  const client = getClient()

  const url = client.generateAuthUrl({
    access_type: 'offline',
    // drive.file = only files this app creates, nothing else in Drive
    scope: ['https://www.googleapis.com/auth/drive.file'],
    // select_account forces the account picker
    // consent re-prompts for permissions (required for refresh token)
    prompt: 'select_account consent',
    include_granted_scopes: true,
  })

  // authuser=-1 tells Google to ignore any existing browser session
  // and always show the full account picker
  return NextResponse.redirect(url + '&authuser=-1')
}
