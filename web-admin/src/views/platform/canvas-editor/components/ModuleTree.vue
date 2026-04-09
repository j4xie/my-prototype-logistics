<!-- ModuleTree.vue — Left panel: module list with drag reorder + enable/disable -->
<template>
  <div class="module-tree">
    <div class="module-tree-header">
      <h4>模块列表</h4>
      <el-input v-model="search" placeholder="搜索模块" size="small" clearable />
    </div>
    <div class="module-list">
      <div
        v-for="mod in enabledModules"
        :key="mod.moduleCode"
        class="module-item"
        :class="{ active: mod.moduleCode === selectedModule }"
        draggable="true"
        @dragstart="onDragStart($event, mod)"
        @dragover.prevent
        @drop="onDrop($event, mod)"
        @click="$emit('select', mod.moduleCode)"
      >
        <span class="drag-handle">⠿</span>
        <span class="module-name">{{ mod.displayName || mod.moduleCode }}</span>
        <el-switch
          v-model="mod.enabled"
          size="small"
          @click.stop
          @change="toggleModule(mod)"
        />
      </div>
      <div style="border-top:1px solid var(--el-border-color-lighter);margin:6px 0"></div><div style="font-size:10px;color:var(--el-text-color-placeholder);margin-bottom:4px">已禁用</div>
      <div
        v-for="mod in disabledModules"
        :key="mod.moduleCode"
        class="module-item"
        :class="{ active: mod.moduleCode === selectedModule }"
        style="opacity:0.4"
        draggable="true"
        @dragstart="onDragStart($event, mod)"
        @dragover.prevent
        @drop="onDrop($event, mod)"
        @click="$emit('select', mod.moduleCode)"
      >
        <span class="drag-handle">⠿</span>
        <span class="module-name">{{ mod.displayName || mod.moduleCode }}</span>
        <el-switch
          v-model="mod.enabled"
          size="small"
          @click.stop
          @change="toggleModule(mod)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getModuleSummaries } from '@/api/configApi'
import { ElMessage } from 'element-plus'

interface ModuleItem {
  moduleCode: string
  displayName: string
  enabled: boolean
  sortOrder: number
}

const props = defineProps<{
  factoryId: string
  selectedModule: string
}>()

defineEmits<{
  select: [moduleCode: string]
}>()

const modules = ref<ModuleItem[]>([])
const search = ref('')
const dragItem = ref<ModuleItem | null>(null)

const filteredModules = computed(() =>
  modules.value.filter(m =>
    m.displayName.includes(search.value) || m.moduleCode.includes(search.value)
  )
)

const enabledModules = computed(() => filteredModules.value.filter(m => m.enabled))
const disabledModules = computed(() => filteredModules.value.filter(m => !m.enabled))

async function loadModules() {
  if (!props.factoryId) return
  try {
    const res = await getModuleSummaries(props.factoryId)
    modules.value = (res.data || []).map((m: any) => ({
      moduleCode: m.moduleCode,
      displayName: m.moduleName || m.moduleCode,
      enabled: m.enabled !== false,
      sortOrder: m.sortOrder || 0,
    }))
  } catch {
    ElMessage.error('加载模块列表失败')
  }
}

function onDragStart(e: DragEvent, mod: ModuleItem) {
  dragItem.value = mod
  e.dataTransfer!.effectAllowed = 'move'
}

function onDrop(_e: DragEvent, target: ModuleItem) {
  if (!dragItem.value || dragItem.value === target) return
  const fromIdx = modules.value.indexOf(dragItem.value)
  const toIdx = modules.value.indexOf(target)
  modules.value.splice(fromIdx, 1)
  modules.value.splice(toIdx, 0, dragItem.value)
  dragItem.value = null
}

function toggleModule(mod: ModuleItem) {
  ElMessage.success(`${mod.displayName} 已${mod.enabled ? '启用' : '禁用'}`)
}

onMounted(loadModules)
</script>

<style scoped>
.module-tree { padding: 12px; }
.module-tree-header { margin-bottom: 12px; }
.module-tree-header h4 { margin: 0 0 8px; font-size: 14px; }
.module-list { display: flex; flex-direction: column; gap: 4px; }
.module-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px; border-radius: 6px; cursor: pointer;
  border: 1px solid transparent; transition: all 0.2s;
}
.module-item:hover { background: var(--el-fill-color-light); }
.module-item.active { background: var(--el-color-primary-light-9); border-color: var(--el-color-primary); }
.drag-handle { cursor: grab; opacity: 0.4; font-size: 12px; }
.module-name { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; }
</style>
