/**
 * ComparablesMapDynamic
 *
 * Wraps ComparablesMap with Next.js dynamic import (ssr: false).
 * Leaflet requires the browser DOM and cannot run server-side.
 * Always import THIS component in your pages, not ComparablesMap directly.
 *
 * Usage:
 *   import { ComparablesMapDynamic } from '@/components/map/ComparablesMapDynamic'
 *
 *   <ComparablesMapDynamic
 *     subjectPostcode={property.postcode}
 *     subjectAddress={property.address}
 *     comparables={property.comparables}
 *   />
 */

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { ComparablesMap } from './ComparablesMap'

export const ComparablesMapDynamic = dynamic(
  () => import('./ComparablesMap').then((m) => m.ComparablesMap),
  {
    ssr: false,
    loading: () => (
      <div style={{
        height: 180,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--cream2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color: 'var(--ink3)',
        marginBottom: 12,
      }}>
        Loading map…
      </div>
    ),
  }
) as typeof ComparablesMap
