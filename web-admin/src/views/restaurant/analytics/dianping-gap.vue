<template>
  <div class="page-wrapper" ref="containerRef">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-button text :icon="ArrowLeft" @click="$router.push('/restaurant/analytics')">返回</el-button>
            <span class="page-title">经营与平台分析</span>
          </div>
          <div class="header-right">
            <el-select v-model="selectedUploadId" placeholder="选择数据源" filterable style="width: 280px" @change="handleSelectUpload">
              <el-option v-for="u in uploads" :key="u.id" :label="`${u.fileName} (${u.rowCount}行)`" :value="u.id" />
            </el-select>
          </div>
        </div>
      </template>

      <div v-if="loading" v-loading="true" style="min-height: 400px" />
      <el-empty v-else-if="!ops" description="请选择数据源" />

      <template v-if="ops && !loading">
        <!-- ═══ Section 1: 经营数据分析 ═══ -->
        <div class="section-header">
          <h3 class="section-title">经营数据分析</h3>
          <span class="section-subtitle">基于内部 POS / ERP 销售数据</span>
        </div>

        <!-- KPI cards -->
        <el-row :gutter="16">
          <el-col :xs="12" :sm="6">
            <div class="metric-card">
              <div class="metric-label">招牌菜集中度</div>
              <div class="metric-value" :class="ops.signatureConcentration > 25 ? 'success' : 'danger'">
                {{ ops.signatureConcentration.toFixed(1) }}%
              </div>
              <div class="metric-hint">Top 3 菜品占总营收比例 (建议 > 30%)</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="6">
            <div class="metric-card">
              <div class="metric-label">退货率</div>
              <div class="metric-value" :class="ops.returnRate > 3 ? 'danger' : 'success'">{{ ops.returnRate.toFixed(2) }}%</div>
              <div class="metric-hint">退货量/总订单 (建议 < 2%)</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="6">
            <div class="metric-card">
              <div class="metric-label">品均收入</div>
              <div class="metric-value">¥{{ ops.priceVsBenchmark.actual.toFixed(0) }}</div>
              <div class="metric-hint">行业中位数 ¥{{ ops.priceVsBenchmark.benchmarkMedian }}</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="6">
            <div class="metric-card">
              <div class="metric-label">出品稳定性</div>
              <div class="metric-value" :class="ops.consistencyScore > 60 ? 'success' : 'danger'">{{ ops.consistencyScore.toFixed(0) }}/100</div>
              <div class="metric-hint">基于品项营收离散系数</div>
            </div>
          </el-col>
        </el-row>

        <!-- Operations radar -->
        <el-card shadow="hover" style="margin-top: 16px">
          <template #header><div class="chart-title">经营指标雷达</div></template>
          <div id="chart-ops-radar" style="height: 360px" />
        </el-card>

        <!-- Improvement suggestions -->
        <el-card shadow="hover" style="margin-top: 16px">
          <template #header><div class="chart-title">经营改进建议</div></template>
          <div class="suggestions">
            <div v-for="(s, idx) in opsSuggestions" :key="idx" class="suggestion-item">
              <el-tag :type="s.priority === 'high' ? 'danger' : s.priority === 'medium' ? 'warning' : 'info'" size="small">
                {{ s.priority === 'high' ? '高优' : s.priority === 'medium' ? '中优' : '低优' }}
              </el-tag>
              <span class="suggestion-text">{{ s.text }}</span>
            </div>
          </div>
        </el-card>

        <!-- ═══ Section 2: 平台运营分析 ═══ -->
        <el-divider />
        <div class="section-header">
          <h3 class="section-title">平台运营分析</h3>
          <span class="section-subtitle">大众点评 / 美团 上榜准入评估</span>
        </div>

        <template v-if="platform">
          <!-- Platform score overview -->
          <el-row :gutter="16">
            <el-col :xs="24" :sm="8">
              <div class="score-card" :class="platform.score >= 75 ? 'good' : platform.score >= 50 ? 'warning' : 'bad'">
                <div class="score-value">{{ platform.score }}</div>
                <div class="score-label">准入评分</div>
                <div class="score-detail">
                  数据可验证 {{ platform.passCount }}/{{ platform.dataChecks }} 项通过
                </div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="16">
              <el-card shadow="hover" style="height: 100%">
                <template #header><div class="chart-title">必吃榜 / 好评榜 准入检查</div></template>
                <div class="checklist">
                  <div v-for="item in platform.checks" :key="item.key" class="check-item">
                    <el-icon :size="18" :class="checkClass(item.pass)">
                      <component :is="checkIcon(item.pass)" />
                    </el-icon>
                    <div class="check-content">
                      <div class="check-label">
                        {{ item.label }}
                        <el-tag v-if="item.source === 'manual'" size="small" type="info" style="margin-left: 6px">需人工</el-tag>
                      </div>
                      <div class="check-detail">{{ item.detail }}</div>
                    </div>
                  </div>
                </div>
              </el-card>
            </el-col>
          </el-row>

          <!-- Recommended lists -->
          <el-row :gutter="16" style="margin-top: 16px" v-if="platform.recommendedLists && platform.recommendedLists.length > 0">
            <el-col :xs="24">
              <el-card shadow="hover">
                <template #header><div class="chart-title">榜单匹配推荐</div></template>
                <el-table :data="platform.recommendedLists" stripe style="width: 100%">
                  <el-table-column prop="list" label="榜单" width="120" />
                  <el-table-column prop="readiness" label="就绪度" width="90" align="center">
                    <template #default="{ row }">
                      <el-tag :type="row.readiness === '高' ? 'success' : row.readiness === '中' ? 'warning' : 'danger'" size="small">
                        {{ row.readiness }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="action" label="下一步行动" />
                </el-table>
              </el-card>
            </el-col>
          </el-row>

          <!-- Improvement roadmap -->
          <el-card shadow="hover" style="margin-top: 16px" v-if="platform.improvementRoadmap && platform.improvementRoadmap.length > 0">
            <template #header><div class="chart-title">改进路线图</div></template>
            <div class="roadmap">
              <div v-for="item in platform.improvementRoadmap" :key="item.checkKey" class="roadmap-item">
                <div class="roadmap-header">
                  <el-tag :type="item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'warning' : 'info'" size="small">
                    {{ item.priority === 'high' ? '高优' : item.priority === 'medium' ? '中优' : '低优' }}
                  </el-tag>
                  <span class="roadmap-label">{{ item.label }}</span>
                  <span class="roadmap-timeline">{{ item.timeline }}</span>
                </div>
                <div class="roadmap-action">{{ item.action }}</div>
              </div>
            </div>
          </el-card>

          <!-- Platform suggestions -->
          <el-card shadow="hover" style="margin-top: 16px">
            <template #header><div class="chart-title">平台运营建议</div></template>
            <div class="suggestions">
              <div v-for="(s, idx) in platformSuggestions" :key="idx" class="suggestion-item">
                <el-tag :type="s.priority === 'high' ? 'danger' : s.priority === 'medium' ? 'warning' : 'info'" size="small">
                  {{ s.priority === 'high' ? '高优' : s.priority === 'medium' ? '中优' : '低优' }}
                </el-tag>
                <span class="suggestion-text">{{ s.text }}</span>
              </div>
            </div>
          </el-card>
        </template>

        <!-- ═══ Section 3: 大众点评差距分析 ═══ -->
        <template v-if="gaps">
          <el-divider />
          <div class="section-header">
            <h3 class="section-title">大众点评差距分析</h3>
            <span class="section-subtitle">榜单资格评估 · 行业对标 · 数据缺口</span>
          </div>

          <!-- Overall score + best match -->
          <el-row :gutter="16" style="margin-bottom: 16px">
            <el-col :xs="24" :sm="8">
              <div class="score-card" :class="gaps.overallScore >= 70 ? 'good' : gaps.overallScore >= 50 ? 'warning' : 'bad'">
                <div class="score-value">{{ gaps.overallScore }}</div>
                <div class="score-label">综合上榜潜力</div>
                <div class="score-detail" v-if="gaps.bestListMatch">最有希望: {{ gaps.bestListMatch }}</div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="16">
              <el-card shadow="hover" style="height: 100%">
                <template #header><div class="chart-title">榜单资格评估</div></template>
                <div class="list-eligibility">
                  <div v-for="item in gaps.listEligibility" :key="item.list" class="eligibility-item">
                    <div class="eligibility-header">
                      <span class="eligibility-list">{{ item.list }}</span>
                      <el-tag v-if="item.score !== null" :type="item.score >= 70 ? 'success' : item.score >= 50 ? 'warning' : 'danger'" size="small">
                        {{ item.score }}分
                      </el-tag>
                      <el-tag v-else type="info" size="small">待评估</el-tag>
                    </div>
                    <div class="eligibility-verdict">{{ item.verdict }}</div>
                    <div v-if="item.dataGaps.length > 0" class="eligibility-gaps">
                      <span v-for="(g, i) in item.dataGaps" :key="i" class="gap-tag">{{ g }}</span>
                    </div>
                  </div>
                </div>
              </el-card>
            </el-col>
          </el-row>

          <!-- Benchmark comparison -->
          <el-card shadow="hover" style="margin-bottom: 16px">
            <template #header><div class="chart-title">行业对标</div></template>
            <el-table :data="gaps.benchmarkComparison" stripe style="width: 100%">
              <el-table-column prop="metric" label="指标" width="120" />
              <el-table-column label="实际值" width="100" align="center">
                <template #default="{ row }">{{ row.actual }}{{ row.unit }}</template>
              </el-table-column>
              <el-table-column label="行业中位数" width="110" align="center">
                <template #default="{ row }">{{ row.benchmarkMedian }}{{ row.unit }}</template>
              </el-table-column>
              <el-table-column label="行业区间" width="120" align="center">
                <template #default="{ row }">{{ row.benchmarkRange[0] }}-{{ row.benchmarkRange[1] }}{{ row.unit }}</template>
              </el-table-column>
              <el-table-column label="定位" width="80" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.position === '适中' || row.position === '优秀' ? 'success' : 'warning'" size="small">
                    {{ row.position }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-card>

          <!-- Missing data -->
          <el-card shadow="hover">
            <template #header><div class="chart-title">数据缺口</div></template>
            <div class="missing-data-list">
              <div v-for="item in gaps.missingData" :key="item.field" class="missing-item">
                <el-tag :type="item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'warning' : 'info'" size="small" style="min-width: 32px; text-align: center">
                  {{ item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低' }}
                </el-tag>
                <div class="missing-content">
                  <div class="missing-field">{{ item.field }}</div>
                  <div class="missing-impact">{{ item.impact }}</div>
                </div>
              </div>
            </div>
          </el-card>
        </template>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import { ArrowLeft, CircleCheck, CircleClose, QuestionFilled } from '@element-plus/icons-vue'
import echarts from '@/utils/echarts'
import { useChartResize } from '@/composables/useChartResize'
import { useRestaurantAnalytics } from '@/composables/useRestaurantAnalytics'
import type { OperationsMetrics, PlatformReadiness, DianpingGapData, RestaurantAnalyticsResult } from '@/types/restaurant-analytics'

const containerRef = ref<HTMLElement>()
useChartResize(containerRef)

const {
  uploads, selectedUploadId, data: fullData, loading,
  handleSelectUpload,
} = useRestaurantAnalytics<RestaurantAnalyticsResult>((result) => result)

const ops = computed<OperationsMetrics | null>(() => fullData.value?.operationsMetrics ?? null)
const platform = computed<PlatformReadiness | null>(() => fullData.value?.platformReadiness ?? null)
const gaps = computed<DianpingGapData | null>(() => fullData.value?.dianpingGaps ?? null)

// Re-render chart when data changes
watch(ops, (val) => {
  if (val) nextTick(() => setTimeout(renderOpsRadar, 300))
})

// ── Check helpers ──
function checkClass(pass: boolean | null) {
  if (pass === null) return 'manual'
  return pass ? 'pass' : 'fail'
}

function checkIcon(pass: boolean | null) {
  if (pass === null) return QuestionFilled
  return pass ? CircleCheck : CircleClose
}

// ── Operations suggestions ──
const opsSuggestions = computed(() => {
  if (!ops.value) return []
  const g = ops.value
  const items: Array<{ priority: string; text: string }> = []

  if (g.signatureConcentration < 25) {
    items.push({ priority: 'high', text: '招牌菜集中度不足，建议打造1-2道"必点菜"，通过菜单设计和服务员推荐提升其销量占比至30%+。' })
  }
  if (g.returnRate > 3) {
    items.push({ priority: 'high', text: `退货率 ${g.returnRate.toFixed(1)}% 偏高，排查高退货菜品的出品流程和备料标准，减少退菜投诉。` })
  }
  if (g.consistencyScore < 60) {
    items.push({ priority: 'medium', text: '出品稳定性评分较低，建议标准化核心菜品制作流程，加强厨房品控巡检。' })
  }
  if (g.priceVsBenchmark.actual > g.priceVsBenchmark.benchmarkMedian * 1.3) {
    items.push({ priority: 'medium', text: `品均收入 ¥${g.priceVsBenchmark.actual.toFixed(0)} 高于行业中位数30%+，需确保菜品品质匹配定价。` })
  }
  if (g.priceVsBenchmark.actual > 0 && g.priceVsBenchmark.actual < g.priceVsBenchmark.benchmarkMedian * 0.7) {
    items.push({ priority: 'low', text: `品均收入 ¥${g.priceVsBenchmark.actual.toFixed(0)} 低于行业中位数，有提价空间，可通过提升菜品呈现和套餐组合提升品均收入。` })
  }
  if (items.length === 0) {
    items.push({ priority: 'low', text: '当前各项经营指标表现良好，建议持续监控出品质量和顾客反馈，保持稳定运营。' })
  }
  return items
})

// ── Platform suggestions ──
const platformSuggestions = computed(() => {
  if (!platform.value) return []
  const items: Array<{ priority: string; text: string }> = []
  const checks = platform.value.checks

  const failedData = checks.filter(c => c.source === 'data' && c.pass === false)
  const manualItems = checks.filter(c => c.source === 'manual')

  for (const c of failedData) {
    if (c.key === 'taste_quality') {
      items.push({ priority: 'high', text: '出品稳定性不达标，影响点评好评率。建议标准化制作流程后再申请上榜。' })
    } else if (c.key === 'signature_dish') {
      items.push({ priority: 'high', text: '缺乏明确招牌菜，影响"必吃理由"展示。建议先打造1-2道招牌菜形成口碑。' })
    } else if (c.key === 'return_rate_ok') {
      items.push({ priority: 'high', text: '退货率偏高会影响平台评分。建议先解决退菜问题再申请上榜。' })
    } else if (c.key === 'daily_consumption') {
      items.push({ priority: 'medium', text: '价格偏高可能限制大众点评必吃榜覆盖范围，建议推出引流套餐。' })
    }
  }

  if (manualItems.length > 0) {
    items.push({ priority: 'medium', text: `还有 ${manualItems.length} 项需人工确认（经营时长、刷单检查、食品安全证照），请逐项核实后补充。` })
  }

  if (platform.value.score >= 75 && items.length === 0) {
    items.push({ priority: 'low', text: '数据指标已达标，建议完成人工确认项后提交平台上榜申请。' })
  }

  return items
})

// ── Chart ──
function renderOpsRadar() {
  const el = document.getElementById('chart-ops-radar')
  if (!el || !ops.value) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)
  const g = ops.value

  chart.setOption({
    tooltip: { confine: true },
    radar: {
      indicator: [
        { name: '招牌菜集中度', max: 100 },
        { name: '退货率(反向)', max: 10 },
        { name: '品均收入定位', max: Math.max(g.priceVsBenchmark.actual * 1.5, g.priceVsBenchmark.benchmarkMedian * 2, 200) },
        { name: '出品稳定性', max: 100 },
      ],
      radius: '60%',
      name: { textStyle: { fontSize: 13 } },
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: [
            g.signatureConcentration,
            Math.max(0, 10 - g.returnRate),
            g.priceVsBenchmark.actual,
            g.consistencyScore,
          ],
          name: '当前水平',
          areaStyle: { opacity: 0.25, color: '#409EFF' },
          lineStyle: { color: '#409EFF', width: 2 },
          itemStyle: { color: '#409EFF' },
        },
        {
          value: [30, 8, g.priceVsBenchmark.benchmarkMedian, 70],
          name: '行业基准',
          areaStyle: { opacity: 0.1, color: '#67C23A' },
          lineStyle: { color: '#67C23A', type: 'dashed', width: 1 },
          itemStyle: { color: '#67C23A' },
        },
      ],
    }],
    legend: { bottom: 0, data: ['当前水平', '行业基准'] },
  })
}

