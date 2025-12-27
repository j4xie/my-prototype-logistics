<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
const batchId = route.params.id;
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>批次详情: {{ batchId }}</span>
      </template>
      <el-empty description="功能开发中..." />
    </el-card>
  </div>
</template>

<style scoped>
.page-container { padding: 20px; }
</style>
