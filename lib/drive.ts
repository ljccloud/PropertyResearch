/**
 * Google Drive storage layer.
 *
 * All app data lives in a single file called `property-tracker.json`
 * in the user's Google Drive root (or App Data folder).
 *
 * Server-side only — never import this in client components.
 */

import { google } from 'googleapis'
import type { AppState } from '@/types'
import { DEFAULT_STATE } from '@/types'

const FILE_NAME = 'property-tracker.json'
const MIME_JSON = 'application/json'

// ─── Token types ───────────────────────────────────────────────

export interface StoredTokens {
  access_token: string
  refresh_token?: string
  expiry_date?: number
}

// ─── OAuth2 client ─────────────────────────────────────────────

function getOAuth2Client(tokens: StoredTokens) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
  client.setCredentials(tokens)
  return client
}

function getDrive(tokens: StoredTokens) {
  return google.drive({ version: 'v3', auth: getOAuth2Client(tokens) })
}

// ─── Token refresh ─────────────────────────────────────────────

/**
 * Returns valid tokens, refreshing via the refresh_token if the
 * access_token has expired (or will expire in the next 60 seconds).
 *
 * Also returns `refreshedTokens` when a new access_token was issued
 * so the caller can update the cookie.
 */
export async function ensureFreshTokens(stored: StoredTokens): Promise<{
  tokens: StoredTokens
  refreshedTokens: StoredTokens | null
}> {
  const bufferMs = 60 * 1000 // refresh if <60s left
  const isExpired =
    stored.expiry_date && Date.now() > stored.expiry_date - bufferMs

  if (!isExpired) {
    return { tokens: stored, refreshedTokens: null }
  }

  if (!stored.refresh_token) {
    // No refresh token available — caller will need to re-authenticate
    throw new Error('access_token expired and no refresh_token available')
  }

  const client = getOAuth2Client(stored)
  const { credentials } = await client.refreshAccessToken()

  const refreshed: StoredTokens = {
    access_token: credentials.access_token!,
    refresh_token: credentials.refresh_token ?? stored.refresh_token,
    expiry_date: credentials.expiry_date ?? undefined,
  }

  return { tokens: refreshed, refreshedTokens: refreshed }
}

// ─── Find or create the data file ─────────────────────────────

async function findFileId(tokens: StoredTokens): Promise<string | null> {
  const drive = getDrive(tokens)
  const res = await drive.files.list({
    q: `name='${FILE_NAME}' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  })
  return res.data.files?.[0]?.id ?? null
}

async function createFile(tokens: StoredTokens, state: AppState): Promise<string> {
  const drive = getDrive(tokens)
  const res = await drive.files.create({
    requestBody: { name: FILE_NAME, mimeType: MIME_JSON },
    media: { mimeType: MIME_JSON, body: JSON.stringify(state, null, 2) },
    fields: 'id',
  })
  return res.data.id!
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Load app state from Drive.
 * Returns DEFAULT_STATE if no file exists yet (first run).
 * Also returns any refreshed tokens so the caller can update the cookie.
 */
export async function loadFromDrive(stored: StoredTokens): Promise<{
  state: AppState
  refreshedTokens: StoredTokens | null
}> {
  const { tokens, refreshedTokens } = await ensureFreshTokens(stored)
  const drive = getDrive(tokens)
  const fileId = await findFileId(tokens)

  if (!fileId) {
    return { state: DEFAULT_STATE, refreshedTokens }
  }

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' },
  )

  const state = await new Promise<AppState>((resolve, reject) => {
    let raw = ''
    const stream = res.data as NodeJS.ReadableStream
    stream.on('data', (chunk: Buffer) => { raw += chunk.toString() })
    stream.on('end', () => {
      try {
        const parsed = JSON.parse(raw) as AppState
        resolve({ ...DEFAULT_STATE, ...parsed })
      } catch {
        resolve(DEFAULT_STATE)
      }
    })
    stream.on('error', reject)
  })

  return { state, refreshedTokens }
}

/**
 * Save app state to Drive.
 * Creates the file if it doesn't exist; updates it if it does.
 * Always stamps lastSaved before writing.
 * Also returns any refreshed tokens so the caller can update the cookie.
 */
export async function saveToDrive(
  stored: StoredTokens,
  state: AppState,
): Promise<{ refreshedTokens: StoredTokens | null }> {
  const { tokens, refreshedTokens } = await ensureFreshTokens(stored)
  const drive = getDrive(tokens)
  const stamped: AppState = { ...state, lastSaved: new Date().toISOString() }
  const body = JSON.stringify(stamped, null, 2)

  const fileId = await findFileId(tokens)

  if (!fileId) {
    await createFile(tokens, stamped)
    return { refreshedTokens }
  }

  await drive.files.update({
    fileId,
    media: { mimeType: MIME_JSON, body },
  })

  return { refreshedTokens }
}

/**
 * Delete the data file (used for full reset / testing).
 */
export async function deleteFile(stored: StoredTokens): Promise<void> {
  const { tokens } = await ensureFreshTokens(stored)
  const drive = getDrive(tokens)
  const fileId = await findFileId(tokens)
  if (fileId) await drive.files.delete({ fileId })
}
