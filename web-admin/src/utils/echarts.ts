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
  VisualMapComponent,
  GeoComponent,
  GraphicComponent,
  DatasetComponent,
  TransformComponent,
  ParallelComponent,
} from 'echarts/components'

// ---- Renderer ----
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  // charts
  BarChart, LineChart, PieChart, ScatterChart, RadarChart,
  GaugeChart, HeatmapChart, MapChart, CustomChart, BoxplotChart,
  SunburstChart, FunnelChart, TreemapChart, SankeyChart, TreeChart,
  // components
  GridComponent, TooltipComponent, LegendComponent, TitleComponent,
  DataZoomComponent, ToolboxComponent, MarkLineComponent, MarkPointComponent,
  VisualMapComponent, GeoComponent, GraphicComponent, DatasetComponent,
  TransformComponent, ParallelComponent,
  // renderer
  CanvasRenderer,
])

export default echarts
