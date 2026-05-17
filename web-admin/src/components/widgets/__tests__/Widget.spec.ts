/**
 * Widget.vue base wrapper tests (P1 #65 C-WIDGET-1).
 *
 * Covers loading / error / empty / content states + refresh + empty-action
 * emit. Validates 防呆 R5 (empty-state shows action CTA when label given).
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Widget from '../Widget.vue';

const globalStubs = {
  'el-card': {
    template: '<div class="el-card"><div class="el-card__header"><slot name="header"/></div><div class="el-card__body"><slot/></div></div>',
  },
  'el-button': {
    props: ['icon', 'loading', 'text', 'size', 'type', 'title'],
    template: '<button class="el-button" :disabled="loading" @click="$emit(`click`)"><slot/></button>',
    emits: ['click'],
  },
  'el-empty': {
    props: ['description', 'imageSize'],
    template: '<div class="el-empty"><span class="desc">{{ description }}</span><slot/></div>',
  },
};

describe('Widget.vue', () => {
  it('renders title in header', () => {
    const wrapper = mount(Widget, {
      props: { title: '测试标题' },
      slots: { default: '<div class="body">body</div>' },
      global: { stubs: globalStubs },
    });
    expect(wrapper.text()).toContain('测试标题');
    expect(wrapper.find('.body').exists()).toBe(true);
  });

  it('shows error state when error prop set', () => {
    const wrapper = mount(Widget, {
      props: { title: 'X', error: '加载失败,请稍后' },
      slots: { default: '<div class="body">body</div>' },
      global: { stubs: globalStubs },
    });
    expect(wrapper.find('.widget-base-error').exists()).toBe(true);
    expect(wrapper.text()).toContain('加载失败,请稍后');
    expect(wrapper.find('.body').exists()).toBe(false);
  });

  it('shows empty state with custom message + action label (防呆 R5)', () => {
    const wrapper = mount(Widget, {
      props: {
        title: 'X',
        empty: true,
        emptyMessage: '今日还没有数据',
        emptyActionLabel: '录入第一条',
      },
      slots: { default: '<div class="body">body</div>' },
      global: { stubs: globalStubs },
    });
    expect(wrapper.find('.widget-base-empty').exists()).toBe(true);
    expect(wrapper.text()).toContain('今日还没有数据');
    expect(wrapper.text()).toContain('录入第一条');
    expect(wrapper.find('.body').exists()).toBe(false);
  });

  it('emits refresh on refresh button click', async () => {
    const wrapper = mount(Widget, {
      props: { title: 'X' },
      slots: { default: '<div>body</div>' },
      global: { stubs: globalStubs },
    });
    // header has the refresh el-button
    const buttons = wrapper.findAll('button.el-button');
    expect(buttons.length).toBeGreaterThan(0);
    await buttons[0].trigger('click');
    expect(wrapper.emitted('refresh')).toBeTruthy();
  });

  it('emits empty-action on empty-state CTA click (防呆 R5)', async () => {
    const wrapper = mount(Widget, {
      props: { title: 'X', empty: true, emptyActionLabel: '录第一条' },
      slots: { default: '<div>body</div>' },
      global: { stubs: globalStubs },
    });
    // find the CTA button by text
    const buttons = wrapper.findAll('button.el-button');
    const cta = buttons.find((b) => b.text() === '录第一条');
    expect(cta?.exists()).toBe(true);
    await cta!.trigger('click');
    expect(wrapper.emitted('empty-action')).toBeTruthy();
  });

  it('renders body slot when not loading, not error, not empty', () => {
    const wrapper = mount(Widget, {
      props: { title: 'X' },
      slots: { default: '<div class="body">my body content</div>' },
      global: { stubs: globalStubs },
    });
    expect(wrapper.find('.body').exists()).toBe(true);
    expect(wrapper.text()).toContain('my body content');
    expect(wrapper.find('.widget-base-empty').exists()).toBe(false);
    expect(wrapper.find('.widget-base-error').exists()).toBe(false);
  });

  it('error takes precedence over empty', () => {
    const wrapper = mount(Widget, {
      props: { title: 'X', error: '错误', empty: true, emptyActionLabel: 'cta' },
      slots: { default: '<div>body</div>' },
      global: { stubs: globalStubs },
    });
    expect(wrapper.find('.widget-base-error').exists()).toBe(true);
    expect(wrapper.find('.widget-base-empty').exists()).toBe(false);
  });
});
