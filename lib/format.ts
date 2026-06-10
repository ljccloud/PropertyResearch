export function gbp(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return '£' + Math.round(n).toLocaleString('en-GB')
}
export function pct(n: number): string {
  return (Math.round(n * 10) / 10) + '%'
}
export function psf(price: number, sqft: number): string {
  if (!price || !sqft) return '—'
  return '£' + Math.round(price / sqft) + '/sqft'
}
