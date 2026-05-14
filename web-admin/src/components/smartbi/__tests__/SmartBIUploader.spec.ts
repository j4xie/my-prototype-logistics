/**
 * Tests for SmartBIUploader — single + multi-file modes.
 *
 * Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §9 + Phase I audit findings.
 * Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task I1 (revised).
 *
 * Mirrors AttachmentUploader's `maxCount` pattern. Mode is derived: maxCount=1 (default,
 * legacy single-file) vs maxCount !== 1 (multi). Multi-file mode emits filesChange/
 * fileRemove instead of fileChange.
 *
 * Test coverage map (from audit edge-case list):
 *  - single-file mode emits fileChange + replaces fileList
 *  - multi-file (maxCount>1) emits filesChange + appends w/ uid dedup
 *  - multi-file (maxCount=0) — unlimited, no Element Plus limit enforced
 *  - handleRemove syncs both internal list + emit
 *  - resetFileList clears state
 *  - accept prop override flows to el-upload :accept binding
 *  - uploading=true w/ empty progress props renders minimally (not broken)
 */
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SmartBIUploader from '../SmartBIUploader.vue';
import type { UploadFile } from 'element-plus';

const globalStubs = {
  'el-upload': {
    props: ['multiple', 'limit', 'accept', 'fileList', 'onChange', 'onRemove'],
    template: '<div class="el-upload" :data-multiple="multiple" :data-limit="limit" :data-accept="accept"><slot /></div>',
    // Expose clearFiles so refs in parent .resetFileList() don't throw.
    methods: { clearFiles() { /* no-op stub */ } },
  },
  'el-icon': { template: '<i class="el-icon"><slot /></i>' },
  'el-button': {
    props: ['type', 'size', 'loading'],
    template: '<button class="el-button"><slot /></button>',
  },
  'el-empty': { template: '<div class="el-empty"></div>' },
  'el-progress': {
    props: ['percentage', 'status', 'strokeWidth'],
    template: '<div class="el-progress" :data-percentage="percentage"></div>',
  },
  'el-tag': {
    props: ['type', 'size'],
    template: '<span class="el-tag"><slot /></span>',
  },
  UploadFilled: { template: '<span />' },
  Upload: { template: '<span />' },
  Loading: { template: '<span />' },
  CircleCheckFilled: { template: '<span />' },
  CircleCloseFilled: { template: '<span />' },
};

function mkFile(uid: number, name = `f${uid}.csv`): UploadFile {
  return {
    uid,
    name,
    status: 'ready',
    size: 0,
    raw: new File([''], name) as any,
  } as UploadFile;
}

function basicProps(overrides: Record<string, unknown> = {}) {
  return {
    canUpload: true,
    historyLoading: false,
    uploading: false,
    ...overrides,
  };
}

