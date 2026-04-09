<!-- TriggerChainDesigner.vue — Tab 4: Event→Tool step editor -->
<template>
  <div class="trigger-chain-designer">
    <div v-for="chain in chains" :key="chain.chainCode" class="chain-card">
      <div class="chain-header">
        <el-switch v-model="chain.enabled" @change="saveChain(chain)" />
        <strong>{{ chain.chainCode }}</strong>
        <el-tag size="small" type="info">{{ chain.eventType }}</el-tag>
        <span class="chain-desc">{{ chain.description }}</span>
      </div>

      <div class="step-list">
        <div
          v-for="(step, idx) in chain.steps"
          :key="idx"
          class="step-item"
          draggable="true"
          @dragstart="dragStep = { chain, idx }"
          @dragover.prevent
          @drop="dropStep(chain, idx)"
        >
          <span class="step-order">{{ step.order }}</span>
          <el-switch v-model="step.enabled" size="small" />
          <el-select v-model="step.tool" size="small" filterable style="width:200px">
            <el-option v-for="t in toolNames" :key="t" :label="t" :value="t" />
          </el-select>
          <el-input v-model="step.condition" size="small" placeholder="条件 (always)" style="width:180px" />
          <el-button link type="danger" size="small" @click="removeStep(chain, idx)">删除</el-button>
        </div>
      </div>

      <el-button size="small" @click="addStep(chain)">+ 添加步骤</el-button>
      <el-button size="small" type="primary" @click="saveChain(chain)">保存</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getTriggerChains, setTriggerChain, getToolConfigs } from '@/api/canvasApi'
import { ElMessage } from 'element-plus'
import type { TriggerChain, TriggerStep } from '@/types/canvas'

const props = defineProps<{ factoryId: string }>()

const chains = ref<TriggerChain[]>([])
const toolNames = ref<string[]>([])
const dragStep = ref<{ chain: TriggerChain; idx: number } | null>(null)

async function load() {
  if (!props.factoryId) return
  const [chainRes, toolRes] = await Promise.all([
    getTriggerChains(props.factoryId),
    getToolConfigs(props.factoryId),
  ])
  chains.value = chainRes.data || []
  toolNames.value = (toolRes.data || []).map((t: any) => t.toolName)
}

function addStep(chain: TriggerChain) {
  const maxOrder = chain.steps.reduce((max, s) => Math.max(max, s.order), 0)
  chain.steps.push({ order: maxOrder + 1, tool: '', condition: 'always', enabled: true, params: {} })
}

function removeStep(chain: TriggerChain, idx: number) {
  chain.steps.splice(idx, 1)
}

function dropStep(chain: TriggerChain, targetIdx: number) {
  if (!dragStep.value || dragStep.value.chain !== chain) return
  const [moved] = chain.steps.splice(dragStep.value.idx, 1)
  chain.steps.splice(targetIdx, 0, moved)
  chain.steps.forEach((s, i) => (s.order = i + 1))
  dragStep.value = null
}

async function saveChain(chain: TriggerChain) {
  try {
    await setTriggerChain(props.factoryId, chain.chainCode, chain)
    ElMessage.success(`触发链 ${chain.chainCode} 已保存`)
  } catch {
    ElMessage.error('保存失败')
  }
}

onMounted(load)
</script>

<style scoped>
.trigger-chain-designer { padding: 12px; display: flex; flex-direction: column; gap: 16px; }
.chain-card { border: 1px solid var(--el-border-color); border-radius: 8px; padding: 12px; }
.chain-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.chain-desc { color: #999; font-size: 12px; margin-left: auto; }
.step-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
.step-item { display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: var(--el-fill-color-lighter); border-radius: 4px; }
.step-order { width: 24px; text-align: center; font-weight: bold; color: var(--el-color-primary); }
</style>
