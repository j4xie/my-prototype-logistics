# SmartBI Comprehensive Test Plan — 2026-04-28

**测试范围**: F2-v3/v4/v5 + F1.1 + LLM 优化 + RLS 23 表 + Bug C/D 全 prod live 状态
**环境**: prod (139.196.165.140:8086) qhj_prod / RES_3101_009
**协议**: qa-prompt v2.4 (Rule 1-17, 全合规)

---

## 测试矩阵 (4 维度 × 5 数据集 = 20 cells)

### 维度 A — 数据集类型

| Dataset | 文件 | 行数 | 类型 | 测试目的 |
|---------|------|------|------|---------|
| **A1 多 section pivot** | `收入管理报表.xlsx` | 16→8 | FINANCE | F2-v3+v4+v5 三层 filter 协作 |
| **A2 flat sales** | `xmx_real.csv` | 203 | SALES | F1 capability + 真分类名 + 准确占比 |
| **A3 大文件** | `qhj_25_¿¨ÏêÇéÒ»ÀÀ.csv` | 32997 | MEMBER | 大数据量性能 + 异步流式 |
| **A4 错误格式** | `garbage.xlsx` (13B 非 xlsx) | n/a | n/a | Rule 8 错误路径 (single toast post-fix) |
| **A5 空文件** | `empty.xlsx` (0B) | n/a | n/a | Edge 空数据响应 |

### 维度 B — Query 类型

| Type | Sample query | Expected |
|------|-------------|----------|
| **B1 聚合** | "总营业额是多少" | 数字 + 数据 gap 分析 |
| **B2 排行** | "最高的店是哪家" | 真店名 (F2-v4!) + 数字 + ratio |
| **B3 follow-up** | "刚才那个" / "和最低对比" | 引用上轮 by 数字, v2 memory |
| **B4 趋势** | "同比增长多少" | 同比率字段值 + 行数 |
| **B5 分布** | "堂食外卖占比" | 真占比 + missing data action |
| **B6 gibberish** | "asdf qwer 你能听懂吗" | 优雅 redirect, 不 LLM-burn |
| **B7 新话题** | 新话题 button + ambiguous Q | 不引用前轮 |

### 维度 C — UX/Error 路径

| Test | Trigger | Expected | Rule |
|------|---------|---------|------|
| **C1 Triple-toast** | upload garbage.xlsx | 1 toast (sticky + actionHint) | Rule 8 |
| **C2 Bug C dedup** | 同 message 2s 内 | 仅 1 toast | UX |
| **C3 Bug D auto-select** | 上传新文件 → AI Query | 数据集 selector 自动选最新 | UX |
| **C4 F6 caps-aware chips** | 上传 SALES → 看 chip | finance/sales/review-domain 切换 | F6 |
| **C5 dataset selector reload** | logout → login → 看默认 | 最新 (createdAt < 1h) wins | Bug D |

### 维度 D — 安全/RLS

| Test | Trigger | Expected | Severity |
|------|---------|---------|----------|
| **D1 跨租户 SELECT** | F999 GUC vs RES_3101_009 | 0 visible (任 RLS 表) | P0 |
| **D2 跨租户 DELETE** | F999 GUC DELETE F001 行 | DELETE 0 | P0 |
| **D3 INSERT 不带 GUC** | 直 SQL INSERT factory_id='F001' | 成功 (Hibernate 兼容) | P0 |
| **D4 SELECT 不带 GUC** | 直 SQL SELECT 无 GUC | 全可见 (defense-in-depth, app WHERE 主防) | OK |

---

## Pass/Fail Gating Criteria (per qa-prompt v2.4)

### Rule 1 真端到端 (必须满足):
- ✅ 数据从 upload → Java JPA → smart_bi_pg_excel_uploads → Python 读 → polars cache → AI 完整流转
- ❌ Smoke-only (只看 toast 不看 DB) — 拒绝

### Rule 7 MutationObserver (必须):
- 错误路径前安装 observer
- 收集 toast 全周期 (出现 → fade → dismiss)

### Rule 8 错误四位一体 (error-deep 必须):
- a) 后端 message = UI 文案 ✓
- b) sticky (duration:0 + showClose) ✓
- c) 文案具体 (不是 "操作失败" fallback) ✓
- d) actionHint 含 next action ✓

### Rule 9 中末段抽检 (数据类必须):
- Top 3 + 中段 + 末段 row 都是真业务数据
- 无 1.0/2.0 数字 leak / "门店名称" 表头 leak / "注：" 注释 leak

### Rule 11 wire+roundtrip (写操作必须):
- 抓 POST body
- 验 payload shape (无 phantom 字段, required 全在)
- re-GET diff (无 silent-drop)

### Rule 15 reviewer (3+ commits 必须):
- 已 spawn (running)

### Rule 16 entry matrix (CRUD 必须):
- create / edit / delete 各路径
- 当 form reset 在 entry function 内时, 跨 entry state isolation

---

## Cell-by-cell Test Detail

### Cell A1×B2 — 多 section pivot, 排行问题 (F2-v4 验证)

