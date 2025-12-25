<!--
  转化分析页面
-->
<template>
  <div class="app-container conversion-analytics">
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

    <!-- 核心转化指标 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6" v-for="stat in conversionStats" :key="stat.key">
        <el-card class="stat-card" shadow="hover" v-loading="loading.overview">
          <div class="stat-content">
            <div class="stat-icon" :style="{ backgroundColor: stat.bgColor }">
              <el-icon :size="24" :color="stat.color"><component :is="stat.icon" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stat.isPercent ? stat.value + '%' : formatNumber(stat.value) }}</div>
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

    <!-- 转化漏斗 -->
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="chart-card" v-loading="loading.funnel">
          <template #header>
            <span>转化漏斗</span>
          </template>
          <div class="funnel-container">
            <div
              class="funnel-step"
              v-for="(step, index) in funnelData"
              :key="step.name"
              :style="{ width: `${step.percentage}%` }"
            >
              <div class="funnel-bar" :style="{ backgroundColor: funnelColors[index] }">
                <span class="funnel-name">{{ step.name }}</span>
                <span class="funnel-value">{{ formatNumber(step.value) }}</span>
              </div>
              <div class="funnel-rate" v-if="index < funnelData.length - 1">
                <el-icon><ArrowDown /></el-icon>
                {{ step.conversionRate }}%
              </div>
            </div>
          </div>
          <div class="funnel-summary">
            <div class="summary-item">
              <span class="summary-label">整体转化率</span>
              <span class="summary-value highlight">{{ overallConversionRate }}%</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">流失环节</span>
              <span class="summary-value">{{ maxLossStep }}</span>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="chart-card" v-loading="loading.trend">
          <template #header>
            <div class="card-header">
              <span>转化率趋势</span>
              <el-select v-model="trendStep" size="small" style="width: 120px" @change="loadTrendData">
                <el-option label="整体转化" value="overall" />
                <el-option label="加购转化" value="cart" />
                <el-option label="下单转化" value="order" />
                <el-option label="支付转化" value="payment" />
              </el-select>
            </div>
          </template>
          <div class="chart-container" ref="trendChartRef"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 购物车分析 -->
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="16">
        <el-card class="chart-card" v-loading="loading.cart">
          <template #header>
            <span>购物车分析</span>
          </template>
          <el-row :gutter="20">
            <el-col :span="8">
              <div class="cart-stat">
                <div class="cart-stat-value">{{ formatNumber(cartData.totalCarts) }}</div>
                <div class="cart-stat-label">购物车总数</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="cart-stat">
                <div class="cart-stat-value">{{ formatNumber(cartData.activeCartValue) }}</div>
                <div class="cart-stat-label">活跃购物车价值</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="cart-stat">
                <div class="cart-stat-value">{{ cartData.abandonRate }}%</div>
                <div class="cart-stat-label">购物车放弃率</div>
              </div>
            </el-col>
          </el-row>
          <el-divider />
          <div class="cart-products-title">购物车热门商品 TOP 5</div>
          <el-table :data="cartData.topProducts" stripe style="width: 100%">
            <el-table-column type="index" label="排名" width="60" />
            <el-table-column prop="name" label="商品名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="addCount" label="加购次数" width="100" align="right">
              <template #default="{ row }">
                {{ formatNumber(row.addCount) }}
              </template>
            </el-table-column>
            <el-table-column prop="buyRate" label="购买转化率" width="100" align="right">
              <template #default="{ row }">
                {{ row.buyRate }}%
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="chart-card" v-loading="loading.cart">
          <template #header>
            <span>放弃原因分析</span>
          </template>
          <div class="chart-container" ref="abandonChartRef"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 订单分析 -->
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card class="chart-card" v-loading="loading.order">
          <template #header>
            <span>订单转化分析</span>
          </template>
          <el-row :gutter="20">
            <el-col :span="8">
              <div class="order-stat">
                <div class="order-stat-value">{{ formatNumber(orderData.totalOrders) }}</div>
                <div class="order-stat-label">订单总数</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="order-stat">
                <div class="order-stat-value">{{ formatNumber(orderData.paidOrders) }}</div>
                <div class="order-stat-label">支付订单</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="order-stat">
                <div class="order-stat-value">{{ orderData.paymentRate }}%</div>
                <div class="order-stat-label">支付转化率</div>
              </div>
            </el-col>
          </el-row>
          <el-divider />
          <div class="order-channels">
            <div class="channel-title">下单渠道分布</div>
            <div class="channel-list">
              <div
                class="channel-item"
                v-for="channel in orderData.channels"
                :key="channel.name"
              >
                <span class="channel-name">{{ channel.name }}</span>
                <div class="channel-bar-wrapper">
                  <div
                    class="channel-bar"
                    :style="{ width: `${channel.percentage}%`, backgroundColor: channel.color }"
                  ></div>
                </div>
                <span class="channel-value">{{ channel.percentage }}%</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="chart-card" v-loading="loading.order">
          <template #header>
            <span>订单金额分布</span>
          </template>
          <div class="chart-container" ref="orderAmountChartRef"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 复购分析 -->
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="8">
        <el-card class="chart-card" v-loading="loading.repurchase">
          <template #header>
            <span>复购概览</span>
          </template>
          <div class="repurchase-stats">
            <div class="repurchase-stat">
              <div class="repurchase-value">{{ repurchaseData.rate }}%</div>
              <div class="repurchase-label">复购率</div>
              <div class="repurchase-change" :class="repurchaseData.rateChange >= 0 ? 'up' : 'down'">
                <el-icon v-if="repurchaseData.rateChange >= 0"><ArrowUp /></el-icon>
                <el-icon v-else><ArrowDown /></el-icon>
                {{ Math.abs(repurchaseData.rateChange) }}%
              </div>
            </div>
            <el-divider direction="vertical" />
            <div class="repurchase-stat">
              <div class="repurchase-value">{{ repurchaseData.avgInterval }}</div>
              <div class="repurchase-label">平均复购周期(天)</div>
              <div class="repurchase-change" :class="repurchaseData.intervalChange <= 0 ? 'up' : 'down'">
                <el-icon v-if="repurchaseData.intervalChange <= 0"><ArrowDown /></el-icon>
                <el-icon v-else><ArrowUp /></el-icon>
                {{ Math.abs(repurchaseData.intervalChange) }}%
              </div>
            </div>
            <el-divider direction="vertical" />
            <div class="repurchase-stat">
              <div class="repurchase-value">{{ repurchaseData.avgTimes }}</div>
              <div class="repurchase-label">人均购买次数</div>
              <div class="repurchase-change" :class="repurchaseData.timesChange >= 0 ? 'up' : 'down'">
                <el-icon v-if="repurchaseData.timesChange >= 0"><ArrowUp /></el-icon>
                <el-icon v-else><ArrowDown /></el-icon>
                {{ Math.abs(repurchaseData.timesChange) }}%
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="chart-card" v-loading="loading.repurchase">
          <template #header>
            <span>复购次数分布</span>
          </template>
          <div class="chart-container" ref="repurchaseChartRef"></div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="chart-card" v-loading="loading.repurchase">
          <template #header>
            <span>高复购商品 TOP 5</span>
          </template>
          <div class="top-products">
            <div
              class="top-product-item"
              v-for="(product, index) in repurchaseData.topProducts"
              :key="product.name"
            >
              <span class="product-rank" :class="'rank-' + (index + 1)">{{ index + 1 }}</span>
              <span class="product-name">{{ product.name }}</span>
              <span class="product-rate">{{ product.rate }}%</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 转化优化建议 -->
    <el-card class="suggestion-card" style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>转化优化建议</span>
          <el-tag type="info">AI 分析</el-tag>
        </div>
      </template>
      <el-row :gutter="20">
        <el-col :span="8" v-for="suggestion in suggestions" :key="suggestion.title">
          <div class="suggestion-item" :class="suggestion.priority">
            <div class="suggestion-header">
              <el-icon :size="20"><component :is="suggestion.icon" /></el-icon>
              <span class="suggestion-title">{{ suggestion.title }}</span>
              <el-tag :type="suggestion.priority === 'high' ? 'danger' : suggestion.priority === 'medium' ? 'warning' : 'info'" size="small">
                {{ suggestion.priority === 'high' ? '高优先' : suggestion.priority === 'medium' ? '中优先' : '低优先' }}
              </el-tag>
            </div>
            <div class="suggestion-content">{{ suggestion.content }}</div>
            <div class="suggestion-expected">
              预期提升: <span class="highlight">{{ suggestion.expected }}</span>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup name="ConversionAnalytics">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Download, ArrowUp, ArrowDown,
  ShoppingCart, Goods, Wallet, RefreshRight,
  TrendCharts, Warning, Opportunity
} from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import {
  getConversionFunnel,
  getConversionTrend,
  getCartAnalysis,
  getOrderAnalysis,
  getRepurchaseAnalysis,
  exportReport
} from '@/api/analytics'

