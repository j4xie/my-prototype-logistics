<!-- SchemaPreview.vue — Live JSON preview of effective config -->
<template>
  <div class="schema-preview">
    <div class="preview-header">
      <h4>配置预览</h4>
      <el-button size="small" @click="refresh">刷新</el-button>
      <el-button size="small" @click="copy">复制 JSON</el-button>
    </div>
    <pre class="json-view"><code>{{ formattedJson }}</code></pre>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useConfigStore } from '@/store/modules/config'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  factoryId: string
  moduleCode?: string
}>()

const configStore = useConfigStore()
const rawConfig = ref<any>(null)

const formattedJson = computed(() =>
  rawConfig.value ? JSON.stringify(rawConfig.value, null, 2) : '// 选择模块查看配置'
)

async function refresh() {
  if (!props.factoryId || !props.moduleCode) return
  rawConfig.value = await configStore.loadEffectiveConfig(props.factoryId, props.moduleCode)
}

function copy() {
  navigator.clipboard.writeText(formattedJson.value)
  ElMessage.success('已复制到剪贴板')
}

watch(() => props.moduleCode, refresh)
onMounted(refresh)
</script>

<style scoped>
.schema-preview { padding: 12px; }
.preview-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.preview-header h4 { flex: 1; margin: 0; font-size: 14px; }
.json-view { background: #1e1e2e; color: #cdd6f4; padding: 12px; border-radius: 8px; font-size: 12px; max-height: 400px; overflow: auto; white-space: pre-wrap; }
</style>
