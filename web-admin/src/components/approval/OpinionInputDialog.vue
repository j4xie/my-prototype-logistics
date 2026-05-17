<script setup lang="ts">
/**
 * 审批意见输入弹框 — Sprint 4 W2 Chat J (C-OPINION-1).
 *
 * 实现 .claude/rules/fool-proof-design.md 的 **R3 (自由文本改约束选择)** 和
 * **R2 (上下文必带身份信息)**:
 *
 *  - R3: 主因素 = enum dropdown (常用语模板 + "其他"), 选 "其他" 才显 textarea.
 *        其他 template 选中后 直接提交 template.content, 无 textarea step.
 *  - R2: 支持 contextLine prop, 展示被审批对象的身份信息 (品名 / 单号 / 责任人).
 *
 * Graceful fallback: 无模板时 (新工厂或 fetch 失败) 自动 fallback 为 pure textarea
 * + 顶部提示 "暂无可用模板, 请输入意见 (建议平台管理员配置模板)".
 *
 * Usage:
 *   <OpinionInputDialog
 *     v-model:visible="rejectDialogVisible"
 *     title="驳回报工"
 *     :context-line="`${row.reporterName} - ${row.processCategory} (${row.reportDate})`"
 *     :factory-id="factoryId"
 *     decision-type="CUSTOM"
 *     other-placeholder="请输入驳回原因"
 *     confirm-text="驳回"
 *     @confirm="handleRejectConfirm"
 *   />
 */
import { computed, ref, watch } from 'vue'
import {
  ElDialog,
  ElInput,
  ElButton,
  ElSelect,
  ElOption,
  ElOptionGroup,
  ElAlert,
  ElMessage,
} from 'element-plus'
import { listAvailable, type DecisionType, type OpinionTemplate } from '@/api/opinionTemplate'

interface Props {
  visible: boolean
  /** Dialog 标题 (e.g. "驳回报工"). R2 context 走 contextLine prop. */
  title?: string
  /** R2: 上下文身份信息. 显示在 title 下方, 形如 "张三 - 卤猪蹄 200g (SO-001)". */
  contextLine?: string
  factoryId: string
  decisionType: DecisionType
  /** "其他" 模式的 textarea placeholder. */
  otherPlaceholder?: string
  /** 弹框宽度. */
  width?: string
  /** 确定按钮文案. */
  confirmText?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '请输入意见',
  contextLine: '',
  otherPlaceholder: '请输入意见',
  width: '520px',
  confirmText: '确定',
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  /** 提交 opinion 文本 (template.content 或 textarea 输入). */
  confirm: [opinion: string]
  cancel: []
}>()

// "其他" 哨兵 id — 跟真实 UUID 不会冲突.
const OTHER_SENTINEL = '__OTHER__'

const templates = ref<OpinionTemplate[]>([])
const loading = ref(false)
const fetchError = ref(false)

// User 选择: 模板 id 或 OTHER_SENTINEL
const selectedId = ref<string>('')
// "其他" 模式的自由输入
const otherText = ref('')
const submitting = ref(false)

const systemPresets = computed(() => templates.value.filter((t) => t.factoryId === null))
const factoryCustom = computed(() => templates.value.filter((t) => t.factoryId !== null))
const noTemplates = computed(() => templates.value.length === 0)
const isOther = computed(() => selectedId.value === OTHER_SENTINEL)

const selectedTemplate = computed(() =>
  templates.value.find((t) => t.id === selectedId.value),
)

const canConfirm = computed(() => {
  if (noTemplates.value) {
    // fallback 纯 textarea 模式
    return otherText.value.trim().length > 0
  }
  if (!selectedId.value) return false
  if (isOther.value) return otherText.value.trim().length > 0
  return true // 选了模板, 直接提交其 content
})

async function loadTemplates() {
  if (!props.factoryId || !props.decisionType) return
  loading.value = true
  fetchError.value = false
  try {
    const res = await listAvailable(props.factoryId, props.decisionType)
    templates.value = res.success && res.data ? res.data : []
  } catch (e) {
    console.error('[OpinionInputDialog] loadTemplates failed', e)
    templates.value = []
    fetchError.value = true
  } finally {
    loading.value = false
  }
}

function handleConfirm() {
  if (!canConfirm.value) {
    ElMessage.warning(isOther.value || noTemplates.value ? '请输入意见' : '请选择常用语')
    return
  }
  submitting.value = true
  try {
    const opinion = noTemplates.value || isOther.value
      ? otherText.value.trim()
      : (selectedTemplate.value?.content ?? '').trim()
    emit('confirm', opinion)
    emit('update:visible', false)
  } finally {
    submitting.value = false
  }
}

function handleCancel() {
  emit('cancel')
  emit('update:visible', false)
}

// 弹框打开时拉模板 + 重置 state
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      selectedId.value = ''
      otherText.value = ''
      fetchError.value = false
      loadTemplates()
    }
  },
  { immediate: true },
)
</script>

<template>
  <ElDialog
    :model-value="visible"
    :title="title"
    :width="width"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    align-center
    @update:model-value="(v: boolean) => emit('update:visible', v)"
    @close="handleCancel"
  >
    <!-- R2: 上下文身份信息 (品名 / 单号 / 责任人) -->
    <div v-if="contextLine" class="context-line">{{ contextLine }}</div>

    <!-- 无模板 graceful fallback (R3 + R5): 直接 textarea + admin hint -->
    <div v-if="noTemplates && !loading" class="dialog-body">
      <ElAlert
        v-if="!fetchError"
        type="info"
        :closable="false"
        title="暂无可用模板"
        description="请输入意见. 建议平台管理员配置常用语模板, 减少打字."
      />
      <ElAlert
        v-else
        type="warning"
        :closable="false"
        title="加载模板失败"
        description="网络异常, 请输入意见. 模板下次进入再试."
      />
      <ElInput
        v-model="otherText"
        type="textarea"
        :rows="4"
        :maxlength="500"
        show-word-limit
        :placeholder="otherPlaceholder"
      />
    </div>

    <!-- R3 主路径: 必选 dropdown + "其他" reveals textarea -->
    <div v-else class="dialog-body">
      <ElSelect
        v-model="selectedId"
        placeholder="请选择常用语 (必选)"
        clearable
        filterable
        :loading="loading"
        style="width: 100%"
      >
        <ElOptionGroup v-if="systemPresets.length > 0" label="系统预设">
          <ElOption
            v-for="t in systemPresets"
            :key="t.id"
            :label="t.content"
            :value="t.id"
          />
        </ElOptionGroup>
        <ElOptionGroup v-if="factoryCustom.length > 0" label="工厂自定义">
          <ElOption
            v-for="t in factoryCustom"
            :key="t.id"
            :label="t.content"
            :value="t.id"
          />
        </ElOptionGroup>
        <ElOption :value="OTHER_SENTINEL" label="其他 (自定义输入)" />
      </ElSelect>

      <!-- 仅 "其他" 选中后 reveals textarea (R3 strict pattern) -->
      <ElInput
        v-if="isOther"
        v-model="otherText"
        type="textarea"
        :rows="4"
        :maxlength="500"
        show-word-limit
        :placeholder="otherPlaceholder"
        class="other-textarea"
      />
    </div>

    <template #footer>
      <ElButton @click="handleCancel">取消</ElButton>
      <ElButton type="primary" :disabled="!canConfirm" :loading="submitting" @click="handleConfirm">
        {{ confirmText }}
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.context-line {
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--el-color-info);
  background: var(--el-fill-color-light);
  border-left: 3px solid var(--el-color-primary);
  border-radius: 4px;
}
.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.other-textarea {
  animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
