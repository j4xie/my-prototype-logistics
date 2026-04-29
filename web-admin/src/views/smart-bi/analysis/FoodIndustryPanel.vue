<template>
  <el-collapse v-if="visible" class="food-industry-panel">
    <el-collapse-item>
      <template #title>
        <div class="food-industry-header">
          <el-tag type="success" size="small" effect="dark" style="margin-right: 8px;">
            食品行业
          </el-tag>
          <span>食品行业标准参考</span>
          <el-tag v-if="detection.confidence > 0.5" type="info" size="small" style="margin-left: 8px;">
            置信度 {{ (detection.confidence * 100).toFixed(0) }}%
          </el-tag>
        </div>
      </template>
      <div class="food-standards-content">
        <div v-if="detection.suggested_standards?.length" class="standards-section">
          <h4>相关食品安全标准</h4>
          <ul>
            <li v-for="std in detection.suggested_standards" :key="std">{{ std }}</li>
          </ul>
        </div>
        <div v-if="detection.suggested_benchmarks?.length" class="benchmarks-section">
          <h4>建议对标指标</h4>
          <el-tag
            v-for="bm in detection.suggested_benchmarks"
            :key="bm"
            size="small"
            type="info"
            style="margin: 2px 4px;"
          >
            {{ bm.replace(/_/g, ' ') }}
          </el-tag>
        </div>
        <div v-if="detection.matched_keywords?.length" class="keywords-section">
          <h4>匹配关键词</h4>
          <el-tag
            v-for="kw in detection.matched_keywords.slice(0, 10)"
            :key="kw"
            size="small"
            style="margin: 2px 4px;"
          >
            {{ kw }}
          </el-tag>
        </div>
      </div>
    </el-collapse-item>
  </el-collapse>
</template>

<script setup lang="ts">
import type { FoodIndustryDetection } from '@/api/smartbi/python-service';

defineProps<{
  visible: boolean;
  detection: FoodIndustryDetection;
}>();
</script>
