# Agent Team Report: P5.6 Gap 修复必要性审查

**Date**: 2026-04-11
**Mode**: Full (3 researchers → Analyst → Critic → Integrator)
**Language**: Chinese
**Codebase Grounding**: ENABLED
**Topic**: 审查 P5.6 gap 修复的 3 个选项 (A/B/C) + P2.11 mobile smoke + P5.8 demo 重现手动任务的必要性

---

## Executive Summary

**采纳 Critic 立场，执行 Option A（路由层修复，非 P6 重构）。** 在 `SmartBIServiceImpl` 中通过 `@Lazy` 注入 `IntentExecutorService`，在 `processQuery()` 入口处增加餐饮意图分流：识别到 `cost_rigidity / MENU_ENGINEERING` 等餐饮诊断类意图时，绕开 1135 行本地 switch-case，直接调用 Tool-Skill 管线，并将 `IntentExecuteResponse.resultData` 通过薄适配器映射为 `NLQueryResponse`。

**成本**: ~60 行代码 / 2-3 小时
**收益**: 零爆炸半径（新增分支，不动现有 5 个 writer），同时修复 web-admin **和** Mobile RN 两个调用方的 P5.6
**为什么不选 Option C**: sections=[] 永久空 → demo 显示空气泡卡片 = 隐性失败比显性错误更糟
**P2.11 / P5.8**: 维持 defer，但理由更新为"纸面覆盖不是真实覆盖"

---

## Critical Findings

### 1. 架构断点 (code-verified)

`SmartBIServiceImpl.processQuery()` 第 407 行调用本地 `executeIntent()` (:435 call site, :1135 定义), 这是一个 switch-case, **完全不经过 `IntentExecutorService`**. grep 确认 `SmartBIServiceImpl` 没有注入 `IntentExecutorService`. switch-case 的 15 个 case 全部是 sales/finance/department/forecast 等通用分析, **零餐饮分支**, 餐饮意图打到 default 直接 throw `BusinessException("暂不支持该查询类型")`.

### 2. 跨平台破坏 (NEW FINDING from Critic)

Mobile RN `smartbi.ts:226` 调用 `/api/mobile/${currentFactoryId}/smart-bi/query` — **与 web-admin 同一端点**. 这意味着:
- P5.6 gap **不是 web-admin 单端问题**, 而是跨平台破坏
- 修一处治两处 (Option A 的 5x 杠杆)
- Mobile 从来跑不通餐饮 chat (所以 P2.11 从来就跑不通)

3 位 Researcher 都漏掉了这个事实, 直到 Critic 二次验证代码时发现.

### 3. 纸面覆盖 vs 真实覆盖

Analyst 声称 P2.11 被 `RestaurantDiagnosticChatE2ETest.java` 覆盖 90%, P5.8 被 `restaurant-chat.spec.ts` 覆盖 60%. Critic 验证发现:
- `RestaurantDiagnosticChatE2ETest.java` **类级 @Disabled**, 5 个用例从未运行过
- `restaurant-chat.spec.ts` 默认 `SHOULD_RUN=0`, 4 个场景从未运行过
- screenshots/ 目录根本不存在

这些"覆盖"是 **paper coverage**, 不是 real coverage. defer P2.11/P5.8 仍然正确, 但理由不是"自动化已覆盖", 而是"没有可验证的目标态 + mobile 端点从来就 broken".

### 4. Option C 的隐性失败

`sections: SectionPayload[]` 在 `NLQueryResponse` 中没有数据源. TS adapter 只能 rename (intent→intentCode), 无法凭空生成 sections. 客户在 demo 现场问"成本刚性"看到的是:
- **Option C**: AI 气泡有文字但卡片全是空抽屉 — **隐性失败, 客户信任崩塌**
- **"暂不支持"**: 明确错误 — 可控
- **Option A**: 真实诊断卡片 — 目标态

Option C 比完全不修复**更糟**.

---

## Disagreement Resolution Matrix

| Dispute | Analyst Position | Critic Position | Resolution |
|---------|-----------------|-----------------|-----------|
| 该选哪个 Option | Option C (quick win + defer) | Option A (correct + ship) | **Option A** — Option C 的空卡片 = 演示反向广告 |
| Option A 真实成本 | 100-130 行 / 4-6h | 60 行 / 2-3h | **60 行 / 2-3h** — Analyst 把 P6 canvas 重构成本错误搬到 A 上 |
| Option C 是否可接受 | "原型够用" | "比破了更糟" | **Critic** — prototype-grade ≠ broken-prototype |
| Mobile 影响 | "无关" | "同端点, 跨平台" | **Critic** — Researcher B 代码侦察明确 mobile 走同端点 |