// composable handles onMounted + auto-select

onUnmounted(() => {
  const el = document.getElementById('chart-ops-radar')
  if (el) echarts.getInstanceByDom(el)?.dispose()
})
</script>

<style scoped>
.page-wrapper { padding: 16px; }
.page-card { border-radius: 8px; }
.card-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.header-left { display: flex; align-items: center; gap: 8px; }
.header-right { display: flex; gap: 8px; }
.page-title { font-size: 16px; font-weight: 600; }
.chart-title { font-weight: 600; }

.section-header { margin-bottom: 16px; }
.section-title { font-size: 16px; font-weight: 700; margin: 0; color: var(--el-text-color-primary); }
.section-subtitle { font-size: 12px; color: var(--el-text-color-secondary); }

.metric-card {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 14px 16px;
  text-align: center;
}
.metric-label { font-size: 12px; color: var(--el-text-color-secondary); }
.metric-value { font-size: 22px; font-weight: 700; margin: 4px 0; }
.metric-value.success { color: var(--el-color-success); }
.metric-value.danger { color: var(--el-color-danger); }
.metric-hint { font-size: 11px; color: var(--el-text-color-placeholder); }

.score-card {
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.score-card.good { background: linear-gradient(135deg, #f0f9eb, #e1f3d8); }
.score-card.warning { background: linear-gradient(135deg, #fdf6ec, #faecd8); }
.score-card.bad { background: linear-gradient(135deg, #fef0f0, #fde2e2); }
.score-value { font-size: 48px; font-weight: 800; }
.score-card.good .score-value { color: var(--el-color-success); }
.score-card.warning .score-value { color: var(--el-color-warning); }
.score-card.bad .score-value { color: var(--el-color-danger); }
.score-label { font-size: 14px; font-weight: 600; margin-top: 4px; }
.score-detail { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 8px; }

.checklist { display: flex; flex-direction: column; gap: 14px; }
.check-item { display: flex; gap: 10px; align-items: flex-start; }
.check-content { flex: 1; }
.check-label { font-weight: 600; font-size: 13px; display: flex; align-items: center; }
.check-detail { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 2px; }
.pass { color: var(--el-color-success); }
.fail { color: var(--el-color-danger); }
.manual { color: var(--el-color-info); }

.suggestions { display: flex; flex-direction: column; gap: 10px; }
.suggestion-item { display: flex; gap: 8px; align-items: flex-start; }
.suggestion-text { font-size: 13px; line-height: 1.6; }

.roadmap { display: flex; flex-direction: column; gap: 12px; }
.roadmap-item {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 12px 16px;
}
.roadmap-header { display: flex; align-items: center; gap: 8px; }
.roadmap-label { font-weight: 600; font-size: 13px; flex: 1; }
.roadmap-timeline { font-size: 12px; color: var(--el-text-color-secondary); white-space: nowrap; }
.roadmap-action { font-size: 13px; color: var(--el-text-color-regular); margin-top: 6px; line-height: 1.5; }

.list-eligibility { display: flex; flex-direction: column; gap: 12px; }
.eligibility-item {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 10px 14px;
}
.eligibility-header { display: flex; align-items: center; gap: 8px; }
.eligibility-list { font-weight: 600; font-size: 14px; }
.eligibility-verdict { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 4px; }
.eligibility-gaps { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.gap-tag {
  font-size: 11px;
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  padding: 2px 8px;
  border-radius: 4px;
}

.missing-data-list { display: flex; flex-direction: column; gap: 10px; }
.missing-item { display: flex; gap: 10px; align-items: flex-start; }
.missing-content { flex: 1; }
.missing-field { font-weight: 600; font-size: 13px; }
.missing-impact { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 2px; }
</style>
