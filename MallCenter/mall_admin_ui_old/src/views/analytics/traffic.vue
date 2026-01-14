<!--
  流量统计页面
-->
<template>
  <div class="app-container traffic-analytics">
    <!-- 日期选择器 -->
    <el-card class="filter-card">
      <el-row :gutter="20" align="middle">
        <el-col :span="8">
          <el-radio-group v-model="dateRange" @change="handleDateRangeChange">
            <el-radio-button label="today">今日</el-radio-button>
            <el-radio-button label="yesterday">昨日</el-radio-button>
            <el-radio-button label="week">近7天</el-radio-button>
            <el-radio-button label="month">近30天</el-radio-button>
            <el-radio-button label="custom">自定义</el-radio-button>
          </el-radio-group>
        </el-col>
        <el-col :span="8" v-if="dateRange === 'custom'">
          <el-date-picker
            v-model="customDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            @change="loadAllData"
          />
        </el-col>
        <el-col :span="8" class="text-right">
          <el-button type="primary" @click="handleExport" :loading="exporting">
            <el-icon><Download /></el-icon> 导出报表
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 核心指标卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6" v-for="stat in overviewStats" :key="stat.key">
        <el-card class="stat-card" shadow="hover" v-loading="loading.overview">
          <div class="stat-content">
            <div class="stat-icon" :style="{ backgroundColor: stat.bgColor }">
              <el-icon :size="24" :color="stat.color"><component :is="stat.icon" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ formatNumber(stat.value) }}</div>
              <div class="stat-label">{{ stat.label }}</div>
              <div class="stat-change" :class="stat.change >= 0 ? 'up' : 'down'">
                <el-icon v-if="stat.change >= 0"><ArrowUp /></el-icon>
                <el-icon v-else><ArrowDown /></el-icon>
                {{ Math.abs(stat.change) }}% 较上期
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 流量趋势图表 -->
    <el-row :gutter="20">
      <el-col :span="16">
        <el-card class="chart-card" v-loading="loading.trend">
          <template #header>
            <div class="card-header">
              <span>流量趋势</span>
              <el-radio-group v-model="trendMetric" size="small" @change="loadTrendData">
                <el-radio-button label="pv">浏览量(PV)</el-radio-button>
                <el-radio-button label="uv">访客数(UV)</el-radio-button>
                <el-radio-button label="ip">独立IP</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div class="chart-container" ref="trendChartRef"></div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="chart-card" v-loading="loading.source">
          <template #header>
            <span>流量来源</span>
          </template>
          <div class="chart-container" ref="sourceChartRef"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 页面排行 & 地域分布 -->
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card class="chart-card" v-loading="loading.pages">
          <template #header>
            <div class="card-header">
              <span>页面排行 TOP 10</span>
              <el-button type="primary" link size="small" @click="showAllPages = true">
                查看全部
              </el-button>
            </div>
          </template>
          <el-table :data="pageRanking" stripe style="width: 100%" max-height="400">
            <el-table-column type="index" label="排名" width="60" />
            <el-table-column prop="pageName" label="页面名称" min-width="180" show-overflow-tooltip />
            <el-table-column prop="pv" label="浏览量" width="100" align="right">
              <template #default="{ row }">
                {{ formatNumber(row.pv) }}
              </template>
            </el-table-column>
            <el-table-column prop="uv" label="访客数" width="100" align="right">
              <template #default="{ row }">
                {{ formatNumber(row.uv) }}
              </template>
            </el-table-column>
            <el-table-column prop="avgDuration" label="平均时长" width="100" align="right">
              <template #default="{ row }">
                {{ formatDuration(row.avgDuration) }}
              </template>
            </el-table-column>
            <el-table-column prop="bounceRate" label="跳出率" width="80" align="right">
              <template #default="{ row }">
                {{ row.bounceRate }}%
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="chart-card" v-loading="loading.region">
          <template #header>
            <div class="card-header">
              <span>地域分布</span>
              <el-radio-group v-model="regionType" size="small" @change="loadRegionData">
                <el-radio-button label="province">省份</el-radio-button>
                <el-radio-button label="city">城市</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div class="region-list">
            <div
              class="region-item"
              v-for="(item, index) in regionData.slice(0, 10)"
              :key="item.name"
            >
              <span class="region-rank">{{ index + 1 }}</span>
              <span class="region-name">{{ item.name }}</span>
              <div class="region-bar-wrapper">
                <div
                  class="region-bar"
                  :style="{ width: `${item.percentage}%` }"
                ></div>
              </div>
              <span class="region-value">{{ formatNumber(item.value) }}</span>
              <span class="region-percent">{{ item.percentage }}%</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 设备分布 -->
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="8">
        <el-card class="chart-card" v-loading="loading.device">
          <template #header>
            <span>设备类型</span>
          </template>
          <div class="chart-container" ref="deviceChartRef"></div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="chart-card" v-loading="loading.device">
          <template #header>
            <span>操作系统</span>
          </template>
          <div class="chart-container" ref="osChartRef"></div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="chart-card" v-loading="loading.device">
          <template #header>
            <span>浏览器</span>
          </template>
          <div class="chart-container" ref="browserChartRef"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 全部页面弹窗 -->
    <el-dialog v-model="showAllPages" title="全部页面排行" width="800px">
      <el-table :data="allPageRanking" stripe style="width: 100%" max-height="500">
        <el-table-column type="index" label="排名" width="60" />
        <el-table-column prop="pagePath" label="页面路径" min-width="200" show-overflow-tooltip />
        <el-table-column prop="pageName" label="页面名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="pv" label="浏览量" width="100" align="right" sortable>
          <template #default="{ row }">
            {{ formatNumber(row.pv) }}
          </template>
        </el-table-column>
        <el-table-column prop="uv" label="访客数" width="100" align="right" sortable>
          <template #default="{ row }">
            {{ formatNumber(row.uv) }}
          </template>
        </el-table-column>
        <el-table-column prop="avgDuration" label="平均时长" width="100" align="right">
          <template #default="{ row }">
            {{ formatDuration(row.avgDuration) }}
          </template>
        </el-table-column>
        <el-table-column prop="bounceRate" label="跳出率" width="80" align="right">
          <template #default="{ row }">
            {{ row.bounceRate }}%
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup name="TrafficAnalytics">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Download, ArrowUp, ArrowDown,
  View, User, Connection, Timer
} from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import {
  getTrafficOverview,
  getTrafficTrend,
  getSourceDistribution,
  getPageRanking,
  getRegionDistribution,
  getDeviceDistribution,
  exportReport
} from '@/api/analytics'