---

## 3 Fix Options Comparison

| 维度 | Option A (路由分流) | Option B (DTO 增量) | Option C (TS 适配器) |
|------|---------------------|---------------------|---------------------|
| **代码改动量** | ~60 行 Java + 25 行 TS | 40-60 行 Java | 25-35 行 TS |
| **波及面** | 零回归 (新增分支) | 5 Java writers + mobile types (但 additive 零破坏) | 1 TS 文件 |
| **能产出真 sections?** | ✅ 能 (唯一方案) | ❌ 不能 (builder 不连 Tool) | ❌ 不能 (无数据源) |
| **实现时间** | 2-3h | 1.5-2h | 30-45min |
| **跨平台修复** | ✅ mobile + web-admin 一起修 | ⚠️ DTO 字段有数据但不触发 Tool | ❌ 只修 web-admin, mobile 仍 broken |
| **Demo 场景体验** | 真诊断卡片 | 空字段 (更糟) | 空卡片 (最糟) |
| **风险等级** | 中 (注入 @Lazy, 新分支) | 低-中 | 极低 (代码层) / **极高 (demo 层)** |
| **长期维护** | 最高 (为 P6 铺路) | 中 (DTO 膨胀) | 低 (临时胶水) |

---

## P2.11 / P5.8 Final Verdict

### P2.11 Mobile Smoke Test → **DEFER**
- Exit Gate 措辞是普通 checkbox, 无 "blocking/REQUIRED" 字样
- screenshots/ 目录从未存在, 从未被执行过
- 90% 自动化覆盖是纸面覆盖 (5 @Disabled 测试从未运行)
- **核心理由**: Mobile 用同一个 `/smart-bi/query` 端点, Option A 修复后 mobile 餐饮意图也活了 → P2.11 应在 Option A 部署后 **重新评估**, 不是永久 drop
- **新时间点**: Option A 落地 + 部署到 test 环境后, 跑一次 RestaurantDiagnosticChatE2ETest 启用的 1 个用例即可

### P5.8 Demo Recreation → **DEFER**
- Exit Gate 同样无 blocking 字样
- 60% 自动化覆盖是纸面覆盖 (`SHOULD_RUN=0`)
- 真实价值: demo rehearsal (不是 CI 质量关口)
- **新时间点**: 客户 demo 前 1 天运行 1 次, 产出 20 张截图存档

---

## Actionable Recommendations

### Immediate (do now) — Execute Option A

**Step 0: 预检查 (5 分钟)** — 在动手前 curl 验证:
```bash
curl -s "http://localhost:10010/api/mobile/ai/intent/execute" \
  -H "Content-Type: application/json" \
  -d '{"factoryId":"<test>","userInput":"分析菜品成本结构"}'
```
确认 `resultData` 含 `sections` 或 `followUpChips`. 如果不含, **停手** — 问题在 Tool 端 formatResult, 不在路由层.

**Step 1: 后端路由分流 (~35 行 Java)** — `SmartBIServiceImpl.java`:
```java
@Autowired
@Lazy  // 防循环依赖
private IntentExecutorService intentExecutorService;

// processQuery() 入口
if (isRestaurantDiagnosticIntent(intentCode)) {
    IntentExecuteResponse execResp = intentExecutorService.execute(
        factoryId, userInput, context);
    return mapToNLQueryResponse(execResp);
}
// 否则继续走原来的 executeIntent() switch-case
```

**Step 2: 适配器 (~20 行 Java)** — `mapToNLQueryResponse(IntentExecuteResponse)`:
- 把 `resultData` 当 `Map<String,Object>` 取 sections / followUpChips / toolName / skillName / intentCode
- **NLQueryResponse 新增 5 个同名字段** (additive, 对 5 个 writer 和 Mobile RN 零破坏)
- 保留原 responseText / chartData / suggestions 回填

**Step 3: 前端薄适配 (~25 行 TS)** — `web-admin/RestaurantChatPanel.vue`:
- 降级策略: 如果 `sections` 空但 `responseText` 有内容, 渲染单 markdown 卡片兜底
- Mobile RN 零变更

**Step 4: 验证 (10 分钟)**:
- curl `/smart-bi/query` 发餐饮 query, 确认 sections 非空
- web-admin RestaurantChatPanel 渲染 section cards
- Mobile NLQueryScreen 旧字段仍正常

