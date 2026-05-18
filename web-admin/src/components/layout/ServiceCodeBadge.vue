<script setup lang="ts">
import { computed } from 'vue';
import { ElMessage, ElTooltip } from 'element-plus';
import { useAuthStore } from '@/store/modules/auth';

/**
 * Sprint 4 P3 #89 (C-SERVICE-CODE-1) — 服务代码 footer badge.
 *
 * 在每个页面右下角 (避开 InlineCustomerService 右下圆形按钮, 放左下角)
 * 显示一段唯一"服务代码"字符串, 客户报问题时可一键复制, 工程师
 * 直接还原 build 版本 / 工厂 / 用户 / commit SHA.
 *
 * 防呆 R2 (Context body): tooltip 拆字段标签, 复制时输出整串 + 时间戳.
 * 数据来源:
 *   - version: vite.config.ts `define.__APP_VERSION__` (package.json)
 *   - commit:  vite.config.ts `define.__COMMIT_SHA__` (git rev-parse 或 env VITE_COMMIT_SHA)
 *   - build:   vite.config.ts `define.__BUILD_TIME__` (ISO 8601)
 *   - factory/user: auth store (登录态; 未登录显 "guest").
 */
const authStore = useAuthStore();

const version = __APP_VERSION__;
const commit = __COMMIT_SHA__;
const buildTime = __BUILD_TIME__;

const factoryId = computed(() => authStore.factoryId || 'guest');
const userId = computed(() => {
  const id = authStore.user?.id;
  return id !== undefined && id !== null ? String(id) : 'guest';
});

// 主显示串 — 短, 在 footer 不打扰布局.
const shortCode = computed(
  () => `Cretas v${version} · ${factoryId.value}/${userId.value} · ${commit}`,
);

// 复制全量 — 带 build time + UA, 便于工程师定位.
const fullCode = computed(() =>
  [
    `Cretas SaaS`,
    `version: ${version}`,
    `factoryId: ${factoryId.value}`,
    `userId: ${userId.value}`,
    `commit: ${commit}`,
    `build: ${buildTime}`,
    `ua: ${navigator.userAgent}`,
    `time: ${new Date().toISOString()}`,
  ].join('\n'),
);

async function copyServiceCode() {
  const text = fullCode.value;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // legacy fallback — older browsers / non-HTTPS contexts.
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    ElMessage.success({ message: '服务代码已复制 — 报问题时贴给工程师', duration: 2500 });
  } catch (e) {
    console.error('Failed to copy service code:', e);
    ElMessage.error({ message: '复制失败, 请手动选中文本复制', duration: 3000 });
  }
}
</script>

<template>
  <ElTooltip placement="top-start" :show-after="300" effect="dark">
    <template #content>
      <div class="service-code-tooltip">
        <div><strong>版本</strong>: {{ version }}</div>
        <div><strong>工厂</strong>: {{ factoryId }}</div>
        <div><strong>用户</strong>: {{ userId }}</div>
        <div><strong>commit</strong>: {{ commit }}</div>
        <div><strong>build</strong>: {{ buildTime }}</div>
        <div class="service-code-tooltip__hint">点击复制全量信息 (含 UA + 时间)</div>
      </div>
    </template>
    <button
      class="service-code-badge"
      type="button"
      aria-label="复制服务代码"
      @click="copyServiceCode"
    >
      {{ shortCode }}
    </button>
  </ElTooltip>
</template>

<style lang="scss" scoped>
.service-code-badge {
  position: fixed;
  left: 12px;
  bottom: 8px;
  z-index: 1400; // 比 InlineCustomerService (1500) 低, 避免覆盖
  padding: 2px 8px;
  border: none;
  background: transparent;
  color: var(--el-text-color-secondary, #909399);
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  line-height: 1.4;
  opacity: 0.5;
  cursor: pointer;
  user-select: text;
  border-radius: 4px;
  transition: opacity 0.15s ease, background-color 0.15s ease;

  &:hover {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.05);
  }

  &:focus-visible {
    outline: 2px solid var(--el-color-primary, #409eff);
    outline-offset: 2px;
    opacity: 1;
  }
}

.service-code-tooltip {
  font-size: 12px;
  line-height: 1.6;
  min-width: 220px;

  strong {
    display: inline-block;
    min-width: 56px;
    color: #fff;
  }
}

.service-code-tooltip__hint {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 11px;
  opacity: 0.8;
}

@media (max-width: 768px) {
  .service-code-badge {
    // mobile: 缩到极小, 仅显 commit + factoryId; tooltip 仍可点
    left: 8px;
    bottom: 4px;
    font-size: 10px;
    max-width: calc(100vw - 80px); // 让位给客服按钮
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
