# SmartBI E2E 验证问题修复方案

**日期**: 2026-02-13
**模式**: Quick | **语言**: Chinese

---

## 执行摘要

4个E2E验证问题经代码级分析和批判性审查：**修2个、不改1个、延后1个**。

---

## 修复决策

| # | 问题 | 决策 | 置信度 | 工作量 |
|---|------|------|--------|--------|
| P1 | KPI圈号②→(2) | **立即修复** | 85% | 5min |
| P2 | SSE _streamingUsed标记 | **立即修复** | 78% | 10min |
| P3 | LRU限制50→20 | **不修复** | 92% | - |
| P4 | Cross-Sheet/Drill-Down E2E | **延后** | 90% | 1-2h |

---

## P1: KPI 圈号修复

**文件**: `web-admin/src/api/smartbi.ts` 第 1873-1881 行
**同步**: `web-admin/src/api/common.ts` 第 714-724 行

```typescript
// 旧: 圈号字符 (用户不理解, _10+丢失)
const n = parseInt(num);
if (n >= 2 && n <= 9) {
  const circled = ['', '', '\u2461', '\u2462', '\u2463', '\u2464', '\u2465', '\u2466', '\u2467', '\u2468'];
  return circled[n] || '';
}

// 新: 括号格式 (直观, 覆盖2-15)
const n = parseInt(num);
if (n >= 2 && n <= 15) {
  return `(${n})`;
}
```

**效果**: "实际收入②" → "实际收入(2)"
**风险**: 极低 — 纯展示层, 不影响数据关联

---

## P2: SSE 流式可观测性

**文件**: `web-admin/src/api/smartbi.ts` 第 953-1028 行

返回类型新增 `_streamingUsed?: boolean`:
- 流式成功路径: `{ ...result, _streamingUsed: true }`
- 3处fallback路径: `{ ...fallbackResult, _streamingUsed: false }`
- 添加 `console.warn('[SSE] falling back:')` 日志

**效果**: E2E可通过eval检查`_streamingUsed`确认流式是否真正工作
**风险**: 低 — 附加字段, 不影响现有消费方

---

## P3: LRU 限制值 — 不修复

**Critic否决理由**:
1. 50→20 无可观测效果 (10个sheet远不及20)
2. 内存差异纳秒级
3. 增加无意义git diff
4. 未来批量场景可能需要更大限制

---

## P4: E2E 测试 — 延后

**建议方案** (未来执行):
- Cross-Sheet: 点击"综合分析"按钮 → 验证dialog出现 → API级别测试
- Drill-Down: **放弃canvas交互测试** — ECharts canvas点击太脆弱, 维护成本>收益

---

## 流程备注
- Mode: Quick
- Researchers: 1 (代码分析)
- Key disagreement: P3被Critic否决 (Analyst建议改→Critic认为无意义)
