/**
 * GET /api/auth
 * Redirects the user to Google's OAuth consent screen.
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
    // drive.file = access only to files this app created (safer than full drive)
    scope: ['https://www.googleapis.com/auth/drive.file'],
    prompt: 'select_account consent',
    include_granted_scopes: true,
  })
  //Apppend &authuser=-1 to force Google to show the account picker regardless of existing browser session
  return NextResponse.redirect(url + '&authuser=-1')
}