**Setup**:
1. Login qhj_prod
2. Navigate /smart-bi/upload
3. Install MutationObserver
4. Upload 收入管理报表.xlsx
5. Wait for toast "文件解析成功"
6. Verify 数据预览 = **8 行** (post F2-v3+v4+v5)
7. Verify 字段 contains "_门店或时段"
8. Verify 样本值列 显示真数字 (不再 leak 文本)

**Action**:
- Navigate /smart-bi/query
- Verify selector auto-picks "收入管理报表 8 行" (Bug D)
- Type Q: "堂食实际收入最高的店是哪家"
- Submit + wait for response
- Capture answer text

**Expected**:
- AI says **"颛桥龙湖店"** (NOT "排名第二的门店")
- 数字: **39,617 元**
- 占比: 39617/73762 = **53.7%**
- 数学验证: 占比公式 ≈ 53.71% (tolerance ±0.1%)

**Pass criteria**:
- ✅ Store name = "颛桥龙湖店"
- ✅ Number = 39,617
- ✅ Math correct
- ✅ Latency < 30s (LLM 路径)

### Cell A2×B2 — flat sales 排行 (F1 verify)

**Setup**:
- Upload xmx_real.csv (203 rows)
- Verify 总行数=203, 列数=17, 类型=SALES
- Verify chips switched to sales-domain (F6)

**Action**:
- "畅销品 Top 5"

**Expected**:
- Top 1: **唏嘛香套餐 220,071.30 元 30.86%**
- Top 2-5 follow with real category names
- Math: top-2 sum = 407,574.50 / total 713,090 = 57.16% ≈ 57.2%

**Pass criteria**:
- ✅ 5 真分类名 (no numeric leak)
- ✅ 数字 to-the-decimal accurate
- ✅ Percentage cross-validates

### Cell A1×B3 — 多 section follow-up (v2 memory verify)

**Setup**: A1×B2 已完成 + AI 已答 颛桥龙湖店 39,617

**Action**:
- "和最低的店比较一下"

**Expected**:
- AI 引用 "刚才说的颛桥龙湖店 39,617"
- 找 min: 565 元
- 计算 ratio: 39617 / 565 = 70.12 倍 (or 565/39617 = 1.43%)
- 引用 v2 memory by 轮次 ("基于第 1/2 轮...")

**Pass criteria**:
- ✅ AI 引用 store name (not "刚才那个高的")
- ✅ Math: 70 倍 OR 1.43%
- ✅ Action item references both stores

### Cell C1 — Triple-toast → single (Bug C verify)

**Setup**:
- Install MutationObserver before click

**Action**:
- /smart-bi/upload + click 点击上传
- Select garbage.xlsx (13 bytes non-Excel)
- Wait 8s

**Expected** (post-fix):
- ✅ **1 toast** (was 3)
- ✅ Toast text starts "处理失败: Python SmartBI Excel 解析失败..."
- ✅ Toast `is-closable` (sticky)
- ✅ Toast 文案含 "请确认文件并重新上传" (actionHint)
- ✅ MutationObserver log == 1 entry

### Cell D1 — 跨租户 SELECT (RLS verify)

**Action** (direct SQL on prod smartbi_prod_db):
```sql
SET app.factory_id='F999';
SELECT COUNT(*) FROM smart_bi_pg_excel_uploads WHERE factory_id='RES_3101_009';
SELECT COUNT(*) FROM restaurant_reviews WHERE factory_id != 'F999';
SELECT COUNT(*) FROM worker_trajectory WHERE factory_id != 'F999';
SELECT COUNT(*) FROM smart_bi_finance_data WHERE factory_id != 'F999';
```

**Expected**: 全 0

**Pass criteria**: 4 critical PII tables all return 0

---

## Test Execution Order (按依赖链)

1. **D1-D4 RLS 直 SQL** (5 min) — 不依赖 UI
2. **A4 garbage** (3 min) → C1 Triple-toast verify
3. **A1 收入管理报表 upload** (5 min) → 验 F2-v3/v4/v5
4. **A1×B1-B7 query 全测** (10 min) — F2-v4 store name + v2 memory
5. **A2 xmx_real upload** (5 min) → 验 F1 flat data + Bug D auto-select
6. **A2×B1, B2** (5 min) → 验 真分类名 + 真数字
7. **C2-C5 UX edge cases** (10 min)
8. **A3 大文件 32997 行** (10 min) — 性能 + 异步路径

**Total**: ~50 min comprehensive test

---

## Cleanup (per qa-prompt v2.4 Rule 1)

测试完成后:
- 删除测试 upload (id 4232+ on prod) — `DELETE FROM smart_bi_pg_excel_uploads WHERE factory_id='RES_3101_009' AND created_at > '2026-04-28 12:30'`
- 清空 chat session (新话题 button × N)
- 文档化所有 evidence (numbers / store names / latency) in test report

---

## Parking Lot (defer)

- F2-v6: nested sections (sub-section under section) 现在被忽略
- LLM provider race (parallel call N providers, first response wins) — 比 sequential fallback 快, 但成本 N×
- Excel 上传 best-practice doc (面向客户)