describe('SmartBIUploader', () => {
  // ─── Single-file mode (default / maxCount=1) ──────────────────────

  it('defaults to single-file mode when maxCount is omitted', () => {
    const wrapper = mount(SmartBIUploader, {
      props: basicProps(),
      global: { stubs: globalStubs },
    });
    const upload = wrapper.find('.el-upload');
    expect(upload.attributes('data-multiple')).toBe('false');
    expect(upload.attributes('data-limit')).toBe('1');
    expect(upload.attributes('data-accept')).toBe('.xlsx,.xls,.csv');
  });

  it('emits fileChange in single-file mode and replaces fileList', async () => {
    const wrapper = mount(SmartBIUploader, {
      props: basicProps(),
      global: { stubs: globalStubs },
    });
    const f1 = mkFile(1);
    const f2 = mkFile(2);

    // Drive the change via the component's own handler since the stub doesn't propagate events.
    (wrapper.vm as any).$.exposed; // ensure mounted
    const vm: any = wrapper.vm;
    vm.handleFileChange?.(f1);
    vm.handleFileChange?.(f2);
    await wrapper.vm.$nextTick();

    const events = wrapper.emitted();
    expect(events['fileChange']).toHaveLength(2);
    expect(events['fileChange']![0]).toEqual([f1]);
    expect(events['fileChange']![1]).toEqual([f2]);
    // No multi-file emit in single mode.
    expect(events['filesChange']).toBeUndefined();
  });

  // ─── Multi-file mode (maxCount > 1) ────────────────────────────────

  it('switches to multi-file mode when maxCount > 1', () => {
    const wrapper = mount(SmartBIUploader, {
      props: basicProps({ maxCount: 5 }),
      global: { stubs: globalStubs },
    });
    const upload = wrapper.find('.el-upload');
    expect(upload.attributes('data-multiple')).toBe('true');
    expect(upload.attributes('data-limit')).toBe('5');
  });

  it('appends files in multi-file mode and emits filesChange w/ full list', async () => {
    const wrapper = mount(SmartBIUploader, {
      props: basicProps({ maxCount: 5 }),
      global: { stubs: globalStubs },
    });
    const vm: any = wrapper.vm;
    vm.handleFileChange(mkFile(1));
    vm.handleFileChange(mkFile(2));
    vm.handleFileChange(mkFile(3));
    await wrapper.vm.$nextTick();

    const events = wrapper.emitted();
    expect(events['filesChange']).toHaveLength(3);
    // Last emit carries all 3 files.
    const lastEmit = (events['filesChange']![2] as unknown[])[0] as UploadFile[];
    expect(lastEmit).toHaveLength(3);
    expect(lastEmit.map((f) => f.uid)).toEqual([1, 2, 3]);
    // No single-file emit in multi mode.
    expect(events['fileChange']).toBeUndefined();
  });

  it('dedups by uid (defends against double-fire)', async () => {
    const wrapper = mount(SmartBIUploader, {
      props: basicProps({ maxCount: 5 }),
      global: { stubs: globalStubs },
    });
    const vm: any = wrapper.vm;
    const f = mkFile(42);
    vm.handleFileChange(f);
    vm.handleFileChange(f); // same uid → ignored
    await wrapper.vm.$nextTick();

    const emits = wrapper.emitted('filesChange')!;
    // Both calls emit, but the second emit's list still has length 1 (dedup).
    expect(emits).toHaveLength(2);
    expect((emits[1][0] as UploadFile[])).toHaveLength(1);
  });

  // ─── Multi-file mode (maxCount = 0, unlimited) ─────────────────────

  it('treats maxCount=0 as unlimited (Element Plus :limit semantics)', () => {
    const wrapper = mount(SmartBIUploader, {
      props: basicProps({ maxCount: 0 }),
      global: { stubs: globalStubs },
    });
    const upload = wrapper.find('.el-upload');
    expect(upload.attributes('data-multiple')).toBe('true');
    expect(upload.attributes('data-limit')).toBe('0');
  });

  // ─── handleRemove ──────────────────────────────────────────────────

  it('removes a file via handleRemove and emits fileRemove + filesChange (multi mode)', async () => {
    const wrapper = mount(SmartBIUploader, {
      props: basicProps({ maxCount: 0 }),
      global: { stubs: globalStubs },
    });
    const vm: any = wrapper.vm;
    const f1 = mkFile(1);
    const f2 = mkFile(2);
    vm.handleFileChange(f1);
    vm.handleFileChange(f2);

    vm.handleRemove(f1, [f2]); // user clicks "x" on f1
    await wrapper.vm.$nextTick();

    const removeEmits = wrapper.emitted('fileRemove')!;
    expect(removeEmits).toHaveLength(1);
    expect((removeEmits[0][0] as UploadFile).uid).toBe(1);
    expect((removeEmits[0][1] as UploadFile[]).map((f) => f.uid)).toEqual([2]);

    // multi-mode also re-emits filesChange so parent can sync state in one place.
    const filesChangeEmits = wrapper.emitted('filesChange')!;
    // Last filesChange is post-removal w/ remaining files.
    const lastList = filesChangeEmits[filesChangeEmits.length - 1][0] as UploadFile[];
    expect(lastList.map((f) => f.uid)).toEqual([2]);
  });

  it('handleRemove in single-file mode emits fileRemove only (no filesChange)', async () => {
    const wrapper = mount(SmartBIUploader, {
      props: basicProps(),
      global: { stubs: globalStubs },
    });
    const vm: any = wrapper.vm;
    const f = mkFile(1);
    vm.handleFileChange(f);
    vm.handleRemove(f, []);
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('fileRemove')).toHaveLength(1);
    expect(wrapper.emitted('filesChange')).toBeUndefined();
  });

  // ─── resetFileList ─────────────────────────────────────────────────

  it('resetFileList clears state from defineExpose', async () => {
    const wrapper = mount(SmartBIUploader, {
      props: basicProps({ maxCount: 5 }),
      global: { stubs: globalStubs },
    });
    const vm: any = wrapper.vm;
    vm.handleFileChange(mkFile(1));
    vm.handleFileChange(mkFile(2));
    vm.resetFileList();
    await wrapper.vm.$nextTick();

    // After reset, a subsequent change starts from empty list.
    vm.handleFileChange(mkFile(3));
    await wrapper.vm.$nextTick();
    const lastEmit = wrapper.emitted('filesChange')!.slice(-1)[0][0] as UploadFile[];
    expect(lastEmit).toHaveLength(1);
    expect(lastEmit[0].uid).toBe(3);
  });

  // ─── accept prop override ──────────────────────────────────────────

  it('passes accept prop override to el-upload', () => {
    const wrapper = mount(SmartBIUploader, {
      props: basicProps({ maxCount: 0, accept: '.zip,.xlsx,.csv' }),
      global: { stubs: globalStubs },
    });
    expect(wrapper.find('.el-upload').attributes('data-accept'))
      .toBe('.zip,.xlsx,.csv');
  });

  // ─── uploading=true minimal feedback path ─────────────────────────

  it('renders minimal progress feedback when uploading=true + no SSE props', () => {
    const wrapper = mount(SmartBIUploader, {
      props: basicProps({ uploading: true }),
      global: { stubs: globalStubs },
    });
    const progress = wrapper.find('.el-progress');
    expect(progress.exists()).toBe(true);
    expect(progress.attributes('data-percentage')).toBe('0');
    // No sheet panel (empty list).
    expect(wrapper.find('.sheet-progress-panel').exists()).toBe(false);
  });

  it('renders SSE detail panel when sheetProgressList provided', () => {
    const wrapper = mount(SmartBIUploader, {
      props: basicProps({
        uploading: true,
        uploadProgress: 50,
        progressText: 'Processing...',
        sheetProgressList: [
          {
            sheetIndex: 0,
            sheetName: 'Sheet1',
            stage: 'parsing',
            message: 'ok',
            status: 'complete' as const,
          },
        ],
        totalSheetCount: 1,
        completedSheetCount: 1,
      }),
      global: { stubs: globalStubs },
    });
    expect(wrapper.find('.sheet-progress-panel').exists()).toBe(true);
  });
});
