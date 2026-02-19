<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '@/store/modules/app';
import AppSidebar from './AppSidebar.vue';
import AppHeader from './AppHeader.vue';

const appStore = useAppStore();

// Keep SmartBIAnalysis in cache to avoid heavy unmount side effects
const keepAliveViews = ['SmartBIAnalysis'];

const mainStyle = computed(() => ({
  marginLeft: `${appStore.currentSidebarWidth}px`,
  transition: 'margin-left 0.3s'
}));
</script>

<template>
  <div class="app-layout">
    <!-- 侧边栏 -->
    <AppSidebar />

    <!-- 主内容区 -->
    <div class="app-main" :style="mainStyle">
      <!-- 顶部栏 -->
      <AppHeader />

      <!-- 内容区 -->
      <main class="app-content">
        <router-view v-slot="{ Component }">
          <keep-alive :include="keepAliveViews" :max="5">
            <component :is="Component" :key="$route.name" />
          </keep-alive>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.app-layout {
  min-height: 100vh;
  width: 100%;
  background-color: var(--bg-color-page, #F4F6F9);
}

.app-main {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: var(--bg-color-page, #F4F6F9);

  // 确保内容区域正确展示
  > * {
    min-height: 100%;
    width: 100%;
  }
}

// Transition removed — caused blank pages when navigating from heavy components (SmartBIAnalysis)
</style>
