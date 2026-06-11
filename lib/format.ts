// Format a number as £1,234 with comma thousands separator
export function gbp(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return '£' + Math.round(n).toLocaleString('en-GB')
}

// Format a percentage
export function pct(n: number): string {
  return (Math.round(n * 10) / 10) + '%'
}

// Format price per sq ft
export function ppsf(price: number, sqft: number): string {
  if (!price || !sqft) return ''
  return '£' + Math.round(price / sqft).toLocaleString('en-GB') + '/sqft'
}

// Format price per sq m
export function ppsm(price: number, sqm: number): string {
  if (!price || !sqm) return ''
  return '£' + Math.round(price / sqm).toLocaleString('en-GB') + '/sqm'
}

// Format a plain number with comma separator
export function num(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return Math.round(n).toLocaleString('en-GB')
}
