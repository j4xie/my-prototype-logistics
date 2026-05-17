<script setup lang="ts">
import { ref, computed } from 'vue';

/**
 * Sprint 4 W1 C-INLINE-CS-1: 在线客服悬浮入口.
 *
 * 默认折叠为右下角圆形按钮, 点击展开 iframe 嵌入第三方客服系统.
 * iframe URL 从 props 传入 (默认空, 不渲染 iframe 但保留按钮 placeholder).
 * 后续接入实际客服系统 (商务通 / 美洽 / 网易七鱼 等) 时配置 `serviceUrl`.
 */
const props = withDefaults(
  defineProps<{
    serviceUrl?: string;
    title?: string;
  }>(),
  {
    serviceUrl: '',
    title: '在线客服',
  },
);

const expanded = ref(false);

const hasUrl = computed(() => props.serviceUrl.trim().length > 0);

function toggle() {
  expanded.value = !expanded.value;
}
</script>

<template>
  <div class="inline-cs">
    <!-- 展开面板 -->
    <div v-if="expanded" class="inline-cs__panel" role="dialog" :aria-label="title">
      <div class="inline-cs__header">
        <span>{{ title }}</span>
        <button class="inline-cs__close" type="button" @click="toggle" aria-label="关闭客服">
          ×
        </button>
      </div>
      <div class="inline-cs__body">
        <iframe
          v-if="hasUrl"
          :src="serviceUrl"
          :title="title"
          class="inline-cs__iframe"
          frameborder="0"
        />
        <div v-else class="inline-cs__empty">
          客服系统尚未配置, 请联系管理员配置 <code>serviceUrl</code>.
        </div>
      </div>
    </div>

    <!-- 折叠按钮 -->
    <button
      v-show="!expanded"
      class="inline-cs__bubble"
      type="button"
      :aria-label="title"
      :title="title"
      @click="toggle"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
          fill="currentColor"
          fill-opacity="0.15"
        />
      </svg>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.inline-cs {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1500;
}

.inline-cs__bubble {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background-color: var(--el-color-primary, #409eff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: scale(1.06);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.22);
  }
}

.inline-cs__panel {
  width: 380px;
  height: 500px;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.22);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.inline-cs__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--el-color-primary, #409eff);
  color: #fff;
  font-weight: 600;
}

.inline-cs__close {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}

.inline-cs__body {
  flex: 1;
  display: flex;
}

.inline-cs__iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.inline-cs__empty {
  margin: auto;
  padding: 16px;
  color: var(--el-text-color-secondary, #909399);
  font-size: 14px;
  text-align: center;
}

@media (max-width: 768px) {
  .inline-cs {
    right: 12px;
    bottom: 12px;
  }
  .inline-cs__panel {
    width: calc(100vw - 24px);
    height: 70vh;
  }
}
</style>