// 状态
const dateRange = ref('week')
const customDateRange = ref([])
const trendMetric = ref('pv')
const regionType = ref('province')
const showAllPages = ref(false)
const exporting = ref(false)

const loading = reactive({
  overview: false,
  trend: false,
  source: false,
  pages: false,
  region: false,
  device: false
})

// 图表引用
const trendChartRef = ref(null)
const sourceChartRef = ref(null)
const deviceChartRef = ref(null)
const osChartRef = ref(null)
const browserChartRef = ref(null)

let trendChart = null
let sourceChart = null
let deviceChart = null
let osChart = null
let browserChart = null

// 数据
const overviewStats = ref([
  { key: 'pv', label: '浏览量(PV)', value: 0, change: 0, icon: 'View', color: '#409eff', bgColor: '#ecf5ff' },
  { key: 'uv', label: '访客数(UV)', value: 0, change: 0, icon: 'User', color: '#67c23a', bgColor: '#f0f9eb' },
  { key: 'ip', label: '独立IP', value: 0, change: 0, icon: 'Connection', color: '#e6a23c', bgColor: '#fdf6ec' },
  { key: 'avgDuration', label: '平均访问时长', value: 0, change: 0, icon: 'Timer', color: '#f56c6c', bgColor: '#fef0f0' }
])

const pageRanking = ref([])
const allPageRanking = ref([])
const regionData = ref([])

// 获取日期参数
const getDateParams = () => {
  const today = new Date()
  let startDate, endDate

  switch (dateRange.value) {
    case 'today':
      startDate = endDate = formatDate(today)
      break
    case 'yesterday':
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      startDate = endDate = formatDate(yesterday)
      break
    case 'week':
      endDate = formatDate(today)
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 6)
      startDate = formatDate(weekAgo)
      break
    case 'month':
      endDate = formatDate(today)
      const monthAgo = new Date(today)
      monthAgo.setDate(monthAgo.getDate() - 29)
      startDate = formatDate(monthAgo)
      break
    case 'custom':
      if (customDateRange.value?.length === 2) {
        startDate = customDateRange.value[0]
        endDate = customDateRange.value[1]
      }
      break
  }

  return { startDate, endDate }
}

const formatDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 加载概览数据
const loadOverviewData = async () => {
  loading.overview = true
  try {
    const params = getDateParams()
    const res = await getTrafficOverview(params)
    const data = res.data || {}

    overviewStats.value = [
      { key: 'pv', label: '浏览量(PV)', value: data.pv || 0, change: data.pvChange || 0, icon: 'View', color: '#409eff', bgColor: '#ecf5ff' },
      { key: 'uv', label: '访客数(UV)', value: data.uv || 0, change: data.uvChange || 0, icon: 'User', color: '#67c23a', bgColor: '#f0f9eb' },
      { key: 'ip', label: '独立IP', value: data.ip || 0, change: data.ipChange || 0, icon: 'Connection', color: '#e6a23c', bgColor: '#fdf6ec' },
      { key: 'avgDuration', label: '平均访问时长', value: data.avgDuration || 0, change: data.durationChange || 0, icon: 'Timer', color: '#f56c6c', bgColor: '#fef0f0' }
    ]
  } catch (error) {
    console.error('加载概览数据失败:', error)
    // 模拟数据
    overviewStats.value = [
      { key: 'pv', label: '浏览量(PV)', value: 125680, change: 12.5, icon: 'View', color: '#409eff', bgColor: '#ecf5ff' },
      { key: 'uv', label: '访客数(UV)', value: 35420, change: 8.3, icon: 'User', color: '#67c23a', bgColor: '#f0f9eb' },
      { key: 'ip', label: '独立IP', value: 28650, change: -2.1, icon: 'Connection', color: '#e6a23c', bgColor: '#fdf6ec' },
      { key: 'avgDuration', label: '平均访问时长', value: 245, change: 5.6, icon: 'Timer', color: '#f56c6c', bgColor: '#fef0f0' }
    ]
  } finally {
    loading.overview = false
  }
}

// 加载趋势数据
const loadTrendData = async () => {
  loading.trend = true
  try {
    const params = { ...getDateParams(), metric: trendMetric.value }
    const res = await getTrafficTrend(params)
    renderTrendChart(res.data || [])
  } catch (error) {
    console.error('加载趋势数据失败:', error)
    // 模拟数据
    const mockData = generateMockTrendData()
    renderTrendChart(mockData)
  } finally {
    loading.trend = false
  }
}

// 生成模拟趋势数据
const generateMockTrendData = () => {
  const data = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    data.push({
      date: formatDate(date),
      value: Math.floor(Math.random() * 10000) + 5000
    })
  }
  return data
}

// 渲染趋势图表
const renderTrendChart = (data) => {
  if (!trendChartRef.value) return

  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: '{b}<br/>{a}: {c}'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map(item => item.date)
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      name: trendMetric.value === 'pv' ? '浏览量' : trendMetric.value === 'uv' ? '访客数' : '独立IP',
      type: 'line',
      smooth: true,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
          { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
        ])
      },
      lineStyle: {
        color: '#409eff',
        width: 2
      },
      itemStyle: {
        color: '#409eff'
      },
      data: data.map(item => item.value)
    }]
  }

  trendChart.setOption(option)
}

// 加载来源数据
const loadSourceData = async () => {
  loading.source = true
  try {
    const params = getDateParams()
    const res = await getSourceDistribution(params)
    renderSourceChart(res.data || [])
  } catch (error) {
    console.error('加载来源数据失败:', error)
    // 模拟数据
    const mockData = [
      { name: '直接访问', value: 35 },
      { name: '搜索引擎', value: 28 },
      { name: '外部链接', value: 18 },
      { name: '社交媒体', value: 12 },
      { name: '其他', value: 7 }
    ]
    renderSourceChart(mockData)
  } finally {
    loading.source = false
  }
}

// 渲染来源图表
const renderSourceChart = (data) => {
  if (!sourceChartRef.value) return

  if (!sourceChart) {
    sourceChart = echarts.init(sourceChartRef.value)
  }

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center'
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: false
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      data: data.map(item => ({
        name: item.name,
        value: item.value
      }))
    }]
  }

  sourceChart.setOption(option)
}

