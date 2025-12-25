<!--
  Dashboard - 仪表盘概览
  食品溯源电商平台管理后台首页
-->
<template>
  <div class="dashboard-container">
    <!-- 欢迎信息 -->
    <div class="welcome-section">
      <div class="welcome-text">
        <h2>欢迎回来，{{ username }}</h2>
        <p>{{ currentDate }} · 今天也要加油工作哦！</p>
      </div>
      <div class="quick-actions">
        <el-button type="primary" @click="goToOrders">
          <el-icon><ShoppingCart /></el-icon>
          订单管理
        </el-button>
        <el-button @click="goToProducts">
          <el-icon><Goods /></el-icon>
          商品管理
        </el-button>
      </div>
    </div>

    <!-- 核心指标卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="stat-card today-orders">
          <div class="stat-icon">
            <el-icon><Document /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.todayOrders }}</div>
            <div class="stat-label">今日订单</div>
            <div class="stat-change" :class="stats.orderChange >= 0 ? 'up' : 'down'">
              <el-icon v-if="stats.orderChange >= 0"><Top /></el-icon>
              <el-icon v-else><Bottom /></el-icon>
              {{ Math.abs(stats.orderChange) }}%
            </div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="stat-card today-sales">
          <div class="stat-icon">
            <el-icon><Money /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">¥{{ formatMoney(stats.todaySales) }}</div>
            <div class="stat-label">今日销售额</div>
            <div class="stat-change" :class="stats.salesChange >= 0 ? 'up' : 'down'">
              <el-icon v-if="stats.salesChange >= 0"><Top /></el-icon>
              <el-icon v-else><Bottom /></el-icon>
              {{ Math.abs(stats.salesChange) }}%
            </div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="stat-card total-users">
          <div class="stat-icon">
            <el-icon><User /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalUsers }}</div>
            <div class="stat-label">注册用户</div>
            <div class="stat-change up">
              <el-icon><Top /></el-icon>
              {{ stats.newUsers }} 新增
            </div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="stat-card total-products">
          <div class="stat-icon">
            <el-icon><Box /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalProducts }}</div>
            <div class="stat-label">在售商品</div>
            <div class="stat-change">
              <span class="text-muted">{{ stats.lowStock }} 库存不足</span>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 图表和列表区域 -->
    <el-row :gutter="20" class="charts-row">
      <!-- 销售趋势图 -->
      <el-col :xs="24" :lg="16">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>销售趋势</span>
              <el-radio-group v-model="trendPeriod" size="small" @change="loadTrendData">
                <el-radio-button label="week">近7天</el-radio-button>
                <el-radio-button label="month">近30天</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div class="chart-container" ref="trendChartRef"></div>
        </el-card>
      </el-col>

      <!-- 订单状态分布 -->
      <el-col :xs="24" :lg="8">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>订单状态分布</span>
            </div>
          </template>
          <div class="chart-container" ref="orderPieRef"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 待办事项和最近订单 -->
    <el-row :gutter="20" class="list-row">
      <!-- 待办事项 -->
      <el-col :xs="24" :lg="8">
        <el-card class="todo-card">
          <template #header>
            <div class="card-header">
              <span>待办事项</span>
              <el-badge :value="todoList.length" :max="99" />
            </div>
          </template>
          <div class="todo-list">
            <div v-if="todoList.length === 0" class="empty-state">
              <el-icon><CircleCheck /></el-icon>
              <span>暂无待办事项</span>
            </div>
            <div v-else class="todo-item" v-for="(item, index) in todoList" :key="index" @click="handleTodo(item)">
              <div class="todo-icon" :class="item.type">
                <el-icon v-if="item.type === 'order'"><ShoppingCart /></el-icon>
                <el-icon v-else-if="item.type === 'refund'"><RefreshLeft /></el-icon>
                <el-icon v-else-if="item.type === 'review'"><ChatDotRound /></el-icon>
                <el-icon v-else><Bell /></el-icon>
              </div>
              <div class="todo-content">
                <div class="todo-title">{{ item.title }}</div>
                <div class="todo-desc">{{ item.desc }}</div>
              </div>
              <div class="todo-count">{{ item.count }}</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 最近订单 -->
      <el-col :xs="24" :lg="16">
        <el-card class="orders-card">
          <template #header>
            <div class="card-header">
              <span>最近订单</span>
              <el-button type="primary" link @click="goToOrders">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recentOrders" style="width: 100%" v-loading="ordersLoading">
            <el-table-column prop="orderNo" label="订单号" width="180" />
            <el-table-column prop="goodsName" label="商品" show-overflow-tooltip />
            <el-table-column prop="paymentPrice" label="金额" width="100">
              <template #default="scope">
                <span class="price">¥{{ scope.row.paymentPrice }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="scope">
                <el-tag :type="getStatusType(scope.row.status)" size="small">
                  {{ scope.row.statusDesc }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createTime" label="下单时间" width="160" />
            <el-table-column label="操作" width="80" fixed="right">
              <template #default="scope">
                <el-button type="primary" link size="small" @click="viewOrder(scope.row)">
                  查看
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <!-- 热门商品 -->
    <el-row :gutter="20" class="products-row">
      <el-col :span="24">
        <el-card class="products-card">
          <template #header>
            <div class="card-header">
              <span>热门商品 TOP 5</span>
              <el-button type="primary" link @click="goToProducts">商品管理</el-button>
            </div>
          </template>
          <div class="hot-products">
            <div class="product-item" v-for="(item, index) in hotProducts" :key="index">
              <div class="product-rank" :class="'rank-' + (index + 1)">{{ index + 1 }}</div>
              <el-image :src="item.picUrl" class="product-image" fit="cover">
                <template #error>
                  <div class="image-placeholder">
                    <el-icon><Picture /></el-icon>
                  </div>
                </template>
              </el-image>
              <div class="product-info">
                <div class="product-name">{{ item.name }}</div>
                <div class="product-sales">销量: {{ item.salesCount }}</div>
              </div>
              <div class="product-price">¥{{ item.salesPrice }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="Dashboard">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/modules/user'
import * as echarts from 'echarts'
import {
  getOverview,
  getSalesTrend,
  getTodoList,
  getRecentOrders,
  getHotProducts
} from '@/api/dashboard'

const router = useRouter()
const userStore = useUserStore()

// 用户名
const username = computed(() => userStore.name || '管理员')

// 当前日期
const currentDate = computed(() => {
  const now = new Date()
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]}`
})

// 统计数据
const stats = reactive({
  todayOrders: 0,
  orderChange: 0,
  todaySales: 0,
  salesChange: 0,
  totalUsers: 0,
  newUsers: 0,
  totalProducts: 0,
  lowStock: 0
})

// 图表相关
const trendChartRef = ref(null)
const orderPieRef = ref(null)
const trendPeriod = ref('week')
let trendChart = null
let orderPieChart = null

// 待办事项
const todoList = ref([])

// 最近订单
const recentOrders = ref([])
const ordersLoading = ref(false)

// 热门商品
const hotProducts = ref([])

// 格式化金额
function formatMoney(value) {
  if (!value) return '0'
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 获取订单状态类型
function getStatusType(status) {
  const types = {
    '0': 'warning',  // 待付款
    '1': 'info',     // 待发货
    '2': '',         // 待收货
    '3': 'success',  // 已完成
    '5': 'danger'    // 已取消
  }
  return types[status] || ''
}

// 加载概览数据
async function loadOverview() {
  try {
    const res = await getOverview()
    if (res.code === 200 && res.data) {
      Object.assign(stats, res.data)
    }
  } catch (error) {
    console.error('加载概览数据失败:', error)
    // 使用演示数据
    loadDemoStats()
  }
}

// 演示统计数据
function loadDemoStats() {
  Object.assign(stats, {
    todayOrders: 128,
    orderChange: 12.5,
    todaySales: 28650.80,
    salesChange: 8.3,
    totalUsers: 3256,
    newUsers: 45,
    totalProducts: 186,
    lowStock: 12
  })
}

// 加载趋势数据
async function loadTrendData() {
  try {
    const res = await getSalesTrend({ period: trendPeriod.value })
    if (res.code === 200 && res.data) {
      renderTrendChart(res.data)
    }
  } catch (error) {
    console.error('加载趋势数据失败:', error)
    renderTrendChart(getDemoTrendData())
  }
}

// 演示趋势数据
function getDemoTrendData() {
  const days = trendPeriod.value === 'week' ? 7 : 30
  const dates = []
  const orders = []
  const sales = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    dates.push(`${date.getMonth() + 1}/${date.getDate()}`)
    orders.push(Math.floor(Math.random() * 100) + 50)
    sales.push(Math.floor(Math.random() * 20000) + 10000)
  }

  return { dates, orders, sales }
}

// 渲染趋势图
function renderTrendChart(data) {
  if (!trendChartRef.value) return

  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['订单数', '销售额'],
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.dates,
      axisLine: { lineStyle: { color: '#ddd' } },
      axisLabel: { color: '#666' }
    },
    yAxis: [
      {
        type: 'value',
        name: '订单数',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f0f0f0' } }
      },
      {
        type: 'value',
        name: '销售额(元)',
        axisLine: { show: false },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '订单数',
        type: 'bar',
        data: data.orders,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#667eea' },
            { offset: 1, color: '#764ba2' }
          ])
        },
        barWidth: '40%'
      },
      {
        name: '销售额',
        type: 'line',
        yAxisIndex: 1,
        data: data.sales,
        smooth: true,
        itemStyle: { color: '#f5a623' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(245, 166, 35, 0.3)' },
            { offset: 1, color: 'rgba(245, 166, 35, 0.05)' }
          ])
        }
      }
    ]
  }

  trendChart.setOption(option)
}

// 渲染订单饼图
function renderOrderPie() {
  if (!orderPieRef.value) return

  if (!orderPieChart) {
    orderPieChart = echarts.init(orderPieRef.value)
  }

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      bottom: 0,
      left: 'center'
    },
    series: [
      {
        name: '订单状态',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: [
          { value: 35, name: '待付款', itemStyle: { color: '#e6a23c' } },
          { value: 28, name: '待发货', itemStyle: { color: '#409eff' } },
          { value: 42, name: '待收货', itemStyle: { color: '#67c23a' } },
          { value: 156, name: '已完成', itemStyle: { color: '#909399' } },
          { value: 12, name: '已取消', itemStyle: { color: '#f56c6c' } }
        ]
      }
    ]
  }

  orderPieChart.setOption(option)
}

// 加载待办事项
async function loadTodoList() {
  try {
    const res = await getTodoList()
    if (res.code === 200 && res.data) {
      todoList.value = res.data
    }
  } catch (error) {
    console.error('加载待办事项失败:', error)
    // 演示数据
    todoList.value = [
      { type: 'order', title: '待发货订单', desc: '有订单等待发货处理', count: 15 },
      { type: 'refund', title: '退款申请', desc: '有退款申请待审核', count: 3 },
      { type: 'review', title: '待审核评价', desc: '有用户评价待审核', count: 8 },
      { type: 'stock', title: '库存预警', desc: '部分商品库存不足', count: 5 }
    ]
  }
}

// 加载最近订单
async function loadRecentOrders() {
  ordersLoading.value = true
  try {
    const res = await getRecentOrders({ size: 5 })
    if (res.code === 200 && res.data) {
      recentOrders.value = res.data
    }
  } catch (error) {
    console.error('加载最近订单失败:', error)
    // 演示数据
    recentOrders.value = [
      { orderNo: 'O202401160001', goodsName: '有机蔬菜礼盒', paymentPrice: 198.00, status: '1', statusDesc: '待发货', createTime: '2024-01-16 10:30' },
      { orderNo: 'O202401160002', goodsName: '新鲜水果套装', paymentPrice: 88.50, status: '2', statusDesc: '待收货', createTime: '2024-01-16 09:15' },
      { orderNo: 'O202401150003', goodsName: '农家土鸡蛋', paymentPrice: 45.00, status: '3', statusDesc: '已完成', createTime: '2024-01-15 16:20' },
      { orderNo: 'O202401150004', goodsName: '五常大米10kg', paymentPrice: 128.00, status: '0', statusDesc: '待付款', createTime: '2024-01-15 14:50' },
      { orderNo: 'O202401150005', goodsName: '原生态蜂蜜', paymentPrice: 68.00, status: '3', statusDesc: '已完成', createTime: '2024-01-15 11:30' }
    ]
  } finally {
    ordersLoading.value = false
  }
}

// 加载热门商品
async function loadHotProducts() {
  try {
    const res = await getHotProducts({ size: 5 })
    if (res.code === 200 && res.data) {
      hotProducts.value = res.data
    }
  } catch (error) {
    console.error('加载热门商品失败:', error)
    // 演示数据
    hotProducts.value = [
      { name: '有机蔬菜礼盒', picUrl: '', salesPrice: 198.00, salesCount: 1256 },
      { name: '新鲜水果套装', picUrl: '', salesPrice: 88.50, salesCount: 986 },
      { name: '五常大米10kg', picUrl: '', salesPrice: 128.00, salesCount: 756 },
      { name: '农家土鸡蛋', picUrl: '', salesPrice: 45.00, salesCount: 623 },
      { name: '原生态蜂蜜', picUrl: '', salesPrice: 68.00, salesCount: 512 }
    ]
  }
}

// 处理待办事项点击
function handleTodo(item) {
  switch (item.type) {
    case 'order':
      router.push('/mall/orderinfo')
      break
    case 'refund':
      router.push('/mall/orderinfo')
      break
    case 'review':
      // router.push('/mall/review')
      break
    default:
      break
  }
}

// 查看订单详情
function viewOrder(row) {
  router.push(`/mall/orderinfo?orderNo=${row.orderNo}`)
}

// 跳转到订单管理
function goToOrders() {
  router.push('/mall/orderinfo')
}

// 跳转到商品管理
function goToProducts() {
  router.push('/mall/goodsspu')
}

// 处理窗口大小变化
function handleResize() {
  trendChart?.resize()
  orderPieChart?.resize()
}

onMounted(() => {
  loadOverview()
  loadTrendData()
  loadTodoList()
  loadRecentOrders()
  loadHotProducts()

  // 延迟渲染图表确保容器已就绪
  setTimeout(() => {
    renderOrderPie()
  }, 100)

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  orderPieChart?.dispose()
})
</script>

<style lang="scss" scoped>
.dashboard-container {
  padding: 20px;
  background: #f5f7fa;
  min-height: calc(100vh - 84px);
}

// 欢迎区域
.welcome-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 24px 32px;
  margin-bottom: 20px;
  color: #fff;

  .welcome-text {
    h2 {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 600;
    }
    p {
      margin: 0;
      opacity: 0.9;
    }
  }

  .quick-actions {
    .el-button {
      margin-left: 12px;
    }
  }
}

// 统计卡片
.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);

  .stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16px;

    .el-icon {
      font-size: 28px;
      color: #fff;
    }
  }

  &.today-orders .stat-icon {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  &.today-sales .stat-icon {
    background: linear-gradient(135deg, #f5a623 0%, #f7931e 100%);
  }

  &.total-users .stat-icon {
    background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%);
  }

  &.total-products .stat-icon {
    background: linear-gradient(135deg, #1890ff 0%, #40a9ff 100%);
  }

  .stat-content {
    flex: 1;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: #333;
    line-height: 1.2;
  }

  .stat-label {
    font-size: 14px;
    color: #999;
    margin: 4px 0;
  }

  .stat-change {
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;

    &.up {
      color: #52c41a;
    }

    &.down {
      color: #f5222d;
    }

    .text-muted {
      color: #f5a623;
    }
  }
}

// 图表区域
.charts-row {
  margin-bottom: 20px;
}

.chart-card {
  height: 100%;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .chart-container {
    height: 300px;
  }
}

// 待办事项和订单列表
.list-row {
  margin-bottom: 20px;
}

.todo-card {
  height: 100%;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 0;
    color: #999;

    .el-icon {
      font-size: 48px;
      margin-bottom: 12px;
      color: #52c41a;
    }
  }

  .todo-list {
    .todo-item {
      display: flex;
      align-items: center;
      padding: 16px 0;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
      transition: background 0.3s;

      &:hover {
        background: #fafafa;
        margin: 0 -20px;
        padding-left: 20px;
        padding-right: 20px;
      }

      &:last-child {
        border-bottom: none;
      }

      .todo-icon {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 12px;

        &.order {
          background: #e6f7ff;
          color: #1890ff;
        }

        &.refund {
          background: #fff1f0;
          color: #f5222d;
        }

        &.review {
          background: #f6ffed;
          color: #52c41a;
        }

        &.stock {
          background: #fffbe6;
          color: #faad14;
        }
      }

      .todo-content {
        flex: 1;

        .todo-title {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .todo-desc {
          font-size: 12px;
          color: #999;
          margin-top: 4px;
        }
      }

      .todo-count {
        font-size: 20px;
        font-weight: 600;
        color: #667eea;
      }
    }
  }
}

.orders-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .price {
    color: #f5222d;
    font-weight: 500;
  }
}

// 热门商品
.products-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .hot-products {
    display: flex;
    gap: 20px;
    overflow-x: auto;
    padding: 10px 0;

    .product-item {
      flex: 1;
      min-width: 180px;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
      background: #fafafa;
      border-radius: 12px;
      position: relative;

      .product-rank {
        position: absolute;
        top: 8px;
        left: 8px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        color: #fff;
        background: #999;

        &.rank-1 {
          background: linear-gradient(135deg, #f5a623 0%, #f7931e 100%);
        }

        &.rank-2 {
          background: linear-gradient(135deg, #c0c0c0 0%, #a8a8a8 100%);
        }

        &.rank-3 {
          background: linear-gradient(135deg, #cd7f32 0%, #b87333 100%);
        }
      }

      .product-image {
        width: 100px;
        height: 100px;
        border-radius: 8px;
        margin-bottom: 12px;
        background: #eee;

        .image-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0f0f0;
          color: #ccc;

          .el-icon {
            font-size: 32px;
          }
        }
      }

      .product-info {
        text-align: center;

        .product-name {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 140px;
        }

        .product-sales {
          font-size: 12px;
          color: #999;
        }
      }

      .product-price {
        margin-top: 8px;
        font-size: 16px;
        font-weight: 600;
        color: #f5222d;
      }
    }
  }
}

// 响应式
@media screen and (max-width: 768px) {
  .welcome-section {
    flex-direction: column;
    text-align: center;
    gap: 16px;

    .quick-actions {
      .el-button {
        margin: 0 6px;
      }
    }
  }

  .stat-card {
    margin-bottom: 12px;
  }
}
</style>