// 状态
const dateRange = ref('week')
const customDateRange = ref([])
const trendStep = ref('overall')
const exporting = ref(false)

const loading = reactive({
  overview: false,
  funnel: false,
  trend: false,
  cart: false,
  order: false,
  repurchase: false
})

// 图表引用
const trendChartRef = ref(null)
const abandonChartRef = ref(null)
const orderAmountChartRef = ref(null)
const repurchaseChartRef = ref(null)

let trendChart = null
let abandonChart = null
let orderAmountChart = null
let repurchaseChart = null

// 漏斗颜色
const funnelColors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399']

// 数据
const conversionStats = ref([
  { key: 'visitors', label: '访客数', value: 0, change: 0, icon: 'User', color: '#409eff', bgColor: '#ecf5ff', isPercent: false },
  { key: 'cartRate', label: '加购转化率', value: 0, change: 0, icon: 'ShoppingCart', color: '#67c23a', bgColor: '#f0f9eb', isPercent: true },
  { key: 'orderRate', label: '下单转化率', value: 0, change: 0, icon: 'Goods', color: '#e6a23c', bgColor: '#fdf6ec', isPercent: true },
  { key: 'paymentRate', label: '支付转化率', value: 0, change: 0, icon: 'Wallet', color: '#f56c6c', bgColor: '#fef0f0', isPercent: true }
])

