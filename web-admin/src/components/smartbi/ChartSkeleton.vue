<script setup lang="ts">
/**
 * ChartSkeleton - Skeleton loading placeholder for SmartBI charts/KPIs/AI panels
 * Shows a pulsing shimmer animation while content is being generated.
 *
 * Props:
 *   type: 'chart' (bar chart silhouette), 'kpi' (4 gradient cards), 'ai' (text block with lines)
 */
interface Props {
  type?: 'chart' | 'kpi' | 'ai';
}

withDefaults(defineProps<Props>(), {
  type: 'chart',
});
</script>

<template>
  <!-- Chart skeleton: title bar + bar chart silhouette -->
  <div v-if="type === 'chart'" class="skeleton skeleton--chart">
    <div class="skeleton__title-bar shimmer"></div>
    <div class="skeleton__chart-area">
      <div class="skeleton__bars">
        <div class="skeleton__bar shimmer" style="height: 55%"></div>
        <div class="skeleton__bar shimmer" style="height: 80%"></div>
        <div class="skeleton__bar shimmer" style="height: 40%"></div>
        <div class="skeleton__bar shimmer" style="height: 95%"></div>
        <div class="skeleton__bar shimmer" style="height: 65%"></div>
        <div class="skeleton__bar shimmer" style="height: 50%"></div>
        <div class="skeleton__bar shimmer" style="height: 72%"></div>
      </div>
      <div class="skeleton__x-axis shimmer"></div>
    </div>
  </div>

  <!-- KPI skeleton: 4 small gradient cards in a row -->
  <div v-else-if="type === 'kpi'" class="skeleton skeleton--kpi">
    <div v-for="i in 4" :key="i" class="skeleton__kpi-card">
      <div class="skeleton__kpi-label shimmer"></div>
      <div class="skeleton__kpi-value shimmer"></div>
      <div class="skeleton__kpi-sub shimmer"></div>
    </div>
  </div>

  <!-- AI text skeleton: heading + paragraph lines -->
  <div v-else-if="type === 'ai'" class="skeleton skeleton--ai">
    <div class="skeleton__ai-heading shimmer"></div>
    <div class="skeleton__ai-lines">
      <div class="skeleton__ai-line shimmer" style="width: 100%"></div>
      <div class="skeleton__ai-line shimmer" style="width: 92%"></div>
      <div class="skeleton__ai-line shimmer" style="width: 85%"></div>
      <div class="skeleton__ai-line shimmer" style="width: 96%"></div>
      <div class="skeleton__ai-line shimmer" style="width: 60%"></div>
    </div>
    <div class="skeleton__ai-gap"></div>
    <div class="skeleton__ai-lines">
      <div class="skeleton__ai-line shimmer" style="width: 100%"></div>
      <div class="skeleton__ai-line shimmer" style="width: 88%"></div>
      <div class="skeleton__ai-line shimmer" style="width: 75%"></div>
    </div>
  </div>
</template>

<style scoped>
/* Shimmer animation */
@keyframes shimmer {
  0% {
    background-position: -400px 0;
  }
  100% {
    background-position: 400px 0;
  }
}

.shimmer {
  background: linear-gradient(
    90deg,
    #f0f2f5 25%,
    #e8eaed 37%,
    #f0f2f5 63%
  );
  background-size: 800px 100%;
  animation: shimmer 1.6s ease-in-out infinite;
  border-radius: 4px;
}

/* ==================== Chart Skeleton ==================== */
.skeleton--chart {
  padding: 20px;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.skeleton__title-bar {
  width: 140px;
  height: 16px;
  margin-bottom: 20px;
  border-radius: 4px;
}

.skeleton__chart-area {
  height: 280px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.skeleton__bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 0 16px;
}

.skeleton__bar {
  flex: 1;
  min-width: 0;
  border-radius: 4px 4px 0 0;
}

.skeleton__x-axis {
  height: 8px;
  margin-top: 12px;
  border-radius: 4px;
}

/* ==================== KPI Skeleton ==================== */
.skeleton--kpi {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.skeleton__kpi-card {
  padding: 20px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #ebeef5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.skeleton__kpi-label {
  width: 80px;
  height: 12px;
  margin-bottom: 14px;
}

.skeleton__kpi-value {
  width: 120px;
  height: 28px;
  margin-bottom: 10px;
}

.skeleton__kpi-sub {
  width: 100px;
  height: 10px;
}

/* ==================== AI Text Skeleton ==================== */
.skeleton--ai {
  padding: 24px;
  background: #f9fafc;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.skeleton__ai-heading {
  width: 180px;
  height: 18px;
  margin-bottom: 20px;
  border-radius: 4px;
}

.skeleton__ai-lines {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton__ai-line {
  height: 12px;
  border-radius: 4px;
}

.skeleton__ai-gap {
  height: 16px;
}
</style>
