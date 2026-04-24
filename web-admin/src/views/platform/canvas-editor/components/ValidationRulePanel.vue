<!-- ValidationRulePanel.vue — Tab 5: rule toggle + severity + condition -->
<template>
  <div class="validation-rule-panel">
    <el-table :data="rules" border size="small">
      <el-table-column label="启用" width="60" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.enabled" @change="saveRule(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="ruleCode" label="规则代码" width="160" />
      <el-table-column prop="operation" label="操作" width="100" />
      <el-table-column label="严重级别" width="100">
        <template #default="{ row }">
          <el-select v-model="row.severity" size="small" @change="saveRule(row)">
            <el-option label="阻止" value="BLOCK" />
            <el-option label="警告" value="WARN" />
            <el-option label="提示" value="INFO" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column prop="condition" label="条件 (SpEL)" min-width="200">
        <template #default="{ row }">
          <el-input v-model="row.condition" size="small" @change="saveRule(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="errorMessage" label="错误消息" min-width="200">
        <template #default="{ row }">
          <el-input v-model="row.errorMessage" size="small" @change="saveRule(row)" />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { getValidationRules, setValidationRule } from '@/api/canvasApi'
import { ElMessage } from 'element-plus'
import type { ValidationRule } from '@/types/canvas'

const props = defineProps<{
  factoryId: string
  moduleCode?: string
}>()

const rules = ref<ValidationRule[]>([])

async function load() {
  if (!props.factoryId) return
  const res = await getValidationRules(props.factoryId, props.moduleCode)
  rules.value = res.data || []
}

async function saveRule(rule: ValidationRule) {
  try {
    await setValidationRule(props.factoryId, rule.ruleCode, rule)
    ElMessage.success(`规则 ${rule.ruleCode} 已保存`)
  } catch (e) {
    // Interceptor shows specific toast; dedupe fallback
    console.error('[失败]', e);
  }
}

watch(() => props.moduleCode, load)
onMounted(load)
</script>

<style scoped>
.validation-rule-panel { padding: 12px; }
</style>