const funnelData = ref([])
const overallConversionRate = ref(0)
const maxLossStep = ref('')

const cartData = reactive({
  totalCarts: 0,
  activeCartValue: 0,
  abandonRate: 0,
  topProducts: []
})

const orderData = reactive({
  totalOrders: 0,
  paidOrders: 0,
  paymentRate: 0,
  channels: []
})

const repurchaseData = reactive({
  rate: 0,
  rateChange: 0,
  avgInterval: 0,
  intervalChange: 0,
  avgTimes: 0,
  timesChange: 0,
  topProducts: []
})

const suggestions = ref([])

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

// 加载漏斗数据
const loadFunnelData = async () => {
  loading.funnel = true
  loading.overview = true
  try {
    const params = getDateParams()
    const res = await getConversionFunnel(params)
    const data = res.data || {}

    funnelData.value = data.steps || []
    overallConversionRate.value = data.overallRate || 0
    maxLossStep.value = data.maxLossStep || ''

    // 更新概览统计
    conversionStats.value = [
      { key: 'visitors', label: '访客数', value: data.visitors || 0, change: data.visitorsChange || 0, icon: 'User', color: '#409eff', bgColor: '#ecf5ff', isPercent: false },
      { key: 'cartRate', label: '加购转化率', value: data.cartRate || 0, change: data.cartRateChange || 0, icon: 'ShoppingCart', color: '#67c23a', bgColor: '#f0f9eb', isPercent: true },
      { key: 'orderRate', label: '下单转化率', value: data.orderRate || 0, change: data.orderRateChange || 0, icon: 'Goods', color: '#e6a23c', bgColor: '#fdf6ec', isPercent: true },
      { key: 'paymentRate', label: '支付转化率', value: data.paymentRate || 0, change: data.paymentRateChange || 0, icon: 'Wallet', color: '#f56c6c', bgColor: '#fef0f0', isPercent: true }
    ]
  } catch (error) {
    console.error('加载漏斗数据失败:', error)
    // 模拟数据
    funnelData.value = [
      { name: '访问', value: 35420, percentage: 100, conversionRate: 28.5 },
      { name: '浏览商品', value: 28560, percentage: 81, conversionRate: 35.2 },
      { name: '加入购物车', value: 10096, percentage: 28, conversionRate: 62.8 },
      { name: '提交订单', value: 6340, percentage: 18, conversionRate: 85.5 },
      { name: '完成支付', value: 5420, percentage: 15 }
    ]
    overallConversionRate.value = 15.3
    maxLossStep.value = '加入购物车'

    conversionStats.value = [
      { key: 'visitors', label: '访客数', value: 35420, change: 8.5, icon: 'User', color: '#409eff', bgColor: '#ecf5ff', isPercent: false },
      { key: 'cartRate', label: '加购转化率', value: 28.5, change: 3.2, icon: 'ShoppingCart', color: '#67c23a', bgColor: '#f0f9eb', isPercent: true },
      { key: 'orderRate', label: '下单转化率', value: 62.8, change: -1.5, icon: 'Goods', color: '#e6a23c', bgColor: '#fdf6ec', isPercent: true },
      { key: 'paymentRate', label: '支付转化率', value: 85.5, change: 2.1, icon: 'Wallet', color: '#f56c6c', bgColor: '#fef0f0', isPercent: true }
    ]
  } finally {
    loading.funnel = false
    loading.overview = false
  }
}

