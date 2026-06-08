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

// ─── OAuth2 client ─────────────────────────────────────────────
// Credentials come from environment variables (see .env.local.example)

function getOAuth2Client(accessToken: string) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
  client.setCredentials({ access_token: accessToken })
  return client
}

function getDrive(accessToken: string) {
  return google.drive({ version: 'v3', auth: getOAuth2Client(accessToken) })
}

// ─── Find or create the data file ─────────────────────────────

async function findFileId(accessToken: string): Promise<string | null> {
  const drive = getDrive(accessToken)
  const res = await drive.files.list({
    q: `name='${FILE_NAME}' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  })
  return res.data.files?.[0]?.id ?? null
}

async function createFile(accessToken: string, state: AppState): Promise<string> {
  const drive = getDrive(accessToken)
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
 */
export async function loadFromDrive(accessToken: string): Promise<AppState> {
  const drive = getDrive(accessToken)
  const fileId = await findFileId(accessToken)

  if (!fileId) {
    // First run — return defaults; file will be created on first save
    return DEFAULT_STATE
  }

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' },
  )

  return new Promise((resolve, reject) => {
    let raw = ''
    const stream = res.data as NodeJS.ReadableStream
    stream.on('data', (chunk: Buffer) => { raw += chunk.toString() })
    stream.on('end', () => {
      try {
        const parsed = JSON.parse(raw) as AppState
        // Merge with defaults to handle schema additions across versions
        resolve({ ...DEFAULT_STATE, ...parsed })
      } catch {
        resolve(DEFAULT_STATE)
      }
    })
    stream.on('error', reject)
  })
}

/**
 * Save app state to Drive.
 * Creates the file if it doesn't exist; updates it if it does.
 * Always stamps lastSaved before writing.
 */
export async function saveToDrive(
  accessToken: string,
  state: AppState,
): Promise<void> {
  const drive = getDrive(accessToken)
  const stamped: AppState = { ...state, lastSaved: new Date().toISOString() }
  const body = JSON.stringify(stamped, null, 2)

  const fileId = await findFileId(accessToken)

  if (!fileId) {
    await createFile(accessToken, stamped)
    return
  }

  await drive.files.update({
    fileId,
    media: { mimeType: MIME_JSON, body },
  })
}

/**
 * Delete the data file (used for full reset / testing).
 */
export async function deleteFile(accessToken: string): Promise<void> {
  const drive = getDrive(accessToken)
  const fileId = await findFileId(accessToken)
  if (fileId) await drive.files.delete({ fileId })
}
