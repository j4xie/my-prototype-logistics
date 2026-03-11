/**
 * ECharts 按需引入 — 减少首屏约 500KB
 *
 * 所有组件统一从此文件导入:
 *   import echarts from '@/utils/echarts'
 *
 * 替代全量引入:
 *   import * as echarts from 'echarts'  // ← 不要再用
 */
import * as echarts from 'echarts/core'

// ---- Charts ----
import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  RadarChart,
  GaugeChart,
  HeatmapChart,
  MapChart,
  CustomChart,
  BoxplotChart,
  SunburstChart,
  FunnelChart,
  TreemapChart,
  SankeyChart,
  TreeChart,
} from 'echarts/charts'

// ---- Components ----
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  MarkPointComponent,
  MarkAreaComponent,
  VisualMapComponent,
  GeoComponent,
  GraphicComponent,
  DatasetComponent,
  TransformComponent,
  ParallelComponent,
  AxisPointerComponent,
  PolarComponent,
} from 'echarts/components'

// ---- Renderers ----
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers'

echarts.use([
  // charts
  BarChart, LineChart, PieChart, ScatterChart, RadarChart,
  GaugeChart, HeatmapChart, MapChart, CustomChart, BoxplotChart,
  SunburstChart, FunnelChart, TreemapChart, SankeyChart, TreeChart,
  // components
  GridComponent, TooltipComponent, LegendComponent, TitleComponent,
  DataZoomComponent, ToolboxComponent, MarkLineComponent, MarkPointComponent, MarkAreaComponent,
  VisualMapComponent, GeoComponent, GraphicComponent, DatasetComponent,
  TransformComponent, ParallelComponent, AxisPointerComponent, PolarComponent,
  // renderers
  CanvasRenderer, SVGRenderer,
])

// ---- Light theme ----
echarts.registerTheme('cretas', {
  color: ['#1B65A8', '#36B37E', '#FFAB00', '#FF5630', '#6B778C',
          '#4C9AFF', '#57D9A3', '#FFC400', '#FF8B6A', '#A3A0FB'],
  backgroundColor: 'transparent',
  textStyle: { color: '#303133' },
  title: { textStyle: { color: '#303133' }, subtextStyle: { color: '#909399' } },
  legend: { textStyle: { color: '#606266' } },
  tooltip: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: '#e4e7ed',
    textStyle: { color: '#303133' },
    extraCssText: 'box-shadow:0 4px 12px rgba(0,0,0,0.08);border-radius:8px;padding:12px 16px;',
  },
  categoryAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#909399', fontSize: 11 },
    splitLine: { lineStyle: { color: '#f0f2f5', type: 'dashed' } },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#909399', fontSize: 11 },
    splitLine: { lineStyle: { color: '#f0f2f5', type: 'dashed' } },
  },
  line: { symbol: 'circle', symbolSize: 6, lineStyle: { width: 3 }, smooth: true },
  bar: { itemStyle: { borderRadius: [4, 4, 0, 0] } },
  pie: { itemStyle: { borderColor: '#fff', borderWidth: 2 } },
})

// ---- B3: Dark mode theme ----
echarts.registerTheme('cretas-dark', {
  color: ['#4C9AFF', '#57D9A3', '#FFC400', '#FF8B6A', '#A3A0FB',
          '#2B7EC1', '#36B37E', '#FFAB00', '#FF5630', '#6B778C'],
  backgroundColor: '#1a1a2e',
  textStyle: { color: '#e0e0e0' },
  title: { textStyle: { color: '#e0e0e0' }, subtextStyle: { color: '#aaa' } },
  legend: { textStyle: { color: '#c0c0c0' } },
  tooltip: {
    backgroundColor: 'rgba(22,33,62,0.96)',
    borderColor: '#2a2a4a',
    textStyle: { color: '#e0e0e0' },
    extraCssText: 'box-shadow:0 4px 20px rgba(0,0,0,0.4);border-radius:8px;padding:12px 16px;',
  },
  axisPointer: { lineStyle: { color: '#4C9AFF' } },
  categoryAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#b0b0b0', fontSize: 11 },
    splitLine: { lineStyle: { color: '#2a2a4a', type: 'dashed' } },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#b0b0b0', fontSize: 11 },
    splitLine: { lineStyle: { color: '#2a2a4a', type: 'dashed' } },
  },
  line: { symbol: 'circle', symbolSize: 6, lineStyle: { width: 3 }, smooth: true },
  bar: { itemStyle: { borderRadius: [4, 4, 0, 0] } },
  pie: { itemStyle: { borderColor: '#1a1a2e', borderWidth: 2 } },
  gauge: { axisLine: { lineStyle: { color: [[1, '#3a3a5a']] } } },
  dataZoom: {
    backgroundColor: 'rgba(76,154,255,0.05)',
    fillerColor: 'rgba(76,154,255,0.15)',
    handleStyle: { color: '#4C9AFF', borderColor: '#4C9AFF' },
    textStyle: { color: '#b0b0b0' },
    borderColor: 'transparent',
  },
  toolbox: {
    iconStyle: { borderColor: '#b0b0b0' },
    emphasis: { iconStyle: { borderColor: '#4C9AFF' } },
  },
  markLine: { lineStyle: { color: '#4a4a6a' } },
})

export default echarts
