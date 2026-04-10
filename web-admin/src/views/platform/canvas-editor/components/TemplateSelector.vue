<!-- TemplateSelector.vue — Industry template selection + apply -->
<template>
  <div class="template-selector">
    <h4>行业模板</h4>
    <div class="template-grid">
      <div
        v-for="tpl in templates"
        :key="tpl.templateCode"
        class="template-card"
        :class="{ selected: selected === tpl.templateCode }"
        @click="selected = tpl.templateCode"
      >
        <div class="tpl-name">{{ tpl.templateName }}</div>
        <div class="tpl-industry">{{ tpl.industry }}</div>
        <div class="tpl-desc">{{ tpl.description }}</div>
        <div class="tpl-modules">
          {{ JSON.parse(tpl.moduleConfigs || '{}').enabledModules?.length || 0 }} 个模块
        </div>
      </div>
    </div>
    <el-button
      type="primary"
      :disabled="!selected"
      @click="apply"
      style="margin-top:12px"
    >
      应用模板: {{ selected || '未选择' }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getTemplates, applyTemplate } from '@/api/canvasApi'
import { ElMessage, ElMessageBox } from 'element-plus'

const props = defineProps<{ factoryId: string }>()
const emit = defineEmits<{ applied: [] }>()

const templates = ref<any[]>([])
const selected = ref('')

async function load() {
  const res = await getTemplates(props.factoryId)
  templates.value = (res as any)?.data || []
}

async function apply() {
  await ElMessageBox.confirm(
    `确定将模板 "${selected.value}" 应用到当前工厂？这会覆盖现有模块配置。`,
    '应用模板'
  )
  await applyTemplate(props.factoryId, selected.value)
  ElMessage.success('模板已应用')
  emit('applied')
}

onMounted(load)
</script>

<style scoped>
.template-selector { padding: 12px; }
.template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.template-card { border: 2px solid var(--el-border-color); border-radius: 8px; padding: 12px; cursor: pointer; transition: all 0.2s; }
.template-card:hover { border-color: var(--el-color-primary-light-3); }
.template-card.selected { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.tpl-name { font-weight: bold; font-size: 14px; }
.tpl-industry { color: var(--el-color-primary); font-size: 12px; }
.tpl-desc { font-size: 12px; color: #999; margin: 6px 0; }
.tpl-modules { font-size: 11px; color: #666; }
</style>