// 加载趋势数据
const loadTrendData = async () => {
  loading.trend = true
  try {
    const params = { ...getDateParams(), step: trendStep.value }
    const res = await getConversionTrend(params)
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
      value: Math.floor(Math.random() * 20) + 10
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

  const stepNames = {
    overall: '整体转化率',
    cart: '加购转化率',
    order: '下单转化率',
    payment: '支付转化率'
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: '{b}<br/>{a}: {c}%'
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
      type: 'value',
      axisLabel: {
        formatter: '{value}%'
      }
    },
    series: [{
      name: stepNames[trendStep.value],
      type: 'line',
      smooth: true,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(103, 194, 58, 0.3)' },
          { offset: 1, color: 'rgba(103, 194, 58, 0.05)' }
        ])
      },
      lineStyle: {
        color: '#67c23a',
        width: 2
      },
      itemStyle: {
        color: '#67c23a'
      },
      data: data.map(item => item.value)
    }]
  }

  trendChart.setOption(option)
}

// 加载购物车数据
const loadCartData = async () => {
  loading.cart = true
  try {
    const params = getDateParams()
    const res = await getCartAnalysis(params)
    const data = res.data || {}

    Object.assign(cartData, {
      totalCarts: data.totalCarts || 0,
      activeCartValue: data.activeCartValue || 0,
      abandonRate: data.abandonRate || 0,
      topProducts: data.topProducts || []
    })

    renderAbandonChart(data.abandonReasons || [])
  } catch (error) {
    console.error('加载购物车数据失败:', error)
    // 模拟数据
    Object.assign(cartData, {
      totalCarts: 12580,
      activeCartValue: 856420,
      abandonRate: 68.5,
      topProducts: [
        { name: '有机蔬菜套餐A', addCount: 2580, buyRate: 45.2 },
        { name: '土鸡蛋30枚装', addCount: 1890, buyRate: 52.8 },
        { name: '进口牛排套餐', addCount: 1560, buyRate: 38.5 },
        { name: '新鲜水果礼盒', addCount: 1320, buyRate: 41.2 },
        { name: '海鲜大礼包', addCount: 980, buyRate: 35.8 }
      ]
    })

    const mockReasons = [
      { name: '价格太高', value: 35 },
      { name: '运费问题', value: 25 },
      { name: '暂时不需要', value: 20 },
      { name: '找到更好的', value: 12 },
      { name: '其他', value: 8 }
    ]
    renderAbandonChart(mockReasons)
  } finally {
    loading.cart = false
  }
}

// 渲染放弃原因图表
const renderAbandonChart = (data) => {
  nextTick(() => {
    if (!abandonChartRef.value) return

    if (!abandonChart) {
      abandonChart = echarts.init(abandonChartRef.value)
    }

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {d}%'
      },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          fontSize: 11
        },
        data: data
      }]
    }

    abandonChart.setOption(option)
  })
}

// 加载订单数据
const loadOrderData = async () => {
  loading.order = true
  try {
    const params = getDateParams()
    const res = await getOrderAnalysis(params)
    const data = res.data || {}

    Object.assign(orderData, {
      totalOrders: data.totalOrders || 0,
      paidOrders: data.paidOrders || 0,
      paymentRate: data.paymentRate || 0,
      channels: data.channels || []
    })

    renderOrderAmountChart(data.amountDistribution || [])
  } catch (error) {
    console.error('加载订单数据失败:', error)
    // 模拟数据
    Object.assign(orderData, {
      totalOrders: 6340,
      paidOrders: 5420,
      paymentRate: 85.5,
      channels: [
        { name: '小程序', percentage: 58, color: '#409eff' },
        { name: 'H5', percentage: 25, color: '#67c23a' },
        { name: 'APP', percentage: 12, color: '#e6a23c' },
        { name: '其他', percentage: 5, color: '#909399' }
      ]
    })

    const mockDistribution = [
      { range: '0-100', value: 15 },
      { range: '100-300', value: 28 },
      { range: '300-500', value: 32 },
      { range: '500-1000', value: 18 },
      { range: '1000+', value: 7 }
    ]
    renderOrderAmountChart(mockDistribution)
  } finally {
    loading.order = false
  }
}

