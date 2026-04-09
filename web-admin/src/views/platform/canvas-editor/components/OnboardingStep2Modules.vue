<!-- OnboardingStep2Modules.vue -->
<template>
  <div>
    <h3>调整模块</h3>
    <p class="step-desc">模板已预选模块，可以根据需要增减。拖拽调整顺序。</p>
    <div class="module-list">
      <div v-for="mod in allModules" :key="mod.code" class="module-row"
        draggable="true" @dragstart="dragStart($event, mod)" @dragover.prevent @drop="drop($event, mod)">
        <span class="drag-grip">⠿</span>
        <el-checkbox v-model="mod.enabled" @change="emitModules">{{ mod.name }}</el-checkbox>
        <el-tag size="small" type="info">{{ mod.category }}</el-tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getModuleSummaries } from '@/api/configApi'

const props = defineProps<{ factoryId: string; modules: string[] }>()
const emit = defineEmits<{ 'update:modules': [codes: string[]] }>()

interface ModuleItem { code: string; name: string; category: string; enabled: boolean }
const allModules = ref<ModuleItem[]>([])
const dragItem = ref<ModuleItem | null>(null)

onMounted(async () => {
  try {
    const res = await getModuleSummaries(props.factoryId)
    allModules.value = (res.data || []).map((m: any) => ({
      code: m.moduleCode, name: m.moduleName || m.moduleCode,
      category: m.moduleCategory || '', enabled: props.modules.includes(m.moduleCode),
    }))
  } catch { /* empty */ }
})

function emitModules() {
  emit('update:modules', allModules.value.filter(m => m.enabled).map(m => m.code))
}

function dragStart(e: DragEvent, mod: ModuleItem) { dragItem.value = mod; e.dataTransfer!.effectAllowed = 'move' }
function drop(_e: DragEvent, target: ModuleItem) {
  if (!dragItem.value || dragItem.value === target) return
  const from = allModules.value.indexOf(dragItem.value)
  const to = allModules.value.indexOf(target)
  allModules.value.splice(from, 1)
  allModules.value.splice(to, 0, dragItem.value)
  dragItem.value = null
}
</script>

<style scoped>
.step-desc { color: var(--el-text-color-secondary); font-size: 13px; margin-bottom: 16px; }
.module-list { display: flex; flex-direction: column; gap: 6px; }
.module-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--el-border-color); border-radius: 6px; }
.drag-grip { cursor: grab; color: var(--el-text-color-placeholder); font-size: 12px; }
</style>
