// ─── Core types ───────────────────────────────────────────────

export interface Renovation {
  paint: number
  kitchen: number
  bathroom: number
  electrics: number
  boiler: number
  windows: number
  builder: number
  extra: { id: string; label: string; value: string }[]
}

export interface Financing {
  loan: number
  rate: number
  months: number
}

export interface LeaseExtension {
  cost: number
  legal: number
}

export interface PricePoint {
  date: string
  price: number
}

export interface Comparable {
  id: string
  address: string
  postcode: string
  price: number
  date: string
  dateListed?: string
  sqft: number
  sqm?: number
  psf?: number
  ticked: boolean
  beds?: number
  baths?: number
  tenure?: string
  outdoorSpace?: string
  guidePrice?: number
  notes?: string
}

export interface Comparables {
  forsale: Comparable[]
  sold: Comparable[]
  auction: Comparable[]
}

export interface Property {
  id: string
  address: string
  postcode: string
  listPrice: number
  sqft: number
  sqm: number
  beds: number
  baths: number
  dateListed: string
  url: string
  tags: string
  notes: string
  // Financials
  offerPrice: number
  resaleEst: number
  rent: number
  runningCosts: number
  renovation: Renovation
  financing: Financing
  leaseExtension: LeaseExtension
  purchaseFees: {
    specialConditionsPct: number
    auctionFeeFlat?: number
    legalFees?: number
    extraItems: { label: string; value: number }[]
  }
  // History
  priceHistory: PricePoint[]
  comparables: Comparables
  // Sale & resale
  finalSoldPrice: number
  finalSoldDate: string
  targetResale: number
  actualResale: number
  actualResaleDate: string
  // Archive
  archived: boolean
  outcome: 'Purchased' | 'Passed' | 'Outbid' | ''
  archiveReason: string
  archivedDate: string
  // Optional extras
  leaseYears?: number
  renoVatIncluded?: boolean
  loanOverride?: boolean
  tenure?: 'freehold' | 'leasehold' | 'share-of-freehold' | ''
  serviceCharge?: number
  methodOfSale?: 'private-treaty' | 'auction' | ''
  outdoorSpace?: 'none' | 'shared-garden' | 'garden' | 'balcony' | 'terrace' | 'roof-terrace' | ''
}

export interface PastSale {
  id: string
  address: string
  postcode: string
  guide: number
  dateListed: string
  dateSold: string
  soldPrice: number
  sqft?: number
  sqm?: number
  beds?: number
  outdoor: string
  notes: string
  auction: boolean
}

export interface Assumptions {
  vatRate: number
  sdltType: 'additional' | 'standard' | 'ftb'
  defRate: number
  defAF: number      // auction fee %
  defLegal: number
}

export interface ChangeLogEntry {
  id: string
  pid: string        // property id, or 'global'
  time: string       // ISO
  field: string
  oldValue?: string
  newValue?: string
  description: string
}

// The single JSON blob stored in Google Drive
export interface AppState {
  version: number
  properties: Property[]
  pastSales: PastSale[]
  assumptions: Assumptions
  compareIds: string[]
  changelog: ChangeLogEntry[]
  lastSaved: string  // ISO
}

// ─── Defaults ─────────────────────────────────────────────────

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  vatRate: 20,
  sdltType: 'additional',
  defRate: 6.5,
  defAF: 2,
  defLegal: 2500,
}

export const DEFAULT_STATE: AppState = {
  version: 1,
  properties: [],
  pastSales: [],
  assumptions: DEFAULT_ASSUMPTIONS,
  compareIds: [],
  changelog: [],
  lastSaved: new Date().toISOString(),
}

export function newProperty(): Property {
  return {
    id: uid(),
    address: '', postcode: '', listPrice: 0,
    sqft: 0, sqm: 0, beds: 0, baths: 0,
    dateListed: '', url: '', tags: '', notes: '',
    offerPrice: 0, resaleEst: 0, rent: 0, runningCosts: 0,
    renovation: { paint:0, kitchen:0, bathroom:0, electrics:0, boiler:0, windows:0, builder:0, extra:[] },
    financing: { loan: 0, rate: 6.5, months: 6 },
    leaseExtension: { cost: 0, legal: 0 },
    purchaseFees: { specialConditionsPct: 0, extraItems: [] },
    priceHistory: [],
    comparables: { forsale: [], sold: [], auction: [] },
    finalSoldPrice: 0, finalSoldDate: '',
    targetResale: 0, actualResale: 0, actualResaleDate: '',
    archived: false, outcome: '', archiveReason: '', archivedDate: '',
  }
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
