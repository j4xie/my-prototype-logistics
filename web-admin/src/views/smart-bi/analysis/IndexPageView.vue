<template>
  <div class="index-page-view">
    <div class="index-header">
      <el-icon class="index-icon"><Tickets /></el-icon>
      <h2>报表目录</h2>
      <span class="index-count">共 {{ mappings.length }} 个报表</span>
    </div>

    <div class="index-list">
      <div
        v-for="(mapping, idx) in mappings"
        :key="mapping.index"
        class="index-item"
        :class="{ 'is-current': mapping.index === currentSheetIndex }"
        @click="$emit('navigate', mapping.index)"
      >
        <div class="item-number">{{ idx + 1 }}</div>
        <div class="item-content">
          <div class="item-name">{{ mapping.reportName }}</div>
          <div v-if="mapping.sheetName !== mapping.reportName" class="item-sheet">
            Sheet: {{ mapping.sheetName }}
          </div>
          <div v-if="mapping.description" class="item-description">
            <el-icon><InfoFilled /></el-icon>
            {{ mapping.description }}
          </div>
        </div>
        <el-icon class="item-arrow"><ArrowRight /></el-icon>
      </div>
    </div>

    <div class="index-footer">
      <el-icon><Pointer /></el-icon>
      <span>点击报表名称跳转到对应 Sheet</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tickets, InfoFilled, ArrowRight, Pointer } from '@element-plus/icons-vue';

interface IndexSheetMapping {
  index: number;
  reportName: string;
  sheetName: string;
  description?: string;
}

defineProps<{
  mappings: IndexSheetMapping[];
  currentSheetIndex: number;
}>();

defineEmits<{
  (e: 'navigate', index: number): void;
}>();
</script>
