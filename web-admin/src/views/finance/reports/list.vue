<script setup lang="ts">
import { ref } from 'vue';
import { Document } from '@element-plus/icons-vue';

const comingSoon = ref(true);
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>财务报表</span>
        </div>
      </template>

      <el-empty description="功能开发中，敬请期待" :image-size="160">
        <template #image>
          <el-icon :size="80" color="#909399"><Document /></el-icon>
        </template>
        <p style="color: #909399; font-size: 14px;">财务报表模块正在建设中，后续将支持月报、季报、成本分析等报表的自动生成与下载。</p>
      </el-empty>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  padding: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
