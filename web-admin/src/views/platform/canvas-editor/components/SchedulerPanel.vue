<!-- SchedulerPanel.vue — Canvas Editor 第7个 Tab: 定时任务配置 (Round 4 Fix P1-10) -->
<template>
  <div class="scheduler-panel">
    <div class="panel-header">
      <h3>定时任务配置</h3>
      <el-button type="primary" size="small" @click="showCreateDialog = true">
        新建定时任务
      </el-button>
    </div>

    <el-table :data="schedulerConfigs" v-loading="loading" empty-text="暂无定时任务">
      <el-table-column prop="taskCode" label="任务代码" width="200" />
      <el-table-column prop="description" label="描述" />
      <el-table-column prop="cronExpression" label="Cron 表达式" width="180">
        <template #default="{ row }">
          <code class="cron-expr">{{ row.cronExpression }}</code>
        </template>
      </el-table-column>
      <el-table-column prop="toolOrMethod" label="执行工具" width="200" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-switch v-model="row.enabled" @change="toggleEnabled(row)" size="small" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="editConfig(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Create/Edit Dialog -->
    <el-dialog v-model="showCreateDialog" :title="editMode ? '编辑定时任务' : '新建定时任务'" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="任务代码" required>
          <el-input v-model="form.taskCode" :disabled="editMode" placeholder="如: BATCH_EXPIRE_SCAN" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="任务用途说明" />
        </el-form-item>
        <el-form-item label="Cron 表达式" required>
          <el-input v-model="form.cronExpression" placeholder="如: 0 */30 * * * ? 每30分钟" />
          <div class="cron-hint">格式: 秒 分 时 日 月 周 (年)</div>
        </el-form-item>
        <el-form-item label="执行工具">
          <el-input v-model="form.toolOrMethod" placeholder="工具名称, 如: batch_expire_scan" />
        </el-form-item>
        <el-form-item label="参数 (JSON)">
          <el-input v-model="form.paramsJson" type="textarea" :rows="3" placeholder='{"key": "value"}' />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="saveConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getSchedulerConfigs, setSchedulerConfig } from '@/api/canvasApi'
import type { SchedulerConfig } from '@/types/canvas'

const props = defineProps<{ factoryId: string }>()

const schedulerConfigs = ref<SchedulerConfig[]>([])
const loading = ref(false)
const showCreateDialog = ref(false)
const editMode = ref(false)

const form = ref({
  taskCode: '',
  description: '',
  cronExpression: '0 0 2 * * ?',
  toolOrMethod: '',
  paramsJson: '{}',
  enabled: true,
})

async function loadConfigs() {
  if (!props.factoryId) return
  loading.value = true
  try {
    const res = await getSchedulerConfigs(props.factoryId)
    schedulerConfigs.value = res.data || []
  } catch (e: any) {
    ElMessage.error('加载定时任务失败: ' + (e?.message || 'unknown'))
  } finally {
    loading.value = false
  }
}

function editConfig(config: SchedulerConfig) {
  editMode.value = true
  form.value = {
    taskCode: config.taskCode,
    description: config.description || '',
    cronExpression: config.cronExpression,
    toolOrMethod: config.toolOrMethod || '',
    paramsJson: JSON.stringify(config.params || {}, null, 2),
    enabled: config.enabled,
  }
  showCreateDialog.value = true
}

async function saveConfig() {
  try {
    const params = JSON.parse(form.value.paramsJson || '{}')
    await setSchedulerConfig(props.factoryId, form.value.taskCode, {
      description: form.value.description,
      cronExpression: form.value.cronExpression,
      toolOrMethod: form.value.toolOrMethod,
      params,
      enabled: form.value.enabled,
    })
    ElMessage.success(editMode.value ? '更新成功' : '创建成功')
    showCreateDialog.value = false
    editMode.value = false
    await loadConfigs()
  } catch (e: any) {
    ElMessage.error('保存失败: ' + (e?.message || 'unknown'))
  }
}

async function toggleEnabled(config: SchedulerConfig) {
  try {
    await setSchedulerConfig(props.factoryId, config.taskCode, { enabled: config.enabled })
    ElMessage.success(`${config.taskCode} 已${config.enabled ? '启用' : '禁用'}`)
  } catch (e: any) {
    ElMessage.error('切换失败')
    config.enabled = !config.enabled
  }
}

onMounted(loadConfigs)
</script>

<style scoped>
.scheduler-panel { padding: 16px; }
.panel-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
}
.panel-header h3 { margin: 0; font-size: 16px; }
.cron-expr {
  font-family: 'Courier New', monospace;
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}
.cron-hint { font-size: 11px; color: var(--el-text-color-placeholder); margin-top: 4px; }
</style>
