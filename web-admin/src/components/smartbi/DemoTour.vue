<template>
  <el-tour v-model="visible" :mask="{ color: 'rgba(0, 0, 0, 0.45)' }" @close="handleClose">
    <el-tour-step
      v-for="(step, idx) in activeSteps"
      :key="idx"
      :target="step.target?.() || undefined"
      :title="step.title"
      :description="step.description"
      :placement="step.placement || 'bottom'"
    >
      <div class="tour-step-content">
        <div class="tour-step-icon">{{ step.icon }}</div>
        <div class="tour-step-text">
          <p>{{ step.description }}</p>
        </div>
      </div>
    </el-tour-step>
  </el-tour>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';

const TOUR_SHOWN_KEY = 'smartbi-tour-shown';

interface TourTarget {
  /** 返回目标 DOM 元素的函数引用 (使用 CSS 选择器查找) */
  target?: () => HTMLElement | null | undefined;
  title: string;
  description: string;
  icon: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** 是否需要目标元素存在才显示此步 */
  requireTarget?: boolean;
}

const props = defineProps<{
  /** 数据是否已加载完毕 (仅在有数据时启动 tour) */
  dataReady?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const visible = ref(false);
let autoStartTimer: ReturnType<typeof setTimeout> | null = null;
let isMounted = true;

/** 通过 CSS 选择器查找 DOM 元素 */
const q = (selector: string): HTMLElement | null => document.querySelector(selector);

/** 所有可能的步骤定义 — 使用 CSS 选择器动态查找目标 */
const allSteps: TourTarget[] = [
  {
    target: () => q('.header-actions'),
    title: '1/6  数据源选择',
    description: '在这里切换不同的 Excel 报表文件。系统支持多文件管理，您可以随时回顾历史分析结果。',
    icon: '\uD83D\uDCC2',
    placement: 'bottom',
    requireTarget: false,
  },
  {
    target: () => q('.sheet-tabs .el-tabs__header'),
    title: '2/6  报表切换',
    description: '每个标签页对应 Excel 中的一个子表。系统自动识别数据结构，无需手动配置。点击标签即可切换。',
    icon: '\uD83D\uDDC2\uFE0F',
    placement: 'bottom',
    requireTarget: true,
  },
  {
    target: () => q('.kpi-section'),
    title: '3/6  核心指标',
    description: 'AI 自动提取业务关键指标(KPI)，包含环比变化、行业基准对比，帮助您一眼掌握经营全貌。',
    icon: '\uD83D\uDCCA',
    placement: 'bottom',
    requireTarget: true,
  },
  {
    target: () => q('.chart-dashboard') || q('.chart-section'),
    title: '4/6  智能图表',
    description: 'AI 自动推荐最佳图表类型：趋势线、柱状图、饼图、瀑布图等。点击数据点可深入下钻分析。',
    icon: '\uD83D\uDCC8',
    placement: 'top',
    requireTarget: true,
  },
  {
    target: () => q('.ai-analysis-section') || q('.ai-insight-panel'),
    title: '5/6  AI 商业洞察',
    description: '大模型自动生成业务分析报告，包含风险预警、增长机会和改进建议，辅助高管决策。',
    icon: '\uD83E\uDDE0',
    placement: 'top',
    requireTarget: true,
  },
  {
    target: () => q('.header-actions'),
    title: '6/6  高级分析工具',
    description: '综合分析、同比分析、因果分析 — 多维度交叉分析能力，替代传统 BI 工具。随时点击右上角 "?" 重新查看此引导。',
    icon: '\uD83D\uDD0D',
    placement: 'bottom',
    requireTarget: false,
  },
];

/** 过滤掉目标元素不存在的步骤 */
const activeSteps = computed(() => {
  return allSteps.filter(step => {
    if (!step.requireTarget) return true;
    const el = step.target?.();
    return !!el;
  });
});

/** 首次访问自动触发 */
watch(() => props.dataReady, (ready) => {
  if (ready && !localStorage.getItem(TOUR_SHOWN_KEY)) {
    // 清理之前的定时器（防止多次触发）
    if (autoStartTimer) clearTimeout(autoStartTimer);
    // 等待 DOM 完全渲染 (图表需要额外时间)
    autoStartTimer = setTimeout(() => {
      // 确保组件仍然挂载中
      if (!isMounted) return;
      // 至少要有 3 个步骤的目标可见才启动 tour
      if (activeSteps.value.length >= 3) {
        visible.value = true;
      }
    }, 1200);
  }
}, { immediate: true });

/** 关闭 tour 时标记已展示 */
const handleClose = () => {
  localStorage.setItem(TOUR_SHOWN_KEY, new Date().toISOString());
  visible.value = false;
  emit('close');
};

/** 强制清理残留的 tour overlay DOM 元素 */
const cleanupTourOverlay = () => {
  // el-tour renders mask and popover at body level; force-remove stale elements
  document.querySelectorAll('.el-tour-mask, .el-tour-content, .el-tour').forEach(el => {
    // Only remove if the tour is supposed to be closed
    if (!visible.value) {
      el.remove();
    }
  });
};

/** 外部调用: 重新触发 tour */
const startTour = () => {
  visible.value = true;
};

/** 组件卸载时强制关闭 tour 并清理残留 DOM */
onBeforeUnmount(() => {
  isMounted = false;
  if (autoStartTimer) {
    clearTimeout(autoStartTimer);
    autoStartTimer = null;
  }
  if (visible.value) {
    visible.value = false;
    // 延迟清理残留的 overlay DOM，等 Vue 响应式更新完毕
    setTimeout(() => {
      cleanupTourOverlay();
    }, 100);
  }
});

defineExpose({ startTour });
</script>

<style scoped>
.tour-step-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 4px 0;
}

.tour-step-icon {
  font-size: 28px;
  line-height: 1;
  flex-shrink: 0;
}

.tour-step-text p {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #4b5563;
}
</style>
