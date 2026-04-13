<!-- VersionHistory.vue — Version list + rollback (Round 4 Fix P2-27) -->
<template>
  <div class="version-history">
    <div class="version-header">
      <h4>版本历史</h4>
      <el-button size="small" @click="loadVersions" :loading="loading">刷新</el-button>
    </div>

    <el-empty v-if="!loading && versions.length === 0" description="暂无版本记录" />

    <el-timeline v-else>
      <el-timeline-item
        v-for="v in versions"
        :key="v.configVersion"
        :type="timelineType(v.status)"
        :timestamp="formatDate(v.createdAt)"
        :hollow="v.status === 'DRAFT'"
      >
        <div class="version-item">
          <div class="version-info">
            <strong>v{{ v.configVersion }}</strong>
            <el-tag :type="tagType(v.status)" size="small">{{ statusLabel(v.status) }}</el-tag>
            <span v-if="v.publishedAt" class="version-meta">
              发布于 {{ formatDate(v.publishedAt) }}
            </span>
            <span v-if="v.reviewNotes" class="version-notes">备注: {{ v.reviewNotes }}</span>
          </div>
          <div class="version-actions">
            <el-button
              v-if="v.status === 'PUBLISHED' && canRollback(v)"
              link size="small" type="primary"
              @click="confirmRollback(v.configVersion)"
            >
              回滚到此版本
            </el-button>
          </div>
        </div>
      </el-timeline-item>
    </el-timeline>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getConfigVersions } from '@/api/canvasApi'
import request from '@/api/request'

interface Version {
  id: number
  factoryId: string
  configVersion: number
  status: string
  publishedAt: string | null
  publishedBy: number | null
  createdAt: string
  reviewNotes: string | null
  rollbackVersion: number | null
}

const props = defineProps<{ factoryId: string }>()

const versions = ref<Version[]>([])
const loading = ref(false)

const currentPublishedVersion = computed(() => {
  const published = versions.value.find(v => v.status === 'PUBLISHED')
  return published?.configVersion
})

async function loadVersions() {
  if (!props.factoryId) return
  loading.value = true
  try {
    // Round 5 PERF-3: backend returns Page shape {content, totalElements, ...}
    const res = await getConfigVersions(props.factoryId)
    versions.value = (res.data?.content || []) as Version[]
  } catch (e: any) {
    ElMessage.error('加载版本历史失败: ' + (e?.message || 'unknown'))
    versions.value = []
  } finally {
    loading.value = false
  }
}

function canRollback(v: Version): boolean {
  // Can rollback to any published version that's not the current one
  return v.configVersion !== currentPublishedVersion.value
}

async function confirmRollback(version: number) {
  const confirm = await ElMessageBox.confirm(
    `确认要回滚到版本 v${version} 吗？\n该版本之后添加的动态字段将被禁用（数据保留）。`,
    '确认回滚',
    { type: 'warning', confirmButtonText: '回滚', cancelButtonText: '取消' }
  ).catch(() => false)
  if (!confirm) return

  try {
    await request.post(`/${props.factoryId}/config/rollback/${version}`)
    ElMessage.success(`已回滚到 v${version}`)
    await loadVersions()
  } catch (e: any) {
    ElMessage.error('回滚失败: ' + (e?.message || 'unknown'))
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: '草稿',
    PENDING_REVIEW: '待审核',
    APPROVED: '已通过',
    PUBLISHED: '已发布',
    REJECTED: '已驳回',
    ARCHIVED: '已归档',
  }
  return map[status] || status
}

function tagType(status: string): 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'PENDING_REVIEW' || status === 'APPROVED') return 'warning'
  if (status === 'REJECTED') return 'danger'
  return 'info'
}

function timelineType(status: string): 'success' | 'warning' | 'primary' | 'info' | 'danger' {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'PENDING_REVIEW') return 'warning'
  if (status === 'DRAFT') return 'primary'
  if (status === 'REJECTED') return 'danger'
  return 'info'
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('zh-CN')
  } catch {
    return iso
  }
}

onMounted(loadVersions)
</script>

<style scoped>
.version-history { padding: 16px; }
.version-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.version-header h4 { margin: 0; font-size: 16px; }
.version-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.version-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.version-meta { font-size: 11px; color: var(--el-text-color-placeholder); }
.version-notes { font-size: 12px; color: var(--el-text-color-regular); font-style: italic; }
.version-actions { flex-shrink: 0; }
</style>
