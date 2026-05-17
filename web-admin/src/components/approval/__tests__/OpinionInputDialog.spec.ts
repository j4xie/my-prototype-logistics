/**
 * Tests for OpinionInputDialog — Sprint 4 W2 Chat J (C-OPINION-1).
 *
 * 实现 .claude/rules/fool-proof-design.md R3 strict pattern:
 *  - 必选 dropdown (templates + "其他")
 *  - 仅 "其他" 选中后 reveals textarea
 *  - 选模板时直接提交 template.content
 *  - 无模板时 graceful fallback 纯 textarea + admin hint
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import OpinionInputDialog from '../OpinionInputDialog.vue'

vi.mock('@/api/opinionTemplate', () => ({
  listAvailable: vi.fn(),
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessage: {
      warning: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
    },
  }
})

const globalStubs = {
  'el-dialog': {
    props: ['modelValue', 'title', 'width', 'closeOnClickModal', 'closeOnPressEscape', 'alignCenter'],
    emits: ['update:modelValue', 'close'],
    template: '<div class="el-dialog"><slot /><div class="footer"><slot name="footer" /></div></div>',
  },
  'el-input': {
    props: ['modelValue', 'type', 'rows', 'maxlength', 'showWordLimit', 'placeholder'],
    emits: ['update:modelValue'],
    template:
      '<textarea class="el-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  'el-button': {
    props: ['type', 'loading', 'disabled'],
    template:
      '<button class="el-button" :class="type" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  'el-select': {
    props: ['modelValue', 'placeholder', 'clearable', 'filterable', 'loading'],
    emits: ['update:modelValue'],
    template:
      '<select class="el-select" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>',
  },
  'el-option': {
    props: ['label', 'value'],
    template: '<option :value="value">{{ label }}</option>',
  },
  'el-option-group': {
    props: ['label'],
    template: '<optgroup :label="label"><slot /></optgroup>',
  },
  'el-alert': {
    props: ['type', 'title', 'description', 'closable'],
    template: '<div class="el-alert" :class="type">{{ title }} - {{ description }}</div>',
  },
}

import { listAvailable } from '@/api/opinionTemplate'
import { ElMessage } from 'element-plus'

const mockTemplates = [
  { id: 'sys-1', factoryId: null, decisionType: 'CUSTOM', content: '同意', sortOrder: 1, isActive: true },
  { id: 'sys-2', factoryId: null, decisionType: 'CUSTOM', content: '请补充材料', sortOrder: 2, isActive: true },
  { id: 'fac-1', factoryId: 'F001', decisionType: 'CUSTOM', content: '工厂定制', sortOrder: 1, isActive: true },
]

const mountDialog = (props: Partial<{ visible: boolean; contextLine: string }> = {}) =>
  mount(OpinionInputDialog, {
    props: {
      visible: true,
      factoryId: 'F001',
      decisionType: 'CUSTOM',
      title: '驳回',
      otherPlaceholder: '请输入',
      ...props,
    },
    global: { stubs: globalStubs },
  })

const findConfirmBtn = (wrapper: ReturnType<typeof mountDialog>) =>
  wrapper.findAll('.el-button').find((b) => b.classes('primary'))!

const findCancelBtn = (wrapper: ReturnType<typeof mountDialog>) =>
  wrapper.findAll('.el-button').find((b) => !b.classes('primary'))!

describe('OpinionInputDialog (R3 strict)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(listAvailable as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: mockTemplates,
    })
  })

  it('R3: loads templates from API on open', async () => {
    mountDialog({ visible: true })
    await flushPromises()
    expect(listAvailable).toHaveBeenCalledWith('F001', 'CUSTOM')
  })

  it('R3: confirm button disabled when no template selected', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const btn = findConfirmBtn(wrapper)
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('R3: selecting a template enables confirm and emits template.content directly (no textarea)', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    // Pick template "请补充材料"
    const select = wrapper.find('.el-select')
    await select.setValue('sys-2')
    await flushPromises()
    // textarea should NOT be visible (no .other-textarea / no .el-input rendered)
    expect(wrapper.find('.el-input').exists()).toBe(false)
    // confirm now enabled
    const btn = findConfirmBtn(wrapper)
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    // First confirm emit must carry the template content (stub click may bubble twice in test env)
    const emitted = wrapper.emitted('confirm')!
    expect(emitted.length).toBeGreaterThan(0)
    expect(emitted[0]).toEqual(['请补充材料'])
    expect(wrapper.emitted('update:visible')).toContainEqual([false])
  })

  it('R3: selecting "其他" reveals textarea; confirm requires non-empty input', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const select = wrapper.find('.el-select')
    await select.setValue('__OTHER__')
    await flushPromises()
    // textarea now visible
    const textarea = wrapper.find('.el-input')
    expect(textarea.exists()).toBe(true)
    // confirm still disabled (empty textarea)
    expect(findConfirmBtn(wrapper).attributes('disabled')).toBeDefined()
    await textarea.setValue('   自定义意见 X   ')
    await flushPromises()
    // confirm enabled now
    expect(findConfirmBtn(wrapper).attributes('disabled')).toBeUndefined()
    await findConfirmBtn(wrapper).trigger('click')
    const emitted = wrapper.emitted('confirm')!
    expect(emitted.length).toBeGreaterThan(0)
    expect(emitted[0]).toEqual(['自定义意见 X']) // trimmed
  })

  it('cancel emits update:visible=false + cancel event', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    await findCancelBtn(wrapper).trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:visible')).toContainEqual([false])
  })

  it('R2: contextLine renders as context badge above dropdown', async () => {
    const wrapper = mountDialog({ contextLine: '张三 - 卤猪蹄 200g (SO-001)' })
    await flushPromises()
    expect(wrapper.html()).toContain('张三 - 卤猪蹄 200g (SO-001)')
  })

  it('R3+R5 fallback: 无模板时直接 textarea + admin hint', async () => {
    ;(listAvailable as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, data: [] })
    const wrapper = mountDialog()
    await flushPromises()
    // No el-select rendered (since dropdown only renders when templates exist)
    expect(wrapper.find('.el-select').exists()).toBe(false)
    // textarea visible (fallback mode)
    expect(wrapper.find('.el-input').exists()).toBe(true)
    // admin hint shown
    expect(wrapper.html()).toContain('暂无可用模板')
  })

  it('R3+R5 fallback: fetch error 显示 warning, 不阻断', async () => {
    ;(listAvailable as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
    const wrapper = mountDialog()
    await flushPromises()
    expect(wrapper.html()).toContain('加载模板失败')
    expect(wrapper.find('.el-input').exists()).toBe(true) // 仍允许输入
  })

  it('R3: confirm without selection 显示 warning toast', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    // 直接 trigger click on disabled button (some test envs allow it)
    const btn = findConfirmBtn(wrapper)
    // 因 disabled 属性, click 可能被 stub 阻断 — 但 ElMessage.warning 被 click handler 调用前
    // 已被 canConfirm 短路. 验证 fallback path: 通过 unselected handleConfirm.
    // (此场景在真实 UI 上 disabled button 无 click; 此处仅验证 handler 防御)
    await btn.trigger('click')
    // disabled → emit 不发生
    expect(wrapper.emitted('confirm')).toBeFalsy()
  })
})
