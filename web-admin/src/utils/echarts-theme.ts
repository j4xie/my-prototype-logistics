/**
 * Shared ECharts theme -- matches design token system in style.css
 *
 * Register once in main.ts:  registerEChartsTheme()
 * Use in components:          echarts.init(el, 'cretas')
 *
 * Color palette mirrors CHART_COLORS from @/constants/chart-colors.ts
 * and the CSS custom properties --chart-color-1 through --chart-color-10.
 */
import echarts from '@/utils/echarts'

const CHART_COLORS = [
  '#1B65A8', // brand blue        (--chart-color-1)
  '#36B37E', // success green     (--chart-color-2)
  '#FFAB00', // amber warning     (--chart-color-3)
  '#FF5630', // tomato red        (--chart-color-4)
  '#6B778C', // slate gray        (--chart-color-5)
  '#2B7EC1', // primary light     (--chart-color-6)
  '#57D9A3', // mint green        (--chart-color-7)
  '#FFC400', // golden yellow     (--chart-color-8)
  '#FF8B6A', // salmon            (--chart-color-9)
  '#4C9AFF', // sky blue          (--chart-color-10)
]

const theme: Record<string, unknown> = {
  color: CHART_COLORS,
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily:
      '"Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    color: '#4A5568',
  },
  title: {
    textStyle: {
      color: '#1A2332',
      fontSize: 16,
      fontWeight: 600,
    },
    subtextStyle: {
      color: '#7A8599',
      fontSize: 13,
    },
  },
  legend: {
    textStyle: {
      color: '#4A5568',
      fontSize: 12,
    },
  },
  tooltip: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    textStyle: {
      color: '#1A2332',
      fontSize: 13,
    },
    extraCssText:
      'box-shadow: 0 6px 20px rgba(27, 101, 168, 0.12); border-radius: 10px; backdrop-filter: blur(8px);',
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: '15%',
    containLabel: true,
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#E2E8F0' } },
    axisTick: { lineStyle: { color: '#E2E8F0' } },
    axisLabel: { color: '#7A8599', fontSize: 12 },
    splitLine: { lineStyle: { color: '#EDF2F7', type: 'dashed' } },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#7A8599', fontSize: 12 },
    splitLine: { lineStyle: { color: '#EDF2F7', type: 'dashed' } },
  },
  line: {
    smooth: false,
    symbolSize: 6,
    lineStyle: { width: 2 },
  },
  bar: {
    barMaxWidth: 40,
    itemStyle: { borderRadius: [6, 6, 0, 0] },
  },
  pie: {
    itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
  },
}

/**
 * Register the 'cretas' theme with ECharts.
 * Call this once before any chart is initialised (typically in main.ts).
 */
export function registerEChartsTheme(): void {
  echarts.registerTheme('cretas', theme)
}

export { CHART_COLORS }
export default theme
