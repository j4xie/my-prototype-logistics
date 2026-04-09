<!-- CanvasHeader.vue — status-aware header with version + actions -->
<template>
  <div class="canvas-header">
    <div class="header-left">
      <span class="header-title">Canvas 配置编辑器</span>
      <el-divider direction="vertical" />
      <span class="header-factory">{{ factoryName }}</span>
      <el-divider direction="vertical" />
      <span class="header-version">{{ versionLabel }}</span>
      <span v-if="dirtyCount > 0" class="header-dirty">· {{ dirtyCount }} 项未保存</span>
    </div>
    <div class="header-actions">
      <!-- DRAFT actions -->
      <template v-if="status === 'DRAFT'">
        <el-button size="small" @click="$emit('save')">💾 保存草稿</el-button>
        <el-button size="small" type="primary" :disabled="dirtyCount > 0" @click="$emit('submit-review')">
          提交审核 →
        </el-button>
      </template>
      <!-- PENDING_REVIEW actions -->
      <template v-if="status === 'PENDING_REVIEW'">
        <el-tag type="warning">等待审核中</el-tag>
        <el-button size="small" type="success" @click="$emit('approve')">通过 ✅</el-button>
        <el-button size="small" type="danger" @click="$emit('reject')">驳回 ❌</el-button>
      </template>
      <!-- APPROVED actions -->
      <template v-if="status === 'APPROVED'">
        <span class="countdown" v-if="countdown">⏰ {{ countdown }}</span>
        <el-button size="small" type="warning" @click="$emit('publish-now')">⚡ 立即发布</el-button>
        <el-button size="small" @click="$emit('cancel-approval')">取消发布</el-button>
      </template>
      <!-- PUBLISHED actions -->
      <template v-if="status === 'PUBLISHED'">
        <el-button size="small" type="primary" @click="$emit('new-draft')">新建草稿</el-button>
        <el-button size="small" @click="$emit('rollback')">回滚</el-button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useCanvasEditor } from '../composables/useCanvasEditor'

const { versionLabel, status, dirtyCount, factoryId } = useCanvasEditor()

defineEmits<{
  save: []
  'submit-review': []
  approve: []
  reject: []
  'publish-now': []
  'cancel-approval': []
  'new-draft': []
  rollback: []
}>()

const factoryName = computed(() => factoryId.value || '未选择工厂')

// Countdown for APPROVED state
const countdown = ref('')
let timer: ReturnType<typeof setInterval> | null = null

function updateCountdown() {
  if (status.value !== 'APPROVED') { countdown.value = ''; return }
  const now = new Date()
  const target = new Date()
  target.setHours(22, 0, 0, 0) // Default publish window 22:00
  if (now >= target) { countdown.value = '发布窗口已开启'; return }
  const diff = target.getTime() - now.getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  countdown.value = `距离发布窗口 ${h}h ${m}m`
}

onMounted(() => { updateCountdown(); timer = setInterval(updateCountdown, 60000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.canvas-header {
  height: 48px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px; border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color); flex-shrink: 0;
}
.header-left { display: flex; align-items: center; gap: 4px; font-size: 13px; }
.header-title { font-weight: bold; }
.header-factory { color: var(--el-color-primary); }
.header-dirty { color: var(--el-color-warning); font-size: 12px; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.countdown { font-size: 12px; color: var(--el-color-warning); }
</style>
