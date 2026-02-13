/**
 * draftReportStore 单元测试
 * 测试离线草稿报工的增删查清功能
 */

import { useDraftReportStore, DraftReport } from '../../../store/draftReportStore';

describe('draftReportStore', () => {
  const FACTORY_F001 = 'F001';
  const FACTORY_F002 = 'F002';

  // 每个测试前重置 store 状态
  beforeEach(() => {
    useDraftReportStore.getState().clearDrafts();
  });

  // ========== addDraft ==========
  describe('addDraft', () => {
    it('应该保存草稿并自动生成id和createdAt', () => {
      useDraftReportStore.getState().addDraft({
        batchId: 101,
        batchNumber: 'BATCH_2026_001',
        productName: '鸡肉香肠',
        outputQuantity: 100,
        goodQuantity: 95,
        defectQuantity: 5,
        notes: '测试草稿',
        factoryId: FACTORY_F001,
      });

      const { drafts } = useDraftReportStore.getState();
      expect(drafts).toHaveLength(1);

      const draft = drafts[0] as DraftReport;
      expect(draft.id).toMatch(/^draft_\d+_/);
      expect(draft.createdAt).toBeDefined();
      expect(new Date(draft.createdAt).toString()).not.toBe('Invalid Date');
      expect(draft.batchId).toBe(101);
      expect(draft.batchNumber).toBe('BATCH_2026_001');
      expect(draft.productName).toBe('鸡肉香肠');
      expect(draft.outputQuantity).toBe(100);
      expect(draft.goodQuantity).toBe(95);
      expect(draft.defectQuantity).toBe(5);
      expect(draft.notes).toBe('测试草稿');
      expect(draft.factoryId).toBe(FACTORY_F001);
    });

    it('应该支持连续保存多个草稿', () => {
      useDraftReportStore.getState().addDraft({
        outputQuantity: 100,
        goodQuantity: 90,
        defectQuantity: 10,
        notes: '草稿1',
        factoryId: FACTORY_F001,
      });

      useDraftReportStore.getState().addDraft({
        outputQuantity: 200,
        goodQuantity: 190,
        defectQuantity: 10,
        notes: '草稿2',
        factoryId: FACTORY_F001,
      });

      const { drafts } = useDraftReportStore.getState();
      expect(drafts).toHaveLength(2);
      expect(drafts[0]?.id).not.toBe(drafts[1]?.id);
    });

    it('应该生成唯一的草稿ID', () => {
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        useDraftReportStore.getState().addDraft({
          outputQuantity: i * 10,
          goodQuantity: i * 9,
          defectQuantity: i,
          notes: `草稿${i}`,
          factoryId: FACTORY_F001,
        });
      }

      const { drafts } = useDraftReportStore.getState();
      drafts.forEach((d) => ids.push(d.id));
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);
    });

    it('应该保存可选字段为undefined的草稿', () => {
      useDraftReportStore.getState().addDraft({
        batchId: undefined,
        batchNumber: undefined,
        productName: undefined,
        outputQuantity: 0,
        goodQuantity: 0,
        defectQuantity: 0,
        notes: '',
        factoryId: FACTORY_F001,
      });

      const { drafts } = useDraftReportStore.getState();
      expect(drafts).toHaveLength(1);
      expect(drafts[0]?.batchId).toBeUndefined();
      expect(drafts[0]?.batchNumber).toBeUndefined();
      expect(drafts[0]?.productName).toBeUndefined();
    });
  });

  // ========== removeDraft ==========
  describe('removeDraft', () => {
    it('应该根据id删除指定草稿', () => {
      useDraftReportStore.getState().addDraft({
        outputQuantity: 100,
        goodQuantity: 90,
        defectQuantity: 10,
        notes: '保留',
        factoryId: FACTORY_F001,
      });

      useDraftReportStore.getState().addDraft({
        outputQuantity: 200,
        goodQuantity: 180,
        defectQuantity: 20,
        notes: '删除',
        factoryId: FACTORY_F001,
      });

      const drafts = useDraftReportStore.getState().drafts;
      expect(drafts).toHaveLength(2);

      const draftToDelete = drafts[1] as DraftReport;
      useDraftReportStore.getState().removeDraft(draftToDelete.id);

      const afterRemove = useDraftReportStore.getState().drafts;
      expect(afterRemove).toHaveLength(1);
      expect(afterRemove[0]?.notes).toBe('保留');
    });

    it('删除不存在的ID不应影响已有草稿', () => {
      useDraftReportStore.getState().addDraft({
        outputQuantity: 100,
        goodQuantity: 90,
        defectQuantity: 10,
        notes: '不动',
        factoryId: FACTORY_F001,
      });

      useDraftReportStore.getState().removeDraft('non_existent_id');

      const { drafts } = useDraftReportStore.getState();
      expect(drafts).toHaveLength(1);
      expect(drafts[0]?.notes).toBe('不动');
    });
  });

  // ========== clearDrafts ==========
  describe('clearDrafts', () => {
    it('应该清除所有草稿', () => {
      for (let i = 0; i < 3; i++) {
        useDraftReportStore.getState().addDraft({
          outputQuantity: i * 10,
          goodQuantity: i * 9,
          defectQuantity: i,
          notes: `草稿${i}`,
          factoryId: FACTORY_F001,
        });
      }

      expect(useDraftReportStore.getState().drafts).toHaveLength(3);

      useDraftReportStore.getState().clearDrafts();

      expect(useDraftReportStore.getState().drafts).toHaveLength(0);
    });

    it('清除空列表不应报错', () => {
      expect(useDraftReportStore.getState().drafts).toHaveLength(0);
      useDraftReportStore.getState().clearDrafts();
      expect(useDraftReportStore.getState().drafts).toHaveLength(0);
    });
  });

  // ========== getDraftsByFactory ==========
  describe('getDraftsByFactory', () => {
    it('应该按factoryId过滤草稿', () => {
      useDraftReportStore.getState().addDraft({
        outputQuantity: 100,
        goodQuantity: 90,
        defectQuantity: 10,
        notes: 'F001草稿',
        factoryId: FACTORY_F001,
      });

      useDraftReportStore.getState().addDraft({
        outputQuantity: 200,
        goodQuantity: 180,
        defectQuantity: 20,
        notes: 'F002草稿',
        factoryId: FACTORY_F002,
      });

      useDraftReportStore.getState().addDraft({
        outputQuantity: 300,
        goodQuantity: 270,
        defectQuantity: 30,
        notes: 'F001另一草稿',
        factoryId: FACTORY_F001,
      });

      const f001Drafts = useDraftReportStore.getState().getDraftsByFactory(FACTORY_F001);
      expect(f001Drafts).toHaveLength(2);
      f001Drafts.forEach((d) => {
        expect(d.factoryId).toBe(FACTORY_F001);
      });

      const f002Drafts = useDraftReportStore.getState().getDraftsByFactory(FACTORY_F002);
      expect(f002Drafts).toHaveLength(1);
      expect(f002Drafts[0]?.notes).toBe('F002草稿');
    });

    it('不存在的factoryId应返回空数组', () => {
      useDraftReportStore.getState().addDraft({
        outputQuantity: 100,
        goodQuantity: 90,
        defectQuantity: 10,
        notes: '草稿',
        factoryId: FACTORY_F001,
      });

      const result = useDraftReportStore.getState().getDraftsByFactory('F999');
      expect(result).toHaveLength(0);
    });
  });

  // ========== 提交后删除（模拟submitDraft场景）==========
  describe('submitDraft workflow', () => {
    it('提交草稿后应从列表中删除', () => {
      useDraftReportStore.getState().addDraft({
        outputQuantity: 100,
        goodQuantity: 90,
        defectQuantity: 10,
        notes: '待提交',
        factoryId: FACTORY_F001,
      });

      useDraftReportStore.getState().addDraft({
        outputQuantity: 200,
        goodQuantity: 180,
        defectQuantity: 20,
        notes: '保留',
        factoryId: FACTORY_F001,
      });

      const drafts = useDraftReportStore.getState().drafts;
      const draftToSubmit = drafts[0] as DraftReport;

      // 模拟提交成功后删除
      useDraftReportStore.getState().removeDraft(draftToSubmit.id);

      const remaining = useDraftReportStore.getState().drafts;
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.notes).toBe('保留');
    });
  });

  // ========== 离线状态行为 ==========
  describe('离线状态行为', () => {
    it('离线时草稿应该持续保存在store中', () => {
      for (let i = 0; i < 5; i++) {
        useDraftReportStore.getState().addDraft({
          outputQuantity: 50 + i * 10,
          goodQuantity: 45 + i * 9,
          defectQuantity: 5 + i,
          notes: `离线草稿${i + 1}`,
          factoryId: FACTORY_F001,
        });
      }

      const { drafts } = useDraftReportStore.getState();
      expect(drafts).toHaveLength(5);

      drafts.forEach((d, i) => {
        expect(d.notes).toBe(`离线草稿${i + 1}`);
        expect(d.factoryId).toBe(FACTORY_F001);
        expect(d.id).toBeTruthy();
        expect(d.createdAt).toBeTruthy();
      });
    });

    it('离线保存后恢复在线，逐个提交并删除草稿', () => {
      for (let i = 0; i < 3; i++) {
        useDraftReportStore.getState().addDraft({
          outputQuantity: (i + 1) * 100,
          goodQuantity: (i + 1) * 90,
          defectQuantity: (i + 1) * 10,
          notes: `离线${i + 1}`,
          factoryId: FACTORY_F001,
        });
      }

      expect(useDraftReportStore.getState().drafts).toHaveLength(3);

      // 恢复在线后逐个"提交"并删除
      while (useDraftReportStore.getState().drafts.length > 0) {
        const firstDraft = useDraftReportStore.getState().drafts[0] as DraftReport;
        useDraftReportStore.getState().removeDraft(firstDraft.id);
      }

      expect(useDraftReportStore.getState().drafts).toHaveLength(0);
    });
  });
});
