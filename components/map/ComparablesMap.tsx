/**
 * ComparablesMap
 *
 * Renders the subject property and comparable pins on a Leaflet map
 * using Stadia Maps' Alidade Smooth Light tile style.
 *
 * This is a client-only component — Leaflet requires the DOM.
 * Always import via ComparablesMapDynamic (ssr: false) not directly.
 *
 * Postcodes are geocoded via postcodes.io (free, no key needed).
 * Results are cached in module scope to avoid repeated fetches.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import type { Comparable } from '@/types'

// ─── Geocode cache ─────────────────────────────────────────────

const geocodeCache = new Map<string, [number, number] | null>()

async function geocodePostcode(postcode: string): Promise<[number, number] | null> {
  const clean = postcode.replace(/\s+/g, '').toUpperCase()
  if (geocodeCache.has(clean)) return geocodeCache.get(clean)!
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`)
    if (!res.ok) throw new Error('Not found')
    const data = await res.json()
    const coords: [number, number] = [data.result.latitude, data.result.longitude]
    geocodeCache.set(clean, coords)
    return coords
  } catch {
    geocodeCache.set(clean, null)
    return null
  }
}

// ─── Props ─────────────────────────────────────────────────────

interface ComparablesMapProps {
  subjectPostcode: string
  subjectAddress: string
  comparables: {
    forsale: Comparable[]
    sold: Comparable[]
    auction: Comparable[]
  }
  height?: number
}

// ─── Pin colours ───────────────────────────────────────────────

const COLOURS = {
  subject: '#8B6F47',
  forsale: '#1A4A7A',
  sold:    '#2D6A4F',
  soldOff: '#9A9690',
  auction: '#7A5C00',
  aucOff:  '#C0BBB0',
}

// ─── Component ─────────────────────────────────────────────────

export function ComparablesMap({
  subjectPostcode,
  subjectAddress,
  comparables,
  height = 180,
}: ComparablesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'no-postcode' | 'error'>('loading')


  useEffect(() => {
    if (!subjectPostcode) { setStatus('no-postcode'); return }

    let cancelled = false

    async function init() {
      // Dynamically import Leaflet (client-only, avoids SSR issues)
      const L = (await import('leaflet')).default

      // Import Leaflet CSS by injecting a link tag — avoids the
      // TypeScript "cannot find module" error for CSS imports
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      if (cancelled || !containerRef.current) return

      // Destroy previous instance if re-initialising
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

      // Geocode subject property
      const subjectCoords = await geocodePostcode(subjectPostcode)
      if (cancelled) return
      if (!subjectCoords) { setStatus('error'); return }

      // Initialise map
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: false,
      })
      mapRef.current = map

      // CartoDB Positron tiles — free, no account, no API key required
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        minZoom: 10,
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      }).addTo(map)

      // Helper: coloured circle DivIcon
      function circleIcon(colour: string, large = false) {
        const s = large ? 16 : 11
        return L.divIcon({
          className: '',
          html: `<div style="width:${s}px;height:${s}px;border-radius:50%;background:${colour};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25)"></div>`,
          iconSize: [s, s],
          iconAnchor: [s / 2, s / 2],
        })
      }

      // Subject property pin — use divIcon to avoid broken default Leaflet icon in Next.js
      const subjectMarker = L.marker(subjectCoords, {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:20px;height:20px;border-radius:50%;background:${COLOURS.subject};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35);position:relative;">
            <div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid ${COLOURS.subject}"></div>
          </div>`,
          iconSize: [20, 28],
          iconAnchor: [10, 28],
        })
      })
        .addTo(map)
        .bindPopup(`<strong style="font-family:DM Sans,sans-serif;font-size:12px">${subjectAddress || subjectPostcode}</strong>`)

      const allCoords: [number, number][] = [subjectCoords]

      // Geocode and plot comparables
      const allComps: { comp: Comparable; type: keyof typeof comparables }[] = [
        ...comparables.forsale.map(c => ({ comp: c, type: 'forsale' as const })),
        ...comparables.sold.map(c => ({ comp: c, type: 'sold' as const })),
        ...comparables.auction.map(c => ({ comp: c, type: 'auction' as const })),
      ]

      await Promise.all(
        allComps.map(async ({ comp, type }) => {
          if (!comp.postcode) return
          const coords = await geocodePostcode(comp.postcode)
          if (!coords || cancelled) return

          const colour = type === 'forsale'
            ? COLOURS.forsale
            : type === 'sold'
              ? (comp.ticked ? COLOURS.sold : COLOURS.soldOff)
              : (comp.ticked ? COLOURS.auction : COLOURS.aucOff)

          L.marker(coords, { icon: circleIcon(colour) })
            .addTo(map)
            .bindPopup(
              `<div style="font-family:DM Sans,sans-serif;font-size:11px;line-height:1.5">
                <strong>${comp.address}</strong><br>
                ${comp.postcode}<br>
                ${comp.price ? '£' + Math.round(comp.price).toLocaleString('en-GB') : ''}
                ${comp.psf ? ' · £' + comp.psf + '/sqft' : ''}
              </div>`
            )

          allCoords.push(coords)
        })
      )

      if (cancelled) return

      // Fit map to all pins
      if (allCoords.length === 1) {
        map.setView(subjectCoords, 15)
      } else {
        map.fitBounds(L.latLngBounds(allCoords), { padding: [24, 24] })
      }

      setStatus('ready')
    }

    init().catch(() => { if (!cancelled) setStatus('error') })

    return () => {
      cancelled = true
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectPostcode, subjectAddress, JSON.stringify(comparables)])

  const legend = [
    { colour: COLOURS.subject, label: 'Subject property' },
    { colour: COLOURS.forsale, label: 'For sale' },
    { colour: COLOURS.sold,    label: 'Sold (ticked)' },
    { colour: COLOURS.auction, label: 'Auction (ticked)' },
  ]

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        position: 'relative', height, borderRadius: 10, overflow: 'hidden',
        border: '1px solid var(--border)', background: 'var(--cream2)',
      }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {status === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream2)', fontSize: 12, color: 'var(--ink3)' }}>
            Loading map…
          </div>
        )}
        {status === 'no-postcode' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--ink3)', fontSize: 12 }}>
            <i className="ti ti-map-pin" style={{ fontSize: 24 }} />
            <span>Enter a postcode to show the map</span>
          </div>
        )}
        {status === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--ink3)', fontSize: 12 }}>
            <i className="ti ti-map-off" style={{ fontSize: 24 }} />
            <span>Could not geocode postcode</span>
          </div>
        )}
      </div>

      {status === 'ready' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6, paddingLeft: 2 }}>
          {legend.map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--ink3)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.colour, border: '1.5px solid #fff', boxShadow: '0 0 0 1px ' + l.colour }} />
              {l.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
