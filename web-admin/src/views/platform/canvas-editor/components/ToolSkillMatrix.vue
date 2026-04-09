<!-- ToolSkillMatrix.vue — Tab 6: tool/skill enable/disable matrix -->
<template>
  <div class="tool-skill-matrix">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="Tools" name="tools">
        <div class="matrix-toolbar">
          <el-input v-model="toolSearch" placeholder="搜索工具" size="small" style="width:200px" clearable />
          <el-button size="small" @click="batchToggleTools(true)">全部启用</el-button>
          <el-button size="small" @click="batchToggleTools(false)">全部禁用</el-button>
        </div>
        <div class="tool-grid">
          <div v-for="(tools, domain) in groupedTools" :key="domain" class="domain-group">
            <h4 class="domain-title">{{ domain }} ({{ tools.length }})</h4>
            <div class="tool-list">
              <div v-for="tool in tools" :key="tool.toolName" class="tool-item">
                <el-switch v-model="tool.enabled" size="small" @change="toggleTool(tool)" />
                <span class="tool-name">{{ tool.toolName }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="Skills" name="skills">
        <div v-for="skill in skills" :key="skill.skillName" class="skill-item">
          <el-switch v-model="skill.enabled" @change="toggleSkill(skill)" />
          <strong>{{ skill.skillName }}</strong>
          <el-tag size="small">优先级: {{ skill.priority }}</el-tag>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getToolConfigs, setToolConfig, getSkillConfigs, setSkillConfig } from '@/api/canvasApi'
import { ElMessage } from 'element-plus'
import type { ToolConfig, SkillConfig } from '@/types/canvas'

const props = defineProps<{ factoryId: string }>()

const activeTab = ref('tools')
const toolSearch = ref('')
const tools = ref<ToolConfig[]>([])
const skills = ref<SkillConfig[]>([])

const groupedTools = computed(() => {
  const filtered = tools.value.filter(t =>
    t.toolName.includes(toolSearch.value))
  const groups: Record<string, ToolConfig[]> = {}
  for (const t of filtered) {
    const domain = t.toolName.split('_')[0] || 'other'
    ;(groups[domain] ??= []).push(t)
  }
  return groups
})

async function load() {
  if (!props.factoryId) return
  const [toolRes, skillRes] = await Promise.all([
    getToolConfigs(props.factoryId),
    getSkillConfigs(props.factoryId),
  ])
  tools.value = toolRes.data || []
  skills.value = skillRes.data || []
}

async function toggleTool(tool: ToolConfig) {
  await setToolConfig(props.factoryId, tool.toolName, { enabled: tool.enabled })
  ElMessage.success(`${tool.toolName} ${tool.enabled ? '已启用' : '已禁用'}`)
}

async function toggleSkill(skill: SkillConfig) {
  await setSkillConfig(props.factoryId, skill.skillName, { enabled: skill.enabled })
  ElMessage.success(`${skill.skillName} ${skill.enabled ? '已启用' : '已禁用'}`)
}

function batchToggleTools(enabled: boolean) {
  tools.value.forEach(t => { t.enabled = enabled })
  ElMessage.info(`已${enabled ? '启用' : '禁用'}所有工具`)
}

onMounted(load)
</script>

<style scoped>
.tool-skill-matrix { padding: 12px; }
.matrix-toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
.domain-group { margin-bottom: 16px; }
.domain-title { font-size: 13px; color: var(--el-color-primary); margin: 0 0 6px; }
.tool-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px; }
.tool-item { display: flex; align-items: center; gap: 6px; padding: 4px; font-size: 12px; }
.tool-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.skill-item { display: flex; align-items: center; gap: 8px; padding: 8px; border-bottom: 1px solid var(--el-border-color-lighter); }
</style>