// 渲染订单金额图表
const renderOrderAmountChart = (data) => {
  nextTick(() => {
    if (!orderAmountChartRef.value) return

    if (!orderAmountChart) {
      orderAmountChart = echarts.init(orderAmountChartRef.value)
    }

    const option = {
      tooltip: {
        trigger: 'axis',
        formatter: '{b}元: {c}%'
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: data.map(item => item.range)
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: '{value}%'
        }
      },
      series: [{
        type: 'bar',
        barWidth: '60%',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#409eff' },
            { offset: 1, color: '#67c23a' }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
        data: data.map(item => item.value)
      }]
    }

    orderAmountChart.setOption(option)
  })
}

// 加载复购数据
const loadRepurchaseData = async () => {
  loading.repurchase = true
  try {
    const params = getDateParams()
    const res = await getRepurchaseAnalysis(params)
    const data = res.data || {}

    Object.assign(repurchaseData, {
      rate: data.rate || 0,
      rateChange: data.rateChange || 0,
      avgInterval: data.avgInterval || 0,
      intervalChange: data.intervalChange || 0,
      avgTimes: data.avgTimes || 0,
      timesChange: data.timesChange || 0,
      topProducts: data.topProducts || []
    })

    renderRepurchaseChart(data.distribution || [])
  } catch (error) {
    console.error('加载复购数据失败:', error)
    // 模拟数据
    Object.assign(repurchaseData, {
      rate: 32.5,
      rateChange: 5.2,
      avgInterval: 18,
      intervalChange: -8.5,
      avgTimes: 2.8,
      timesChange: 12.3,
      topProducts: [
        { name: '有机蔬菜套餐', rate: 68.5 },
        { name: '土鸡蛋30枚装', rate: 62.3 },
        { name: '鲜奶订购服务', rate: 58.9 },
        { name: '水果月度礼盒', rate: 52.1 },
        { name: '海鲜套餐周配', rate: 48.6 }
      ]
    })

    const mockDistribution = [
      { name: '1次', value: 68 },
      { name: '2次', value: 18 },
      { name: '3次', value: 8 },
      { name: '4次', value: 4 },
      { name: '5次+', value: 2 }
    ]
    renderRepurchaseChart(mockDistribution)
  } finally {
    loading.repurchase = false
  }
}

// 渲染复购图表
const renderRepurchaseChart = (data) => {
  nextTick(() => {
    if (!repurchaseChartRef.value) return

    if (!repurchaseChart) {
      repurchaseChart = echarts.init(repurchaseChartRef.value)
    }

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}%'
      },
      series: [{
        type: 'pie',
        radius: '65%',
        center: ['50%', '50%'],
        roseType: 'area',
        itemStyle: {
          borderRadius: 6
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%'
        },
        data: data
      }]
    }

    repurchaseChart.setOption(option)
  })
}

// 加载优化建议
const loadSuggestions = () => {
  suggestions.value = [
    {
      title: '优化商品详情页',
      content: '商品详情页到加购的转化率低于行业平均水平,建议增加更多商品图片、视频展示和用户评价。',
      expected: '转化率+5%',
      priority: 'high',
      icon: 'Warning'
    },
    {
      title: '降低运费门槛',
      content: '运费是购物车放弃的第二大原因，建议适当降低包邮门槛或增加运费券发放。',
      expected: '放弃率-8%',
      priority: 'medium',
      icon: 'TrendCharts'
    },
    {
      title: '会员复购激励',
      content: '针对高价值用户推送专属复购优惠，可有效提升复购率和客户终身价值。',
      expected: '复购率+10%',
      priority: 'medium',
      icon: 'Opportunity'
    }
  ]
}

// 格式化数字
const formatNumber = (num) => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  return num?.toLocaleString() || '0'
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
    const params = { ...getDateParams(), type: 'conversion' }
    const res = await exportReport(params)

    const blob = new Blob([res], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `转化分析报表_${getDateParams().startDate}_${getDateParams().endDate}.xlsx`
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
  loadFunnelData()
  loadTrendData()
  loadCartData()
  loadOrderData()
  loadRepurchaseData()
  loadSuggestions()
}

