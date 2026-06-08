/**
 * UK postcode geocoding via postcodes.io
 *
 * Free, no API key, no account, no rate limit for reasonable use.
 * Returns [latitude, longitude] or null if not found.
 *
 * Results are cached in module scope for the lifetime of the page.
 * In a future iteration this could be persisted to the AppState
 * so postcodes aren't re-fetched on every session.
 */

const cache = new Map<string, [number, number] | null>()

export async function geocodePostcode(
  postcode: string
): Promise<[number, number] | null> {
  const clean = postcode.replace(/\s+/g, '').toUpperCase()
  if (!clean) return null
  if (cache.has(clean)) return cache.get(clean)!

  try {
    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`
    )
    if (!res.ok) throw new Error(`${res.status}`)
    const { result } = await res.json()
    const coords: [number, number] = [result.latitude, result.longitude]
    cache.set(clean, coords)
    return coords
  } catch {
    cache.set(clean, null)
    return null
  }
}

/**
 * Bulk geocode — returns a map of postcode → coords.
 * Skips any already in cache; fetches the rest in parallel.
 */
export async function geocodePostcodes(
  postcodes: string[]
): Promise<Map<string, [number, number] | null>> {
  const result = new Map<string, [number, number] | null>()
  await Promise.all(
    postcodes.map(async (pc) => {
      result.set(pc, await geocodePostcode(pc))
    })
  )
  return result
}
