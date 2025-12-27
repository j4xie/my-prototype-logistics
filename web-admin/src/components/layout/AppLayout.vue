<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '@/store/modules/app';
import AppSidebar from './AppSidebar.vue';
import AppHeader from './AppHeader.vue';

const appStore = useAppStore();

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
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.app-layout {
  min-height: 100vh;
  width: 100%;
  background-color: var(--bg-color-page, #f0f2f5);
}

.app-main {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  background-color: var(--bg-color-page, #f0f2f5);

  // 确保内容区域正确展示
  > * {
    height: 100%;
    width: 100%;
  }
}

// 过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