**Step 5: 里程碑 commit** (concurrent-edit-safety 规则):
```
fix(smartbi): route restaurant intents through Tool-Skill pipeline (P5.6)
```

### Short-term (this week)

1. **P6 计划文档更新** — 列出 `executeIntent()` 1135 行 switch-case 为 P6 技术债 (Option A 是路由分流补丁, 不是清除债务)
2. **P2.11 / P5.8 defer 决定文档化** — 在 Exit Gates 旁注释"纸面覆盖 != 真实覆盖, 手动验证延后到 Option A 部署后"
3. **启用 1 个真实 E2E 冒烟** — `RestaurantDiagnosticChatE2ETest.java` 去掉类级 @Disabled, 只跑 1 个用例
4. **打开 `restaurant-chat.spec.ts` 的 SHOULD_RUN** — 在 CI 里默认跑
5. **Mobile RN 跟进** — Option A 修复后至少在 NLQueryScreen 测一次不会 crash

### Conditional

- **如果 Step 0 预检查失败** → 先修 Tool 端 formatResult, 再回来做路由
- **如果 Tool 端有写库副作用** → 降级到 Option B 强化版 (switch-case default 前加 ToolRegistry fallback, ~15 行)
- **如果 demo 时间 <48h** → Option A 仍可执行
- **如果 NLQueryResponse 新增字段破坏某个 writer** → 改用 `NLQueryResponseV2 extends NLQueryResponse`
- **如果 Daisy 仍坚持 Option C** → 至少加显式降级提示"结构化卡片即将上线", 避免隐性失败

---

## Open Questions

1. **餐饮意图白名单精确范围** — `isRestaurantDiagnosticIntent()` 应含哪些 intent_code? 需从 `ai_intent_config` 表查 `intent_category='RESTAURANT'`
2. **`IntentExecuteResponse.resultData` 的实际结构** — `Map<String,Object>` 还是强类型 DTO? 预检查 curl 可看
3. **NLQueryResponse 新增字段的 TS 类型校验** — web-admin/common.ts 是否闭合 interface?
4. **Mobile RN 的 `smartbi.ts:226` 类型定义是否会因新字段报错** — additive 通常不会但需实测
5. **P5.6 客户 demo 是否真的需要 sections 卡片** — **关键问题**, 决定一切. demo 脚本点到 RestaurantChatPanel sections 区域 → Option A 必须; 只到 Mobile 文本框 → Option C 勉强可
6. **`restaurant-chat.spec.ts` 的 SHOULD_RUN=0 是有意还是遗留** — 如果是资源问题, short-term 第 4 项要先解决

---

## Process Note

- **Mode**: Full (4-phase pipeline)
- **Researchers deployed**: 3 (Code Reality / Blast Radius / Manual Verification)
- **Browser explorer**: OFF
- **Fact-check**: OFF (CODEBASE_GROUNDING=true replaces it)
- **Total sources**: 22+ code files verified across Java backend + web-admin + Mobile RN
- **Key disagreements**: 4 disputes between Analyst (Option C) and Critic (Option A), Critic翻盘成功 via code verification
- **Phases completed**: Research → Analysis → Critique → Integration
- **Healer**: All structural checks passed

---

## Lessons Learned

1. **"Paper coverage" is real risk** — `@Disabled` tests and `SHOULD_RUN=0` gates look like coverage in the commit log but provide zero runtime verification. Audit pipelines must check actual execution, not just test file existence.

2. **Sub-agent research can miss cross-cutting facts** — 3 researchers investigated separate angles but all missed that Mobile RN uses the same `/smart-bi/query` endpoint. The Critic's 2nd-pass verification caught this. Single-angle research + multi-angle critique is a valuable pattern.

3. **"Prototype-grade" ≠ "broken-grade"** — Analyst over-indexed on "minimal risk + quick fix" and picked Option C. Critic correctly identified that customer-facing demo value must be a first-order constraint, not risk.

4. **Architectural breaks are structural, not aesthetic** — The `processQuery() → executeIntent()` switch-case bypassing Tool-Skill is a **structural** defect that no adapter/rename can hide. Three researchers converged on this independently.

5. **Option B was dismissed too quickly** — Analyst's "不解决问题" was technically correct for naive Option B but missed the 4th option (switch-case default + ToolRegistry fallback, ~15 lines) that Critic identified as a viable Plan B.
