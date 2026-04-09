<!-- VersionHistory.vue — Version list + rollback -->
<template>
  <div class="version-history">
    <h4>版本历史</h4>
    <el-timeline>
      <el-timeline-item
        v-for="v in versions"
        :key="v.version"
        :type="v.status === 'PUBLISHED' ? 'success' : 'info'"
        :timestamp="v.createdAt"
      >
        <div class="version-item">
          <strong>v{{ v.version }}</strong>
          <el-tag :type="v.status === 'PUBLISHED' ? 'success' : 'info'" size="small">{{ v.status }}</el-tag>
          <el-button v-if="v.status !== 'PUBLISHED'" link size="small" type="primary" @click="rollback(v.version)">
            回滚
          </el-button>
        </div>
      </el-timeline-item>
    </el-timeline>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{ factoryId: string }>()

const versions = ref<any[]>([
  { version: 1, status: 'PUBLISHED', createdAt: '2026-04-09' },
])

function rollback(version: number) {
  ElMessage.success(`已回滚到 v${version}`)
}

onMounted(() => { /* load from API */ })
</script>

<style scoped>
.version-history { padding: 12px; }
.version-item { display: flex; align-items: center; gap: 8px; }
</style>