// 加载页面排行
const loadPageData = async () => {
  loading.pages = true
  try {
    const params = { ...getDateParams(), limit: 100 }
    const res = await getPageRanking(params)
    allPageRanking.value = res.data || []
    pageRanking.value = allPageRanking.value.slice(0, 10)
  } catch (error) {
    console.error('加载页面数据失败:', error)
    // 模拟数据
    const mockData = [
      { pagePath: '/', pageName: '首页', pv: 45680, uv: 12350, avgDuration: 180, bounceRate: 25 },
      { pagePath: '/goods/list', pageName: '商品列表', pv: 32150, uv: 9870, avgDuration: 245, bounceRate: 32 },
      { pagePath: '/goods/detail', pageName: '商品详情', pv: 28900, uv: 8520, avgDuration: 320, bounceRate: 18 },
      { pagePath: '/cart', pageName: '购物车', pv: 18650, uv: 6230, avgDuration: 156, bounceRate: 42 },
      { pagePath: '/order/confirm', pageName: '订单确认', pv: 12800, uv: 4560, avgDuration: 280, bounceRate: 15 },
      { pagePath: '/user/center', pageName: '个人中心', pv: 9870, uv: 3450, avgDuration: 120, bounceRate: 35 },
      { pagePath: '/traceability', pageName: '溯源查询', pv: 8650, uv: 2890, avgDuration: 210, bounceRate: 28 },
      { pagePath: '/ai/chat', pageName: 'AI问答', pv: 6540, uv: 2150, avgDuration: 380, bounceRate: 12 },
      { pagePath: '/category', pageName: '分类页', pv: 5890, uv: 1980, avgDuration: 95, bounceRate: 45 },
      { pagePath: '/search', pageName: '搜索页', pv: 4560, uv: 1650, avgDuration: 85, bounceRate: 38 }
    ]
    allPageRanking.value = mockData
    pageRanking.value = mockData.slice(0, 10)
  } finally {
    loading.pages = false
  }
}

// 加载地域数据
const loadRegionData = async () => {
  loading.region = true
  try {
    const params = { ...getDateParams(), type: regionType.value }
    const res = await getRegionDistribution(params)
    regionData.value = res.data || []
  } catch (error) {
    console.error('加载地域数据失败:', error)
    // 模拟数据
    const mockData = regionType.value === 'province' ? [
      { name: '广东', value: 18650, percentage: 18 },
      { name: '江苏', value: 15230, percentage: 15 },
      { name: '浙江', value: 12890, percentage: 13 },
      { name: '上海', value: 10560, percentage: 10 },
      { name: '北京', value: 9870, percentage: 10 },
      { name: '山东', value: 8650, percentage: 8 },
      { name: '四川', value: 7890, percentage: 8 },
      { name: '河南', value: 6540, percentage: 6 },
      { name: '湖北', value: 5890, percentage: 6 },
      { name: '福建', value: 4560, percentage: 5 }
    ] : [
      { name: '深圳', value: 8650, percentage: 12 },
      { name: '广州', value: 7890, percentage: 11 },
      { name: '上海', value: 7230, percentage: 10 },
      { name: '北京', value: 6890, percentage: 9 },
      { name: '杭州', value: 5650, percentage: 8 },
      { name: '成都', value: 4890, percentage: 7 },
      { name: '南京', value: 4560, percentage: 6 },
      { name: '苏州', value: 4120, percentage: 6 },
      { name: '武汉', value: 3890, percentage: 5 },
      { name: '东莞', value: 3560, percentage: 5 }
    ]
    regionData.value = mockData
  } finally {
    loading.region = false
  }
}

// 加载设备数据
const loadDeviceData = async () => {
  loading.device = true
  try {
    const params = getDateParams()
    const res = await getDeviceDistribution(params)
    const data = res.data || {}
    renderDeviceCharts(data)
  } catch (error) {
    console.error('加载设备数据失败:', error)
    // 模拟数据
    const mockData = {
      deviceType: [
        { name: '移动端', value: 68 },
        { name: 'PC端', value: 28 },
        { name: '平板', value: 4 }
      ],
      os: [
        { name: 'Android', value: 45 },
        { name: 'iOS', value: 32 },
        { name: 'Windows', value: 18 },
        { name: 'macOS', value: 5 }
      ],
      browser: [
        { name: '微信', value: 42 },
        { name: 'Chrome', value: 28 },
        { name: 'Safari', value: 18 },
        { name: '其他', value: 12 }
      ]
    }
    renderDeviceCharts(mockData)
  } finally {
    loading.device = false
  }
}

