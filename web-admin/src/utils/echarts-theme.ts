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
  '#409eff', // primary blue    (--chart-color-1)
  '#67c23a', // success green   (--chart-color-2)
  '#e6a23c', // warning orange  (--chart-color-3)
  '#f56c6c', // danger red      (--chart-color-4)
  '#909399', // info gray       (--chart-color-5)
  '#5470c6', // deeper blue     (--chart-color-6)
  '#91cc75', // lighter green   (--chart-color-7)
  '#fac858', // yellow          (--chart-color-8)
  '#ee6666', // lighter red     (--chart-color-9)
  '#73c0de', // cyan            (--chart-color-10)
]

const theme: Record<string, unknown> = {
  color: CHART_COLORS,
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    color: '#606266',
  },
  title: {
    textStyle: {
      color: '#303133',
      fontSize: 16,
      fontWeight: 600,
    },
    subtextStyle: {
      color: '#86909c',
      fontSize: 13,
    },
  },
  legend: {
    textStyle: {
      color: '#606266',
      fontSize: 12,
    },
  },
  tooltip: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderColor: '#ebeef5',
    borderWidth: 1,
    textStyle: {
      color: '#303133',
      fontSize: 13,
    },
    extraCssText:
      'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border-radius: 6px;',
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: '15%',
    containLabel: true,
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#dcdfe6' } },
    axisTick: { lineStyle: { color: '#dcdfe6' } },
    axisLabel: { color: '#86909c', fontSize: 12 },
    splitLine: { lineStyle: { color: '#ebeef5', type: 'dashed' } },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#86909c', fontSize: 12 },
    splitLine: { lineStyle: { color: '#ebeef5', type: 'dashed' } },
  },
  line: {
    smooth: false,
    symbolSize: 6,
    lineStyle: { width: 2 },
  },
  bar: {
    barMaxWidth: 40,
    itemStyle: { borderRadius: [4, 4, 0, 0] },
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
