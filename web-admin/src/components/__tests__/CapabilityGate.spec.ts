/**
 * Tests for CapabilityGate component
 * Per spec §5.2 — verifies satisfied / placeholder / hide branches
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import CapabilityGate from '../CapabilityGate.vue';

// Mock the composable — components under test should not exercise real composable logic
const mockState = {
  available: ref<Set<string> | null>(new Set(['amount', 'quantity'])),
  loading: ref(false),
  suggestions: ref<Array<{ missing_field: string; cta: string; unlocks_examples: string[] }>>([]),
  hasAll: vi.fn((requires: string[]) => {
    if (mockState.available.value === null) return false;
    return requires.every((f) => mockState.available.value!.has(f));
  }),
  missingOf: vi.fn((requires: string[]) => {
    if (mockState.available.value === null) return [...requires];
    return requires.filter((f) => !mockState.available.value!.has(f));
  }),
};

vi.mock('@/composables/useCapability', () => ({
  useCapability: () => mockState,
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Stub out Element Plus components for unit-test isolation
const globalStubs = {
  'el-skeleton': true,
  'el-empty': {
    props: ['description', 'imageSize'],
    template: '<div class="el-empty"><span class="desc">{{ description }}</span><slot /></div>',
  },
  'el-button': {
    template: '<button><slot /></button>',
  },
};

describe('CapabilityGate', () => {
  beforeEach(() => {
    mockState.available.value = new Set(['amount', 'quantity']);
    mockState.loading.value = false;
    mockState.suggestions.value = [];
  });

  it('renders default slot when capability requirements satisfied', () => {
    const wrapper = mount(CapabilityGate, {
      props: { requires: ['amount'], cardId: 'test-card' },
      slots: { default: '<div class="card-content">REAL CONTENT</div>' },
      global: { stubs: globalStubs },
    });
    expect(wrapper.html()).toContain('REAL CONTENT');
    expect(wrapper.find('.capability-placeholder').exists()).toBe(false);
  });

  it('renders placeholder when not satisfied with default fallback', () => {
    const wrapper = mount(CapabilityGate, {
      props: { requires: ['profit'], cardId: 'test-card' },
      slots: { default: '<div class="card-content">REAL CONTENT</div>' },
      global: { stubs: globalStubs },
    });
    expect(wrapper.html()).not.toContain('REAL CONTENT');
    expect(wrapper.find('.capability-placeholder').exists()).toBe(true);
    expect(wrapper.html()).toContain('profit');
  });

  it('renders nothing when fallback="hide" and not satisfied', () => {
    const wrapper = mount(CapabilityGate, {
      props: { requires: ['profit'], cardId: 'test-card', fallback: 'hide' },
      slots: { default: '<div class="card-content">REAL CONTENT</div>' },
      global: { stubs: globalStubs },
    });
    expect(wrapper.html()).not.toContain('REAL CONTENT');
    expect(wrapper.find('.capability-placeholder').exists()).toBe(false);
    // Component still mounts but template branch yields no element
    expect(wrapper.text().trim()).toBe('');
  });
});
