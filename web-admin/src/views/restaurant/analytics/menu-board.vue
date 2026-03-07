<template>
  <div class="page-wrapper" ref="containerRef">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-button text :icon="ArrowLeft" @click="$router.push('/restaurant/analytics')">返回</el-button>
            <span class="page-title">菜品四象限分析</span>
            <el-tag v-if="data" size="small">{{ data.items.length }} 个菜品</el-tag>
          </div>
          <div class="header-right">
            <el-select v-model="selectedUploadId" placeholder="选择数据源" filterable style="width: 280px" @change="handleSelectUpload">
              <el-option v-for="u in uploads" :key="u.id" :label="`${u.fileName} (${u.rowCount}行)`" :value="u.id" />
            </el-select>
          </div>
        </div>
      </template>

      <div v-if="loading" v-loading="true" style="min-height: 400px" />

      <el-empty v-else-if="!data" description="请选择数据源" />

      <template v-if="data && !loading">
        <!-- Summary cards -->
        <el-row :gutter="16" class="summary-row">
          <el-col :xs="12" :sm="6" v-for="q in quadrants" :key="q.key">
            <div class="quadrant-card" :style="{ borderLeftColor: q.color }">
              <div class="q-name">{{ q.label }}</div>
              <div class="q-count">{{ q.count }} 个</div>
              <div class="q-desc">{{ q.desc }}</div>
            </div>
          </el-col>
        </el-row>

        <!-- Scatter chart -->
        <el-card shadow="hover" style="margin-top: 16px">
          <div id="chart-quadrant-full" style="height: 480px" />
        </el-card>

        <!-- Filter + table -->
        <el-card shadow="hover" style="margin-top: 16px">
          <div class="filter-bar">
            <el-radio-group v-model="filterQuadrant">
              <el-radio-button label="">全部</el-radio-button>
              <el-radio-button label="Star">明星</el-radio-button>
              <el-radio-button label="Plow">耕牛</el-radio-button>
              <el-radio-button label="Puzzle">谜题</el-radio-button>
              <el-radio-button label="Dog">瘦狗</el-radio-button>
            </el-radio-group>
            <el-input v-model="searchKeyword" placeholder="搜索菜品名" clearable style="width: 200px" />
          </div>

          <el-table :data="paginatedItems" stripe border style="width: 100%; margin-top: 12px" max-height="500">
            <el-table-column prop="name" label="菜品名称" min-width="160" show-overflow-tooltip />
            <el-table-column prop="quadrant" label="象限" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="tagType(row.quadrant)" size="small">{{ quadrantLabel(row.quadrant) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="revenue" label="营收(元)" width="120" align="right" sortable>
              <template #default="{ row }">{{ row.revenue.toLocaleString() }}</template>
            </el-table-column>
            <el-table-column prop="quantity" label="销量" width="90" align="right" sortable />
            <el-table-column prop="unitProfit" label="品均收入" width="110" align="right" sortable>
              <template #default="{ row }">¥{{ row.unitProfit.toFixed(1) }}</template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-if="filteredItems.length > pageSize"
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[50, 100, 200]"
            :total="filteredItems.length"
            layout="total, sizes, prev, pager, next"
            style="margin-top: 12px; justify-content: flex-end"
          />
        </el-card>
      </template>
    </el-card>

    <!-- Item detail drawer -->
    <el-drawer v-model="drawerVisible" :title="selectedItem?.name || ''" size="360px">
      <template v-if="selectedItem">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="象限">
            <el-tag :type="tagType(selectedItem.quadrant)">{{ quadrantLabel(selectedItem.quadrant) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="营收">¥{{ selectedItem.revenue.toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="销量">{{ selectedItem.quantity }}</el-descriptions-item>
          <el-descriptions-item label="品均收入">¥{{ selectedItem.unitProfit.toFixed(2) }}</el-descriptions-item>
        </el-descriptions>
        <div class="suggestion-box" style="margin-top: 16px">
          <h4>运营建议</h4>
          <p>{{ getSuggestion(selectedItem.quadrant) }}</p>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { ArrowLeft } from '@element-plus/icons-vue'
import echarts from '@/utils/echarts'
import { useChartResize } from '@/composables/useChartResize'
import { useRestaurantAnalytics } from '@/composables/useRestaurantAnalytics'
import type { MenuQuadrantData, MenuQuadrantItem } from '@/types/restaurant-analytics'

const containerRef = ref<HTMLElement>()
useChartResize(containerRef)

const {
  uploads, selectedUploadId, data, loading,
  handleSelectUpload: _selectUpload,
} = useRestaurantAnalytics<MenuQuadrantData>((result) => result.menuQuadrant)

const filterQuadrant = ref('')
const searchKeyword = ref('')
const drawerVisible = ref(false)
const selectedItem = ref<MenuQuadrantItem | null>(null)

// Re-render chart when data changes
watch(data, (val) => {
  if (val) nextTick(() => setTimeout(renderChart, 300))
})

function handleSelectUpload(id: number) {
  _selectUpload(id)
}

const quadrants = computed(() => {
  if (!data.value) return []
  const s = data.value.summary
  return [
    { key: 'Star', label: '明星菜', count: s.starCount, color: '#67C23A', desc: '高销量 + 高收入' },
    { key: 'Plow', label: '耕牛菜', count: s.plowCount, color: '#E6A23C', desc: '高销量 + 低收入' },
    { key: 'Puzzle', label: '谜题菜', count: s.puzzleCount, color: '#409EFF', desc: '低销量 + 高收入' },
    { key: 'Dog', label: '瘦狗菜', count: s.dogCount, color: '#F56C6C', desc: '低销量 + 低收入' },
  ]
})

const filteredItems = computed(() => {
  if (!data.value) return []
  let items = data.value.items
  if (filterQuadrant.value) items = items.filter(i => i.quadrant === filterQuadrant.value)
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    items = items.filter(i => i.name.toLowerCase().includes(kw))
  }
  return items
})

function tagType(q: string): '' | 'success' | 'warning' | 'info' | 'danger' {
  const map: Record<string, '' | 'success' | 'warning' | 'info' | 'danger'> = { Star: 'success', Plow: 'warning', Puzzle: 'info', Dog: 'danger' }
  return map[q] || ''
}

function quadrantLabel(q: string): string {
  const map: Record<string, string> = { Star: '明星', Plow: '耕牛', Puzzle: '谜题', Dog: '瘦狗' }
  return map[q] || q
}

function getSuggestion(q: string): string {
  const map: Record<string, string> = {
    Star: '明星菜品是核心收入来源，保持品质稳定，适当提价测试弹性，作为招牌菜重点推广。',
    Plow: '耕牛菜品销量高但品均收入低，考虑优化食材成本、调整份量或组合套餐提升单品收入。',
    Puzzle: '谜题菜品品均收入高但销量低，加大推广力度（推荐位/服务员推荐），或调整价格刺激需求。',
    Dog: '瘦狗菜品销量和品均收入均低，考虑优化口味/呈现，或逐步淘汰替换为新品。',
  }
  return map[q] || ''
}

// Pagination for table
const currentPage = ref(1)
const pageSize = ref(50)

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredItems.value.slice(start, start + pageSize.value)
})

function renderChart() {
  const el = document.getElementById('chart-quadrant-full')
  if (!el || !data.value) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)

  const colorMap: Record<string, string> = {
    Star: '#67C23A', Plow: '#E6A23C', Puzzle: '#409EFF', Dog: '#F56C6C',
  }
  const qm = data.value.qtyMedian
  const pm = data.value.profitMedian

  // Clip axes to P95 to prevent outlier compression
  const allProfits = data.value.items.map(i => i.unitProfit).sort((a, b) => a - b)
  const allQtys = data.value.items.map(i => i.quantity).sort((a, b) => a - b)
  const p95Profit = allProfits[Math.floor(allProfits.length * 0.95)] || 100
  const p95Qty = allQtys[Math.floor(allQtys.length * 0.95)] || 100
  const yMax = Math.max(p95Profit * 1.3, pm * 3)
  const xMax = Math.max(p95Qty * 1.3, qm * 3)
  const outlierCount = data.value.items.filter(i => i.unitProfit > yMax || i.quantity > xMax).length

  const series = Object.entries(colorMap).map(([q, color]) => ({
    name: quadrantLabel(q),
    type: 'scatter' as const,
    data: data.value!.items.filter(i => i.quadrant === q).map(i => ({
      value: [Math.min(i.quantity, xMax), Math.min(i.unitProfit, yMax)],
      name: i.name,
      _raw: [i.quantity, i.unitProfit],
    })),
    itemStyle: { color },
    symbolSize: 10,
  }))

  chart.setOption({
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (p: any) => {
        const raw = p.data._raw || p.value
        return `<b>${p.name}</b><br/>销量: ${raw[0]}<br/>品均收入: ¥${raw[1].toFixed(1)}`
      },
    },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    title: outlierCount > 0 ? {
      show: true,
      text: `${outlierCount} 个超范围点已截断`,
      right: 10, top: 5,
      textStyle: { fontSize: 11, color: '#999', fontWeight: 'normal' },
    } : { show: false },
    grid: { left: 60, right: 30, top: 30, bottom: 50 },
    xAxis: {
      name: '销量',
      type: 'value',
      max: xMax,
      splitLine: { show: false },
    },
    yAxis: {
      name: '品均收入 (元)',
      type: 'value',
      max: yMax,
      splitLine: { lineStyle: { type: 'dashed' } },
    },
    series: [
      ...series,
      // Median lines
      {
        type: 'line',
        markLine: {
          silent: true,
          lineStyle: { type: 'dashed', color: '#999' },
          data: [
            { xAxis: qm, label: { formatter: `销量中位数: ${qm.toFixed(0)}` } },
            { yAxis: pm, label: { formatter: `品均收入中位数: ¥${pm.toFixed(1)}` } },
          ],
        },
        data: [],
      },
    ],
  })

  chart.off('click')
  chart.on('click', (params: any) => {
    if (params.componentType === 'series' && params.name) {
      selectedItem.value = data.value!.items.find(i => i.name === params.name) || null
      if (selectedItem.value) drawerVisible.value = true
    }
  })
}

// Reset pagination when filter changes
watch([filterQuadrant, searchKeyword], () => { currentPage.value = 1 })
</script>

<style scoped>
.page-wrapper { padding: 16px; }
.page-card { border-radius: 8px; }
.card-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.header-left { display: flex; align-items: center; gap: 8px; }
.header-right { display: flex; gap: 8px; }
.page-title { font-size: 16px; font-weight: 600; }

.summary-row { margin-top: 8px; }
.quadrant-card {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  border-left: 4px solid;
  padding: 12px 16px;
  margin-bottom: 8px;
}
.q-name { font-weight: 600; font-size: 14px; }
.q-count { font-size: 22px; font-weight: 700; margin: 4px 0; }
.q-desc { font-size: 12px; color: var(--el-text-color-secondary); }

.filter-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }

.suggestion-box {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 12px 16px;
}
.suggestion-box h4 { margin: 0 0 8px; font-size: 14px; }
.suggestion-box p { margin: 0; font-size: 13px; line-height: 1.6; color: var(--el-text-color-regular); }
</style>
