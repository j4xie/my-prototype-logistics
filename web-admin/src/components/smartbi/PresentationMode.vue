<script setup lang="ts">
/**
 * PresentationMode - Fullscreen presentation/slideshow for financial dashboard
 * Features: keyboard nav, slide types (cover/chart/conclusion), dark/light theme
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import echarts from '@/utils/echarts';
import { processEChartsOptions } from '@/utils/echarts-fmt';
import type { ChartResult } from '@/api/smartbi/financial-dashboard';

export interface Slide {
  type: 'cover' | 'chart' | 'conclusion';
  chartType?: string;
  title?: string;
}

interface Props {
  visible: boolean;
  slides: Slide[];
  chartResults: ChartResult[];
  companyName?: string;
  period?: string;
}

const props = withDefaults(defineProps<Props>(), {
  companyName: '白垩纪食品',
  period: '',
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const currentIndex = ref(0);
const isDark = ref(false);
const isFullscreen = ref(false);
const chartContainerRef = ref<HTMLDivElement | null>(null);
let chartInstance: ReturnType<typeof echarts.init> | null = null;

const totalSlides = computed(() => props.slides.length);
const currentSlide = computed(() => props.slides[currentIndex.value]);

function currentChartResult(): ChartResult | null {
  if (!currentSlide.value || currentSlide.value.type !== 'chart') return null;
  const chartType = currentSlide.value.chartType;
  return props.chartResults.find(c => c.chartType === chartType) ?? null;
}

function goNext() {
  if (currentIndex.value < totalSlides.value - 1) {
    currentIndex.value++;
  }
}

function goPrev() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  }
}

function goTo(index: number) {
  if (index >= 0 && index < totalSlides.value) {
    currentIndex.value = index;
  }
}

function close() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => { /* ignore */ });
  }
  emit('close');
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    const el = document.getElementById('presentation-overlay');
    if (el) {
      await el.requestFullscreen().catch(() => { /* ignore */ });
      isFullscreen.value = true;
    }
  } else {
    await document.exitFullscreen().catch(() => { /* ignore */ });
    isFullscreen.value = false;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.visible) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
  else if (e.key === 'Escape') close();
  else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
}

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
}

async function renderChart() {
  await nextTick();
  if (!chartContainerRef.value) return;
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
  const result = currentChartResult();
  if (!result || !result.echartsOption || Object.keys(result.echartsOption).length === 0) return;
  // Process __FMT__ placeholders into real JS functions
  const processedOption = processEChartsOptions(result.echartsOption);
  chartInstance = echarts.init(chartContainerRef.value, isDark.value ? 'dark' : undefined);
  chartInstance.setOption(processedOption);
  // Force resize after layout stabilizes
  setTimeout(() => chartInstance?.resize(), 50);
}

// Called after slide transition completes — safe to render chart
async function onSlideEntered() {
  if (currentSlide.value?.type === 'chart') {
    await renderChart();
  }
}

watch(() => props.visible, async (visible) => {
  if (visible) {
    currentIndex.value = 0;
    await nextTick();
    // Focus the overlay for keyboard navigation
    const overlay = document.getElementById('presentation-overlay');
    if (overlay) {
      overlay.setAttribute('tabindex', '-1');
      overlay.focus();
    }
    if (currentSlide.value?.type === 'chart') {
      await renderChart();
    }
  } else {
    chartInstance?.dispose();
    chartInstance = null;
  }
});

watch(currentIndex, () => {
  // Dispose previous chart — new one will render in @after-enter callback
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
});

watch(isDark, async () => {
  if (currentSlide.value?.type === 'chart') {
    await renderChart();
  }
});

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  chartInstance?.dispose();
});

// Cover slide KPIs — pick top 3 KPIs from first chart result
const coverKPIs = computed(() => {
  if (!props.chartResults.length) return [];
  const first = props.chartResults[0];
  return (first.kpis || []).slice(0, 3);
});

// Conclusion slide: aggregate key findings
const conclusionFindings = computed(() => {
  const findings: string[] = [];
  for (const r of props.chartResults) {
    if (r.analysisContext) {
      findings.push(r.analysisContext.slice(0, 80));
    }
  }
  return findings.slice(0, 6);
});

function formatPeriod(period: string | Record<string, unknown> | undefined): string {
  if (!period) return '';
  if (typeof period === 'string') return period;
  return typeof period.label === 'string' ? period.label : JSON.stringify(period);
}

