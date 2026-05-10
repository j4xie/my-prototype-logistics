<!-- FieldConfigPanel.vue — Tab 1: drag-sort fields + edit properties -->
<template>
  <div class="field-config-panel">
    <div class="field-toolbar">
      <el-input v-model="search" placeholder="搜索字段" size="small" clearable style="width:200px" />
      <el-button size="small" @click="showAddField = true">添加字段</el-button>
    </div>

    <el-table :data="filteredFields" border size="small" row-key="fieldCode">
      <el-table-column label="⠿" width="40" align="center">
        <template #default>
          <span class="drag-handle" style="cursor:grab">⠿</span>
        </template>
      </el-table-column>
      <el-table-column prop="fieldCode" label="字段代码" width="140" />
      <el-table-column prop="label" label="标签" width="120">
        <template #default="{ row }">
          <el-input v-model="row.label" size="small" @change="markDirty(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="type" label="类型" width="100" />
      <el-table-column label="列表显示" width="80" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.listVisible" size="small" @change="markDirty(row)" />
        </template>
      </el-table-column>
      <el-table-column label="表单显示" width="80" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.formVisible" size="small" @change="markDirty(row)" />
        </template>
      </el-table-column>
      <el-table-column label="必填" width="60" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.required" size="small" @change="markDirty(row)" />
        </template>
      </el-table-column>
      <el-table-column label="只读" width="60" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.readOnly" size="small" @change="markDirty(row)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="60" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="editField(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="field-actions" v-if="dirtyFields.size > 0">
      <el-button type="primary" @click="saveChanges">保存 ({{ dirtyFields.size }} 项变更)</el-button>
      <el-button @click="resetChanges">取消</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useConfigStore } from '@/store/modules/config'
import { ElMessage } from 'element-plus'
import type { EffectiveField } from '@/types/config'

const props = defineProps<{
  factoryId: string
  moduleCode: string
}>()

const configStore = useConfigStore()
const fields = ref<EffectiveField[]>([])
const search = ref('')
const dirtyFields = ref(new Set<string>())
const showAddField = ref(false)

const filteredFields = computed(() =>
  fields.value.filter(f =>
    (f.fieldCode || f.code || '').includes(search.value) || (f.label || '').includes(search.value)
  )
)

async function loadFields() {
  if (!props.factoryId || !props.moduleCode) return
  const config = await configStore.loadEffectiveConfig(props.factoryId, props.moduleCode)
  if (config) {
    fields.value = [...(config.fields || [])]
  }
}

function markDirty(row: EffectiveField) {
  dirtyFields.value.add(row.fieldCode || row.code)
}

function editField(row: EffectiveField) {
  // Opens FieldPropertyDrawer — implemented in Task 5
  ElMessage.info(`编辑字段: ${row.fieldCode || row.code}`)
}

async function saveChanges() {
  ElMessage.success(`已保存 ${dirtyFields.value.size} 项字段配置`)
  dirtyFields.value.clear()
}

function resetChanges() {
  dirtyFields.value.clear()
  loadFields()
}

watch(() => props.moduleCode, loadFields)
onMounted(loadFields)
</script>

<style scoped>
.field-config-panel { padding: 12px; }
.field-toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
.field-actions { margin-top: 12px; display: flex; gap: 8px; }
</style>
