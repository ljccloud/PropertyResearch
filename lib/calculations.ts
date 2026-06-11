import type { Assumptions } from '@/types'

// ─── SDLT banded calculation ───────────────────────────────────

interface SDLTBand {
  ceiling: number
  rate: number
}

const SDLT_BANDS: Record<Assumptions['sdltType'], SDLTBand[]> = {
  // Additional dwelling surcharge: standard rate + 5% on every band
  additional: [
    { ceiling: 125_000,   rate: 0.05 },
    { ceiling: 250_000,   rate: 0.07 },
    { ceiling: 925_000,   rate: 0.10 },
    { ceiling: 1_500_000, rate: 0.15 },
    { ceiling: Infinity,  rate: 0.17 },
  ],
  // Standard residential
  standard: [
    { ceiling: 125_000,   rate: 0.00 },
    { ceiling: 250_000,   rate: 0.02 },
    { ceiling: 925_000,   rate: 0.05 },
    { ceiling: 1_500_000, rate: 0.10 },
    { ceiling: Infinity,  rate: 0.12 },
  ],
  // First-time buyer relief
  ftb: [
    { ceiling: 425_000,   rate: 0.00 },
    { ceiling: 625_000,   rate: 0.05 },
    { ceiling: 925_000,   rate: 0.05 },
    { ceiling: 1_500_000, rate: 0.10 },
    { ceiling: Infinity,  rate: 0.12 },
  ],
}

export interface SDLTResult {
  total: number
  breakdown: { band: string; rate: number; taxable: number; tax: number }[]
}

export function calcSDLT(price: number, type: Assumptions['sdltType']): SDLTResult {
  const bands = SDLT_BANDS[type]
  let prev = 0
  let total = 0
  const breakdown: SDLTResult['breakdown'] = []

  for (const band of bands) {
    if (price <= prev) break
    const taxable = Math.min(price, band.ceiling) - prev
    const tax = taxable * band.rate
    breakdown.push({
      band: `£${prev.toLocaleString('en-GB')} – £${Math.min(price, band.ceiling).toLocaleString('en-GB')}`,
      rate: band.rate * 100,
      taxable,
      tax: Math.round(tax),
    })
    total += tax
    prev = band.ceiling
  }

  return { total: Math.round(total), breakdown }
}

// ─── Purchase fees ─────────────────────────────────────────────

export interface PurchaseFeesResult {
  sdlt: SDLTResult
  auctionFee: number
  specialConditions: number
  legalFees: number
  extraItems: number
  total: number
}

export function calcPurchaseFees(
  offerPrice: number,
  assumptions: Assumptions,
  specialConditionsPct: number,
  extraItems: number,
): PurchaseFeesResult {
  const sdlt = calcSDLT(offerPrice, assumptions.sdltType)
  const auctionFee = Math.round(offerPrice * (assumptions.defAF / 100))
  const specialConditions = Math.round(offerPrice * (specialConditionsPct / 100))
  const legalFees = assumptions.defLegal
  const total = sdlt.total + auctionFee + specialConditions + legalFees + extraItems

  return { sdlt, auctionFee, specialConditions, legalFees, extraItems, total }
}

// ─── Renovation ────────────────────────────────────────────────

export function calcRenovation(
  items: Record<string, number>,
  vatRate: number,
  inclVat: boolean,
): { subtotal: number; withVat: number } {
  const subtotal = Object.values(items).reduce((a, b) => a + (b || 0), 0)
  const withVat = inclVat ? Math.round(subtotal * (1 + vatRate / 100)) : subtotal
  return { subtotal: Math.round(subtotal), withVat }
}

// ─── Lease extension ───────────────────────────────────────────

export interface LeaseResult {
  cost: number
  sdlt: number   // 5% of cost
  legal: number
  total: number
}

export function calcLeaseExtension(cost: number, legal: number): LeaseResult {
  const sdlt = Math.round(cost * 0.05)
  return { cost, sdlt, legal, total: cost + sdlt + legal }
}

// ─── Financing ─────────────────────────────────────────────────

export interface FinancingResult {
  annual: number
  monthly: number
  total: number
}

export function calcFinancing(loan: number, ratePct: number, months: number): FinancingResult {
  const annual = Math.round(loan * (ratePct / 100))
  const monthly = Math.round(annual / 12)
  return { annual, monthly, total: monthly * months }
}

// ─── Master offer summary ──────────────────────────────────────

export interface OfferSummary {
  offerPrice: number
  purchaseFees: number
  renovation: number
  subtotal: number
  leaseExtension: number
  totalCost: number
  financingCost: number
  costAfterFinance: number
  potentialResale: number
  profitBeforeFinance: number
  profitAfterFinance: number
}

export function calcOfferSummary(
  offerPrice: number,
  purchaseFees: number,
  renovation: number,
  leaseExtension: number,
  financingCost: number,
  potentialResale: number,
): OfferSummary {
  const subtotal = offerPrice + purchaseFees + renovation
  const totalCost = subtotal + leaseExtension
  const costAfterFinance = totalCost + financingCost
  return {
    offerPrice,
    purchaseFees,
    renovation,
    subtotal,
    leaseExtension,
    totalCost,
    financingCost,
    costAfterFinance,
    potentialResale,
    profitBeforeFinance: potentialResale - totalCost,
    profitAfterFinance: potentialResale - costAfterFinance,
  }
}

// ─── Yield ─────────────────────────────────────────────────────

export interface YieldResult {
  gross: number
  net: number
}

export function calcYield(
  monthlyRent: number,
  runningCosts: number,
  totalCost: number,
): YieldResult | null {
  if (!monthlyRent || !totalCost) return null
  const annual = monthlyRent * 12
  return {
    gross: (annual / totalCost) * 100,
    net: ((annual - runningCosts) / totalCost) * 100,
  }
}

// ─── Sensitivity ───────────────────────────────────────────────

export function calcSensitivity(
  baseOffer: number,
  assumptions: Assumptions,
  purchaseFeesFixed: number,   // non-price-dependent fees (legal, extras)
  auctionFeePct: number,
  scPct: number,
  renovation: number,
  leaseExtension: number,
  financing: number,
  potentialResale: number,
): { delta: number; profit: number }[] {
  return [-0.10, -0.05, 0, 0.05, 0.10].map((delta) => {
    const offer = baseOffer * (1 + delta)
    const sdlt = calcSDLT(offer, assumptions.sdltType).total
    const fees = sdlt + Math.round(offer * auctionFeePct / 100) + Math.round(offer * scPct / 100) + purchaseFeesFixed
    const totalCost = offer + fees + renovation + leaseExtension
    const profit = potentialResale - (totalCost + financing)
    return { delta, profit: Math.round(profit) }
  })
}