function chartBulletPoints(result: ChartResult | null): string[] {
  if (!result || !result.analysisContext) return [];
  return result.analysisContext
    .split(/[。；\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 5)
    .slice(0, 4);
}

const bgClass = computed(() => isDark.value ? 'theme-dark' : 'theme-light');
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      id="presentation-overlay"
      class="presentation-overlay"
      :class="bgClass"
      role="dialog"
      aria-modal="true"
      aria-label="财务分析演示模式"
    >
      <!-- Top toolbar -->
      <div class="pres-toolbar">
        <span class="slide-counter">{{ currentIndex + 1 }} / {{ totalSlides }}</span>
        <div class="toolbar-actions">
          <el-button size="small" text @click="isDark = !isDark">
            {{ isDark ? '浅色' : '深色' }}
          </el-button>
          <el-button size="small" text @click="toggleFullscreen">
            {{ isFullscreen ? '退出全屏' : '全屏 (F)' }}
          </el-button>
          <el-button size="small" text @click="close">
            关闭 (Esc)
          </el-button>
        </div>
      </div>

      <!-- Slide content -->
      <div class="pres-content">
        <!-- COVER SLIDE -->
        <transition name="slide-fade" mode="out-in" @after-enter="onSlideEntered">
          <div v-if="currentSlide?.type === 'cover'" :key="'cover'" class="slide slide-cover">
            <div class="cover-inner">
              <div class="cover-badge">财务分析报告</div>
              <h1 class="cover-title">{{ companyName }}</h1>
              <p class="cover-period">{{ period || '经营分析看板' }}</p>
              <div v-if="coverKPIs.length" class="cover-kpis">
                <div v-for="kpi in coverKPIs" :key="kpi.label" class="cover-kpi-item">
                  <span class="cover-kpi-value">{{ typeof kpi.value === 'number' ? kpi.value.toFixed(1) : kpi.value }}{{ kpi.unit }}</span>
                  <span class="cover-kpi-label">{{ kpi.label }}</span>
                </div>
              </div>
              <p class="cover-hint">按 → 键翻页 · Esc 关闭 · F 全屏</p>
            </div>
          </div>

          <!-- CHART SLIDE -->
          <div v-else-if="currentSlide?.type === 'chart'" :key="`chart-${currentIndex}`" class="slide slide-chart">
            <div class="chart-slide-header">
              <h2 class="chart-slide-title">{{ currentChartResult()?.title || currentSlide?.title }}</h2>
              <span class="chart-meta">{{ formatPeriod(currentChartResult()?.metadata?.period) }}</span>
            </div>
            <div class="chart-slide-body">
              <div class="chart-slide-main">
                <!-- KPI row -->
                <div v-if="currentChartResult()?.kpis?.length" class="chart-kpi-row">
                  <div
                    v-for="kpi in currentChartResult()!.kpis.slice(0, 4)"
                    :key="kpi.label"
                    class="chart-kpi-chip"
                  >
                    <span class="chip-value">{{ typeof kpi.value === 'number' ? kpi.value.toFixed(1) : kpi.value }}{{ kpi.unit }}</span>
                    <span class="chip-label">{{ kpi.label }}</span>
                  </div>
                </div>
                <!-- ECharts canvas -->
                <div ref="chartContainerRef" class="chart-canvas" />
              </div>
              <!-- Analysis panel -->
              <div class="chart-analysis-panel" v-if="currentChartResult()?.analysisContext">
                <h3 class="analysis-title">AI 分析要点</h3>
                <ul class="analysis-list">
                  <li
                    v-for="(point, i) in chartBulletPoints(currentChartResult())"
                    :key="i"
                    class="analysis-item"
                  >
                    {{ point }}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <!-- CONCLUSION SLIDE -->
          <div v-else-if="currentSlide?.type === 'conclusion'" :key="'conclusion'" class="slide slide-conclusion">
            <div class="conclusion-inner">
              <h2 class="conclusion-title">核心结论</h2>
              <div class="conclusion-grid">
                <div
                  v-for="(finding, i) in conclusionFindings"
                  :key="i"
                  class="conclusion-item"
                >
                  <span class="conclusion-num">{{ String(i + 1).padStart(2, '0') }}</span>
                  <p>{{ finding }}</p>
                </div>
              </div>
              <p class="conclusion-footer">{{ companyName }} · {{ period }}</p>
            </div>
          </div>
        </transition>
      </div>

      <!-- Navigation arrows -->
      <button class="nav-btn nav-prev" :disabled="currentIndex === 0" @click="goPrev">&#8249;</button>
      <button class="nav-btn nav-next" :disabled="currentIndex === totalSlides - 1" @click="goNext">&#8250;</button>

      <!-- Bottom dots -->
      <div class="pres-dots">
        <button
          v-for="(_, i) in slides"
          :key="i"
          class="dot"
          :class="{ active: i === currentIndex }"
          @click="goTo(i)"
          :aria-label="`跳转到第${i + 1}页`"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.presentation-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  user-select: none;
}

