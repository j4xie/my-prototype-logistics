<template>
  <div v-if="!empty" class="data-preview-section">
    <h3><span class="section-badge section-badge--data" aria-hidden="true"></span> 数据预览</h3>
    <el-button @click="$emit('view-data')" type="primary" size="small">
      查看原始数据
    </el-button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  empty: boolean;
}>();

defineEmits<{
  (e: 'view-data'): void;
}>();
</script>