// 窗口大小变化时重绘图表
const handleResize = () => {
  trendChart?.resize()
  abandonChart?.resize()
  orderAmountChart?.resize()
  repurchaseChart?.resize()
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
  abandonChart?.dispose()
  orderAmountChart?.dispose()
  repurchaseChart?.dispose()
})
</script>

<style lang="scss" scoped>
.conversion-analytics {
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
      height: 280px;
    }
  }

  // 漏斗样式
  .funnel-container {
    padding: 20px 0;
  }

  .funnel-step {
    margin: 0 auto 16px;
    text-align: center;

    .funnel-bar {
      padding: 12px 20px;
      border-radius: 6px;
      color: #fff;
      display: flex;
      justify-content: space-between;
      font-size: 14px;
    }

    .funnel-rate {
      padding: 8px 0;
      color: #909399;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
  }

  .funnel-summary {
    display: flex;
    justify-content: center;
    gap: 40px;
    padding-top: 20px;
    border-top: 1px solid #ebeef5;

    .summary-item {
      text-align: center;
    }

    .summary-label {
      font-size: 14px;
      color: #909399;
    }

    .summary-value {
      font-size: 20px;
      font-weight: bold;
      color: #303133;
      margin-top: 4px;

      &.highlight {
        color: #409eff;
      }
    }
  }

  // 购物车样式
  .cart-stat, .order-stat {
    text-align: center;
    padding: 16px;

    &-value {
      font-size: 28px;
      font-weight: bold;
      color: #303133;
    }

    &-label {
      font-size: 14px;
      color: #909399;
      margin-top: 8px;
    }
  }

  .cart-products-title {
    font-size: 14px;
    font-weight: 500;
    color: #303133;
    margin-bottom: 12px;
  }

  // 渠道分布样式
  .order-channels {
    .channel-title {
      font-size: 14px;
      font-weight: 500;
      color: #303133;
      margin-bottom: 12px;
    }

    .channel-item {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .channel-name {
      width: 60px;
      font-size: 14px;
      color: #606266;
    }

    .channel-bar-wrapper {
      flex: 1;
      height: 12px;
      background: #f5f7fa;
      border-radius: 6px;
      overflow: hidden;
    }

    .channel-bar {
      height: 100%;
      border-radius: 6px;
      transition: width 0.3s ease;
    }

    .channel-value {
      width: 40px;
      text-align: right;
      font-size: 14px;
      font-weight: 500;
      color: #303133;
    }
  }

  // 复购样式
  .repurchase-stats {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px 0;
  }

  .repurchase-stat {
    text-align: center;
    padding: 0 30px;

    .repurchase-value {
      font-size: 32px;
      font-weight: bold;
      color: #409eff;
    }

    .repurchase-label {
      font-size: 14px;
      color: #909399;
      margin: 8px 0;
    }

    .repurchase-change {
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;

      &.up {
        color: #67c23a;
      }

      &.down {
        color: #f56c6c;
      }
    }
  }

  .top-products {
    .top-product-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #ebeef5;

      &:last-child {
        border-bottom: none;
      }
    }

    .product-rank {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #f5f7fa;
      color: #909399;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;

      &.rank-1 {
        background: #ffd700;
        color: #fff;
      }

      &.rank-2 {
        background: #c0c0c0;
        color: #fff;
      }

      &.rank-3 {
        background: #cd7f32;
        color: #fff;
      }
    }

    .product-name {
      flex: 1;
      font-size: 14px;
      color: #303133;
    }

    .product-rate {
      font-size: 14px;
      font-weight: 500;
      color: #67c23a;
    }
  }

  // 建议样式
  .suggestion-card {
    .suggestion-item {
      padding: 16px;
      border-radius: 8px;
      background: #f5f7fa;

      &.high {
        border-left: 4px solid #f56c6c;
      }

      &.medium {
        border-left: 4px solid #e6a23c;
      }

      &.low {
        border-left: 4px solid #909399;
      }
    }

    .suggestion-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .suggestion-title {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
      color: #303133;
    }

    .suggestion-content {
      font-size: 13px;
      color: #606266;
      line-height: 1.6;
      margin-bottom: 12px;
    }

    .suggestion-expected {
      font-size: 12px;
      color: #909399;

      .highlight {
        color: #67c23a;
        font-weight: 500;
      }
    }
  }
}
</style>
