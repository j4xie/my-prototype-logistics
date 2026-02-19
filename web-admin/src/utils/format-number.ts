/**
 * Shared number formatting utility.
 * Format a number for display:
 * - >= 1亿 → "X.XX亿"
 * - >= 1万 → "X.XX万"
 * - < 1万 → comma-separated with decimals
 * - Handles null/undefined/NaN gracefully
 */
export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value == null || isNaN(value)) return '--'
  if (Math.abs(value) >= 100000000) {
    return trimTrailingZeros((value / 100000000).toFixed(decimals)) + '亿'
  }
  if (Math.abs(value) >= 10000) {
    return trimTrailingZeros((value / 10000).toFixed(decimals)) + '万'
  }
  // Manual thousands separator (avoid toLocaleString for cross-env consistency)
  const fixed = value.toFixed(decimals)
  const [intPart, decPart] = fixed.split('.')
  const sign = intPart.startsWith('-') ? '-' : ''
  const digits = sign ? intPart.slice(1) : intPart
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (!decPart) return `${sign}${formatted}`
  const trimmed = decPart.replace(/0+$/, '')
  return trimmed ? `${sign}${formatted}.${trimmed}` : `${sign}${formatted}`
}

/** Strip trailing zeros from a fixed-decimal string: "1.90" → "1.9", "8170.0" → "8170" */
function trimTrailingZeros(s: string): string {
  if (!s.includes('.')) return s
  return s.replace(/\.?0+$/, '')
}

/**
 * Format an integer count (no decimals, no 万 abbreviation for small values).
 * Use for 订单数, 客户数 etc.
 */
/**
 * Format a number with comma separators only (no 万/亿 abbreviation).
 * Use when the component displays the unit separately (e.g., KPICard, DynamicKPIRow).
 */
export function formatPlainNumber(value: number | null | undefined, decimals = 1): string {
  if (value == null || isNaN(value)) return '--'
  const fixed = value.toFixed(decimals)
  const [intPart, decPart] = fixed.split('.')
  const sign = intPart.startsWith('-') ? '-' : ''
  const digits = sign ? intPart.slice(1) : intPart
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart ? `${sign}${formatted}.${decPart}` : `${sign}${formatted}`
}

export function formatCount(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '--'
  if (Math.abs(value) >= 100000000) return (value / 100000000).toFixed(1) + '亿'
  if (Math.abs(value) >= 10000) return (value / 10000).toFixed(1) + '万'
  return Math.round(value).toString()
}