.theme-light {
  background: #ffffff;
  color: #303133;
}

.theme-dark {
  background: #1a1a2e;
  color: #e8eaf6;
}

/* Toolbar */
.pres-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
  flex-shrink: 0;
}

.slide-counter {
  font-size: 13px;
  opacity: 0.7;
}

.toolbar-actions {
  display: flex;
  gap: 4px;
}

/* Slide content */
.pres-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  padding: 0 56px;
}

/* Slides */
.slide {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Cover */
.slide-cover .cover-inner {
  text-align: center;
  max-width: 720px;
}

.cover-badge {
  display: inline-block;
  padding: 4px 16px;
  border-radius: 20px;
  background: #1B65A8;
  color: #fff;
  font-size: 13px;
  margin-bottom: 24px;
}

.cover-title {
  font-size: 48px;
  font-weight: 700;
  margin: 0 0 12px;
  color: #1B65A8;
}

.theme-dark .cover-title {
  color: #90caf9;
}

.cover-period {
  font-size: 22px;
  opacity: 0.7;
  margin: 0 0 32px;
}

.cover-kpis {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-bottom: 32px;
}

.cover-kpi-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cover-kpi-value {
  font-size: 32px;
  font-weight: 700;
  color: #1B65A8;
}

.theme-dark .cover-kpi-value {
  color: #90caf9;
}

.cover-kpi-label {
  font-size: 13px;
  opacity: 0.7;
  margin-top: 4px;
}

.cover-hint {
  font-size: 12px;
  opacity: 0.4;
}

/* Chart slide */
.slide-chart {
  flex-direction: column;
  padding: 16px 0;
  align-items: stretch;
}

.chart-slide-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.chart-slide-title {
  font-size: 22px;
  font-weight: 600;
  margin: 0;
}

.chart-meta {
  font-size: 13px;
  opacity: 0.6;
}

.chart-slide-body {
  flex: 1;
  display: flex;
  gap: 16px;
  min-height: 0;
}

.chart-slide-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chart-kpi-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.chart-kpi-chip {
  flex: 1;
  background: rgba(27, 101, 168, 0.08);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.theme-dark .chart-kpi-chip {
  background: rgba(144, 202, 249, 0.1);
}

.chip-value {
  font-size: 20px;
  font-weight: 700;
  color: #1B65A8;
}

.theme-dark .chip-value {
  color: #90caf9;
}

.chip-label {
  font-size: 11px;
  opacity: 0.7;
  margin-top: 2px;
}

.chart-canvas {
  flex: 1;
  min-height: 200px;
}

.chart-analysis-panel {
  width: 220px;
  flex-shrink: 0;
  background: rgba(27, 101, 168, 0.04);
  border-radius: 8px;
  padding: 16px;
  overflow-y: auto;
}

.theme-dark .chart-analysis-panel {
  background: rgba(255, 255, 255, 0.05);
}

.analysis-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px;
  color: #1B65A8;
}

.theme-dark .analysis-title {
  color: #90caf9;
}

.analysis-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.analysis-item {
  font-size: 13px;
  line-height: 1.6;
  padding: 6px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
  opacity: 0.85;
}

.analysis-item::before {
  content: '• ';
  color: #1B65A8;
  font-weight: 700;
}

/* Conclusion */
.slide-conclusion .conclusion-inner {
  width: 100%;
  max-width: 900px;
}

.conclusion-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 24px;
  text-align: center;
}

.conclusion-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.conclusion-item {
  background: rgba(27, 101, 168, 0.06);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.theme-dark .conclusion-item {
  background: rgba(144, 202, 249, 0.08);
}

.conclusion-num {
  font-size: 24px;
  font-weight: 700;
  color: #1B65A8;
  opacity: 0.5;
  flex-shrink: 0;
}

.conclusion-item p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  opacity: 0.85;
}

.conclusion-footer {
  text-align: center;
  font-size: 12px;
  opacity: 0.4;
  margin-top: 24px;
}

/* Navigation */
.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(27, 101, 168, 0.12);
  border: none;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  transition: background 0.2s;
  z-index: 10;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(27, 101, 168, 0.24);
}

.nav-btn:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}

.nav-prev { left: 8px; }
.nav-next { right: 8px; }

/* Dots */
.pres-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 10px 0;
  flex-shrink: 0;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(128, 128, 128, 0.3);
  border: none;
  cursor: pointer;
  padding: 0;
  transition: background 0.2s, transform 0.2s;
}

.dot.active {
  background: #1B65A8;
  transform: scale(1.3);
}

/* Transitions */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>
