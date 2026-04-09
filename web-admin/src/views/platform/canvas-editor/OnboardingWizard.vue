<!-- OnboardingWizard.vue -->
<template>
  <div class="onboarding">
    <div class="onboarding-body">
      <!-- Left: Steps + Content -->
      <div class="onboarding-main">
        <el-steps :active="step - 1" finish-status="success" align-center style="margin-bottom:24px">
          <el-step title="选择模板" />
          <el-step title="调整模块" />
          <el-step title="流程确认" />
          <el-step title="审核发布" />
        </el-steps>

        <OnboardingStep1Template v-if="step === 1" :factory-id="factoryId" v-model:selected="state.selectedTemplate" />
        <OnboardingStep2Modules v-else-if="step === 2" :factory-id="factoryId" v-model:modules="state.enabledModules" />
        <OnboardingStep3Workflows v-else-if="step === 3" :factory-id="factoryId" :modules="state.enabledModules" />
        <OnboardingStep4Review v-else-if="step === 4" :factory-id="factoryId" :state="state" />

        <div class="onboarding-nav">
          <el-button v-if="step > 1" @click="step--">上一步</el-button>
          <el-button v-if="step < 4" type="primary" :disabled="!canNext" @click="nextStep">
            下一步 →
          </el-button>
          <el-button v-if="step === 4" type="success" @click="finish">提交发布 🚀</el-button>
        </div>
      </div>

      <!-- Right: AI Panel -->
      <aside class="onboarding-ai">
        <AIChatPanel :factory-id="factoryId" :selected-module="''" @apply-diff="() => {}" />
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCanvasEditor } from './composables/useCanvasEditor'
import { applyTemplate } from '@/api/canvasApi'
import { ElMessage } from 'element-plus'
import type { OnboardingState } from '@/types/canvas'
import AIChatPanel from './components/AIChatPanel.vue'
import OnboardingStep1Template from './components/OnboardingStep1Template.vue'
import OnboardingStep2Modules from './components/OnboardingStep2Modules.vue'
import OnboardingStep3Workflows from './components/OnboardingStep3Workflows.vue'
import OnboardingStep4Review from './components/OnboardingStep4Review.vue'

const emit = defineEmits<{ complete: [] }>()
const { factoryId, isOnboarding } = useCanvasEditor()

const step = ref(1)
const state = ref<OnboardingState>({
  step: 1,
  selectedTemplate: null,
  enabledModules: [],
  workflowsConfirmed: false,
})

const canNext = computed(() => {
  if (step.value === 1) return !!state.value.selectedTemplate
  if (step.value === 2) return state.value.enabledModules.length > 0
  if (step.value === 3) return true // overview confirmation
  return true
})

async function nextStep() {
  if (step.value === 1 && state.value.selectedTemplate) {
    // Apply template
    try {
      await applyTemplate(factoryId.value, state.value.selectedTemplate)
      ElMessage.success(`模板 ${state.value.selectedTemplate} 已应用`)
    } catch (e) { ElMessage.error('模板应用失败') }
  }
  step.value++
}

function finish() {
  isOnboarding.value = false
  emit('complete')
  ElMessage.success('配置已创建，进入编辑器')
}
</script>

<style scoped>
.onboarding { height: calc(100vh - 60px); display: flex; flex-direction: column; }
.onboarding-body { display: flex; flex: 1; overflow: hidden; }
.onboarding-main { flex: 1; padding: 24px; overflow-y: auto; }
.onboarding-ai { width: 300px; border-left: 1px solid var(--el-border-color); flex-shrink: 0; overflow-y: auto; }
.onboarding-nav { display: flex; gap: 8px; justify-content: center; margin-top: 24px; }
</style>
