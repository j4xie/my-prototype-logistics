<script setup lang="ts">
// Placeholder: 全局权限矩阵 (L1) — 暂未实现具体 UI.
// router/index.ts:469 引用此路径但实际文件之前不存在, 导致 build 静默失败,
// dist 留旧版本, deploy 上线旧 chunk 不含新 banner. 创建 placeholder 让
// vite/rollup 能解析 dynamic import.
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>全局权限矩阵 (L1)</span>
      </template>
      <el-empty description="功能开发中..." />
    </el-card>
  </div>
</template>

<style scoped>
.page-container { padding: 20px; }
</style>