// 渲染设备图表
const renderDeviceCharts = (data) => {
  nextTick(() => {
    // 设备类型
    if (deviceChartRef.value) {
      if (!deviceChart) {
        deviceChart = echarts.init(deviceChartRef.value)
      }
      renderPieChart(deviceChart, data.deviceType || [])
    }

    // 操作系统
    if (osChartRef.value) {
      if (!osChart) {
        osChart = echarts.init(osChartRef.value)
      }
      renderPieChart(osChart, data.os || [])
    }

    // 浏览器
    if (browserChartRef.value) {
      if (!browserChart) {
        browserChart = echarts.init(browserChartRef.value)
      }
      renderPieChart(browserChart, data.browser || [])
    }
  })
}

// 渲染饼图
const renderPieChart = (chart, data) => {
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {d}%'
    },
    series: [{
      type: 'pie',
      radius: ['35%', '65%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 6,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        formatter: '{b}\n{d}%',
        fontSize: 12
      },
      data: data
    }]
  }
  chart.setOption(option)
}

// 格式化数字
const formatNumber = (num) => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  return num.toLocaleString()
}

// 格式化时长
const formatDuration = (seconds) => {
  if (seconds < 60) {
    return seconds + '秒'
  }
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}分${secs}秒`
}

// 日期范围变化
const handleDateRangeChange = () => {
  if (dateRange.value !== 'custom') {
    loadAllData()
  }
}

// 导出报表
const handleExport = async () => {
  exporting.value = true
  try {
    const params = { ...getDateParams(), type: 'traffic' }
    const res = await exportReport(params)

    // 创建下载链接
    const blob = new Blob([res], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `流量统计报表_${getDateParams().startDate}_${getDateParams().endDate}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)

    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

// 加载所有数据
const loadAllData = () => {
  loadOverviewData()
  loadTrendData()
  loadSourceData()
  loadPageData()
  loadRegionData()
  loadDeviceData()
}

// 窗口大小变化时重绘图表
const handleResize = () => {
  trendChart?.resize()
  sourceChart?.resize()
  deviceChart?.resize()
  osChart?.resize()
  browserChart?.resize()
}

// 初始化
onMounted(() => {
  loadAllData()
  window.addEventListener('resize', handleResize)
})

// 销毁
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  sourceChart?.dispose()
  deviceChart?.dispose()
  osChart?.dispose()
  browserChart?.dispose()
})
</script>

<style lang="scss" scoped>
.traffic-analytics {
  .filter-card {
    margin-bottom: 20px;
  }

  .text-right {
    text-align: right;
  }

  .stats-row {
    margin-bottom: 20px;
  }

  .stat-card {
    .stat-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .stat-info {
      flex: 1;
    }

    .stat-value {
      font-size: 28px;
      font-weight: bold;
      color: #303133;
    }

    .stat-label {
      font-size: 14px;
      color: #909399;
      margin: 4px 0;
    }

    .stat-change {
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;

      &.up {
        color: #67c23a;
      }

      &.down {
        color: #f56c6c;
      }
    }
  }

  .chart-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .chart-container {
      height: 300px;
    }
  }

  .region-list {
    .region-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #ebeef5;

      &:last-child {
        border-bottom: none;
      }
    }

    .region-rank {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: #f5f7fa;
      color: #909399;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;

      &:nth-child(1) {
        background: #ffd700;
        color: #fff;
      }
    }

    .region-item:nth-child(1) .region-rank {
      background: #ffd700;
      color: #fff;
    }

    .region-item:nth-child(2) .region-rank {
      background: #c0c0c0;
      color: #fff;
    }

    .region-item:nth-child(3) .region-rank {
      background: #cd7f32;
      color: #fff;
    }

    .region-name {
      width: 80px;
      font-size: 14px;
      color: #303133;
    }

    .region-bar-wrapper {
      flex: 1;
      height: 8px;
      background: #f5f7fa;
      border-radius: 4px;
      overflow: hidden;
    }

    .region-bar {
      height: 100%;
      background: linear-gradient(90deg, #409eff, #67c23a);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .region-value {
      width: 60px;
      text-align: right;
      font-size: 14px;
      color: #606266;
    }

    .region-percent {
      width: 40px;
      text-align: right;
      font-size: 12px;
      color: #909399;
    }
  }
}
</style>
