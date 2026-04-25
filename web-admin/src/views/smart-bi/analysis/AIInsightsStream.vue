<template>
  <div v-if="visible" class="ai-analysis-section">
    <!-- 结构化 AI 面板 -->
    <AIInsightPanel
      v-if="structuredInsight"
      :insight="structuredInsight"
      :loading="enriching && !rawAnalysis"
    />

    <!-- 回退：纯文本展示 -->
    <template v-else>
      <h3><span class="section-badge section-badge--ai" aria-hidden="true"></span> AI 智能分析</h3>
      <div v-if="enriching && !rawAnalysis">
        <ChartSkeleton type="ai" />
      </div>
      <el-card v-else shadow="never" class="analysis-card">
        <div class="analysis-content" v-html="formatAnalysis(rawAnalysis)"></div>
      </el-card>
    </template>

    <!-- 缓存状态提示 -->
    <div v-if="cacheHint" class="cache-hint">
      {{ cacheHint }}
    </div>
  </div>
</template>

<script setup lang="ts">
import AIInsightPanel from '@/components/smartbi/AIInsightPanel.vue';
import ChartSkeleton from '@/components/smartbi/ChartSkeleton.vue';
import type { AIInsight } from '@/components/smartbi/AIInsightPanel.vue';

defineProps<{
  visible: boolean;
  enriching: boolean;
  structuredInsight: AIInsight | null;
  rawAnalysis: string;
  cacheHint: string;
  formatAnalysis: (raw: string) => string;
}>();
</script>
