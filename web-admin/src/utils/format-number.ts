/**
 * Shared number formatting utility.
 * Consolidates duplicate formatNumber implementations from:
 *   - src/views/analytics/index.vue
 *   - src/views/smart-bi/ProductionAnalysis.vue
 *   - src/components/smartbi/index.ts (remains there for its own callers)
 *
 * Format a number for display:
 * - Large numbers get abbreviated (万, 亿)
 * - Decimals get rounded to the specified number of places
 * - Handles null/undefined/NaN gracefully
 */
export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value == null || isNaN(value)) return '--'
  if (Math.abs(value) >= 100000000) {
    return (value / 100000000).toFixed(decimals) + '亿'
  }
  if (Math.abs(value) >= 10000) {
    return (value / 10000).toFixed(decimals) + '万'
  }
  // Manual thousands separator (avoid toLocaleString for cross-env consistency)
  const fixed = value.toFixed(decimals)
  const [intPart, decPart] = fixed.split('.')
  const sign = intPart.startsWith('-') ? '-' : ''
  const digits = sign ? intPart.slice(1) : intPart
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart ? `${sign}${formatted}.${decPart}` : `${sign}${formatted}`
}
