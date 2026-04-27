/**
 * Tests for TrustIndicator component
 * Per spec 数据织网/04-C-字段血统与继承.md §6.1 — verifies
 * confidence threshold mapping, source label translation, and audit emit.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TrustIndicator from '../TrustIndicator.vue';

// Stub out Element Plus components for unit-test isolation
const globalStubs = {
  'el-tag': {
    props: ['type', 'size'],
    template: '<span class="el-tag" :class="`type-${type}`"><slot /></span>',
  },
  'el-button': {
    props: ['link', 'size'],
    template: '<button class="el-button"><slot /></button>',
  },
};

describe('TrustIndicator', () => {
  it('renders success tag with 高置信 when confidence > 0.85', () => {
    const wrapper = mount(TrustIndicator, {
      props: { confidence: 0.9, source: 'manual' },
      global: { stubs: globalStubs },
    });
    const tag = wrapper.find('.el-tag');
    expect(tag.exists()).toBe(true);
    expect(tag.classes()).toContain('type-success');
    expect(tag.text()).toBe('高置信');
  });

  it('renders warning tag with 中置信 when confidence is 0.8 (between 0.7 and 0.85)', () => {
    const wrapper = mount(TrustIndicator, {
      props: { confidence: 0.8, source: 'manual' },
      global: { stubs: globalStubs },
    });
    const tag = wrapper.find('.el-tag');
    expect(tag.classes()).toContain('type-warning');
    expect(tag.text()).toBe('中置信');
  });

  it('renders info tag with 低置信 when confidence is 0.5 (≤0.7)', () => {
    const wrapper = mount(TrustIndicator, {
      props: { confidence: 0.5, source: 'manual' },
      global: { stubs: globalStubs },
    });
    const tag = wrapper.find('.el-tag');
    expect(tag.classes()).toContain('type-info');
    expect(tag.text()).toBe('低置信');
  });

  it('translates known source types and falls back to raw string for unknown', () => {
    // bill_flow → 账单流水
    const wrapperBill = mount(TrustIndicator, {
      props: { confidence: 0.9, source: 'bill_flow' },
      global: { stubs: globalStubs },
    });
    expect(wrapperBill.html()).toContain('账单流水');

    // industry_default → 行业默认值
    const wrapperIndustry = mount(TrustIndicator, {
      props: { confidence: 0.9, source: 'industry_default' },
      global: { stubs: globalStubs },
    });
    expect(wrapperIndustry.html()).toContain('行业默认值');

    // unknown → raw fallback
    const wrapperUnknown = mount(TrustIndicator, {
      props: { confidence: 0.9, source: 'foo_bar' },
      global: { stubs: globalStubs },
    });
    expect(wrapperUnknown.html()).toContain('foo_bar');
  });

  it('hides 查看来源 button without cellAuditUrl, shows it with prop, and emits audit on click', async () => {
    // No cellAuditUrl → no button
    const wrapperNoUrl = mount(TrustIndicator, {
      props: { confidence: 0.9, source: 'manual' },
      global: { stubs: globalStubs },
    });
    expect(wrapperNoUrl.find('button.el-button').exists()).toBe(false);
    expect(wrapperNoUrl.html()).not.toContain('查看来源');

    // With cellAuditUrl → button present
    const wrapper = mount(TrustIndicator, {
      props: {
        confidence: 0.9,
        source: 'manual',
        cellAuditUrl: '/audit/cell/123',
      },
      global: { stubs: globalStubs },
    });
    const btn = wrapper.find('button.el-button');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toBe('查看来源');

    // Click emits audit event
    await btn.trigger('click');
    expect(wrapper.emitted('audit')).toBeTruthy();
    expect(wrapper.emitted('audit')).toHaveLength(1);
  });
});
