/**
 * Unit tests for SchemaFormRenderer autoGenerate behavior.
 * Spec §4.A.2 + M3: autoGenerate fields must be disabled in both create + edit modes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'

// ── Top-level store mocks (vi.mock is hoisted, must be at module scope) ──

let mockConfig: Record<string, unknown> | null = null

vi.mock('@/store/modules/config', () => ({
  useConfigStore: () => ({
    loadEffectiveConfig: vi.fn(() => Promise.resolve(mockConfig)),
  }),
}))

vi.mock('@/store/modules/auth', () => ({
  useAuthStore: () => ({
    factoryId: 'F001',
    user: null as unknown,
    isAuthenticated: false,
  }),
}))

// ── Import component AFTER mocks are set up ───────────────────────

import SchemaFormRenderer from '@/views/modules/components/SchemaFormRenderer.vue'

// ── Helpers ──────────────────────────────────────────────────────

function buildConfig(extra: Record<string, unknown> = { autoGenerate: true }) {
  return {
    moduleCode: 'test_module',
    moduleName: 'Test',
    customLabels: {},
    groups: [{ code: 'g1', label: 'Group 1', order: 0, visible: true }],
    fields: [
      {
        code: 'orderNumber',
        label: '订单号',
        type: 'string',
        required: false,
        visible: true,
        readonly: false,
        defaultValue: null as unknown,
        options: null as unknown,
        group: 'g1',
        order: 0,
        extra,
        source: 'jpa',
      },
    ],
  }
}

async function mountAndFlush(
  extra: Record<string, unknown>,
  mode: 'create' | 'edit' | 'view',
  initialData: Record<string, unknown> = {},
) {
  const wrapper = mount(SchemaFormRenderer, {
    props: { moduleCode: 'test_module', mode, initialData },
    global: { plugins: [ElementPlus] },
  })
  // Wait for onMounted async config load
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
  return wrapper
}

// ── Tests ─────────────────────────────────────────────────────────

describe('SchemaFormRenderer autoGenerate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders disabled input in create mode when autoGenerate=true', async () => {
    mockConfig = buildConfig({ autoGenerate: true })
    const wrapper = await mountAndFlush({ autoGenerate: true }, 'create')

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(input.attributes('disabled')).toBeDefined()
    expect(input.attributes('placeholder')).toBe('保存后自动生成')
  })

  it('renders disabled input in edit mode (M3 snapshot semantics)', async () => {
    mockConfig = buildConfig({ autoGenerate: true })
    const wrapper = await mountAndFlush({ autoGenerate: true }, 'edit', {
      orderNumber: 'SO-20260423-0001',
    })

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(input.attributes('disabled')).toBeDefined()
  })

  it('renders normal editable input when autoGenerate is not set', async () => {
    mockConfig = buildConfig({})
    const wrapper = await mountAndFlush({}, 'create')

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(input.attributes('disabled')).toBeUndefined()
  })
})
