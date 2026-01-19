<script setup lang="ts">
/**
 * SmartBI 布局容器
 * 作为 SmartBI 模块的根路由组件，包含子路由出口
 */
</script>

<template>
  <div class="smart-bi-layout">
    <router-view />
  </div>
</template>

<style lang="scss" scoped>
.smart-bi-layout {
  min-height: calc(100vh - 144px);
  background: #f5f7fa;
}
</style>
