<!-- PublishWindowDialog.vue — time picker for scheduled publish -->
<template>
  <el-dialog title="发布时间窗口设置" model-value width="500px" @close="$emit('close')">
    <el-form label-width="120px">
      <el-form-item label="窗口开始时间">
        <el-time-select v-model="startTime" start="00:00" step="00:30" end="23:30" placeholder="开始" />
      </el-form-item>
      <el-form-item label="窗口结束时间">
        <el-time-select v-model="endTime" start="00:00" step="00:30" end="23:30" placeholder="结束" />
      </el-form-item>
      <el-form-item>
        <el-alert type="info" :closable="false" show-icon>
          审核通过的配置将在每天 {{ startTime }} - {{ endTime }} 之间自动发布。
          Super Admin 可随时点击"立即发布"跳过等待。
        </el-alert>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('close')">取消</el-button>
      <el-button type="primary" @click="save">保存设置</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getPublishWindow, setPublishWindow } from '@/api/canvasApi'
import { ElMessage } from 'element-plus'

const props = defineProps<{ factoryId: string }>()
const emit = defineEmits<{ close: [] }>()

const startTime = ref('22:00')
const endTime = ref('06:00')

onMounted(async () => {
  try {
    const res = await getPublishWindow(props.factoryId)
    if (res.data) {
      startTime.value = `${String(res.data.startHour).padStart(2, '0')}:${String(res.data.startMinute).padStart(2, '0')}`
      endTime.value = `${String(res.data.endHour).padStart(2, '0')}:${String(res.data.endMinute).padStart(2, '0')}`
    }
  } catch { /* use defaults */ }
})

async function save() {
  const [sh, sm] = startTime.value.split(':').map(Number)
  const [eh, em] = endTime.value.split(':').map(Number)
  await setPublishWindow(props.factoryId, { startHour: sh, startMinute: sm, endHour: eh, endMinute: em })
  ElMessage.success('发布窗口已更新')
  emit('close')
}
</script>
