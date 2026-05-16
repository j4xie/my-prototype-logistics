# 宏见 ERP 竞品分析 — 文档总览

> **建立日期**: 2026-05-14
> **当前版本**: MASTER-PLAN **v2 + v2.1 amendments**
>
> **背景**: 用户提供宏见武汉销售给苏州/昆山食品厂的腾讯会议演示录屏(.m4a 21:36 + .mp4 1180x2556 23:32)。结合 Cretas 真实客户六扇门(F006)的 4 次会议反馈, 经 **8 轮深度审计**（含 v2 高强度 3 路审计 + 销售红线 fresh audit）, 形成本竞品分析与 Cretas 优化决策。

---

## 📘 必读 (按顺序)

| 顺序 | 文件 | 内容 | 篇幅 |
|---|---|---|---|
| **1** ⭐ | **`00-MASTER-PLAN-v2.md`** | **最终主计划 v2 + v2.1 amendments** — 12 章 + 6 附录 | ~40KB |
| 2 | `04-最终决策/MUST_COPY.md` | 业务功能必抄清单 (18 项) | ~19KB |
| 3 | `04-最终决策/UX_BORROW.md` | 纯 UI/UX 借鉴清单 (23 项) | ~15KB |
| 4 | `03-审计过程/REVISED_STRATEGY.md` | Hybrid 战略 (修正 Agent 简化边界) | ~18KB |
| 5 | `01-客户档案/` 4 次会议 | 真实客户原话 (六扇门 F006) | 各 10-50KB |

> **不要**先读 v1 (`03-审计过程/v1-旧/`) — v1 已 DEPRECATED, 含 10 处错误 (见 v2 §0.1 修正表)

---

## 📁 文件夹结构 (v2)

```
宏见竞品分析/
├── README.md                       ← 本文件
├── 00-MASTER-PLAN-v2.md            ⭐ 最终主计划 v2 + v2.1 amendments (必读)
│
├── 01-客户档案/                     ← 真实客户证据 (六扇门 F006)
│   ├── 六扇门第一次.md              (March 第一份, 客户讲扫码报工)
│   ├── 六扇门第一次.docx
│   ├── 六扇门第二次.md              (2026-03-18, 客户决策放弃传统 ERP)
│   ├── 六扇门第二次.docx
│   ├── 六扇门第三次-May7-part1.md   (UI 测试 + 抄码品)
│   ├── 六扇门第三次-May7-part2.md   (PDF 扫码闭环 + RBAC)
│   ├── 六扇门第四次-May10.md        (BOM 配方 + 工序测试)
│   ├── 研发样品至财务回款全流程文档.md  ← 业务流程权威定义
│   └── 表头.xlsx
│
├── 02-宏见演示素材/                  ← 原始视频/音频处理结果
│   ├── audio.txt / .srt / .json    (21:36 全转写, 251 段)
│   ├── storyboard_hd.md / .json    (HD 关键帧 + 配对音频)
│   ├── storyboard_v2.md / .json    (低分辨率版本备份)
│   ├── keyframes_hd/                (140 张 HD 关键帧 1600px)
│   ├── sample_hd.jpg                (样本帧)
│   └── scene_*_timestamps.txt
│
├── 03-审计过程/                      ← 8 轮审计的全部产出
│   ├── v1-旧/                       ⚠️ DEPRECATED
│   │   └── 00-MASTER-PLAN-v1-DEPRECATED.md  ← v1 (10 处错误, 见顶部警告)
│   ├── EARLY DEPRECATED:
│   │   ├── REPORT.md                (第一版, 偏总结)
│   │   ├── REVIEW.md                (第二版, 修正 REPORT)
│   │   └── GAPS.md                  (23 项首版, 7 项被证伪)
│   ├── 早期审计:
│   │   ├── AUDIT.md                 (硬证据审计)
│   │   ├── AUDIT_X_UI_UX.md         (UI/UX 模式)
│   │   ├── AUDIT_Y_CANVAS.md        (Canvas 系统假 AI 暴露)
│   │   └── AUDIT_Z_AICHAT_E2E.md    (AIChat 端到端追溯)
│   ├── 4 路并行 (第一轮):
│   │   ├── V1_AUDIO_INVENTORY.md    (音频 58 功能)
│   │   ├── V2_HD_INVENTORY.md       (HD 视频 20 新功能 + 15 细节)
│   │   └── V3_CRETAS_REVERSE.md     (Cretas 已有 10 项)
│   ├── 4 路并行 (Fresh 第二轮):
│   │   ├── AUDIT_FRESH_A_VIDEO.md   (HD 视频独立扫描)
│   │   ├── AUDIT_FRESH_B_AUDIO.md   (音频独立扫描)
│   │   ├── AUDIT_FRESH_C_CODE.md    (Cretas 代码 fresh check)
│   │   └── AUDIT_FRESH_D_DOCS.md    (文档一致性, 23 不一致)
│   ├── 3 路并行 (MUST_COPY 准备):
│   │   ├── FINAL_A_NEEDS_VS_CRETAS.md  (客户 47 需求 vs Cretas)
│   │   ├── FINAL_B_INPROGRESS.md       (进行中 PR 核查)
│   │   └── FINAL_C_AI_REPLACE.md       (98 项 AI 替代评估)
│   ├── UX 专门审计:
│   │   ├── UX_AUDIT_A_HONGJIAN.md   (宏见 63 UX 模式)
│   │   └── UX_AUDIT_B_CRETAS.md     (Cretas UX 现状)
│   ├── 战略合成:
│   │   ├── STRATEGY.md              (战略原版)
│   │   ├── REVISED_STRATEGY.md      ⭐ (基于客户会议修正)
│   │   ├── TRUTH_AUDIT.md           (4 路审计真相合成)
│   │   ├── EXECUTION_PLAN.md        (Phase 0-3 执行计划)
│   │   └── BORROW_LIST.md           (71 项借鉴清单, 含工时)
│   └── v2 高强度审计 (8 轮第 6 + 第 7 轮):
│       ├── MASTER_AUDIT_1_CRITICAL.md   (批判 review, 23 问题)
│       ├── MASTER_AUDIT_2_CROSSCHECK.md (24 份证据交叉核对, 10 脱钩)
│       ├── MASTER_AUDIT_3_FEASIBILITY.md (工时可行性, 30+ 问题)
│       └── REDLINE_AUDIT.md             (销售红线 4 → 2)
│
├── 04-最终决策/                     ← 给执行团队的清单 ⭐
│   ├── MUST_COPY.md                ⭐ (业务功能 18 项必抄)
│   └── UX_BORROW.md                ⭐ (UI/UX 23 项借鉴)
│
└── 05-处理脚本/                     ← 可复用工具
    ├── transcribe.py                (Whisper 转写)
    ├── build_storyboard.py          (基础 storyboard)
    ├── build_storyboard_v2.py       (低分辨率优化版)
    └── build_storyboard_hd.py       (HD 版本)
```

---

## 🎯 三种使用场景

### 场景 A: 你要快速理解结论
→ 读 `00-MASTER-PLAN-v2.md` **§0 摘要 (3 分钟) + §9.1 ASAP 排期 (10 分钟)** — 13 分钟看完关键

### 场景 B: 你要给团队分配任务
→ 读 `04-最终决策/MUST_COPY.md` (18 项必抄) + `UX_BORROW.md` (23 项 UX)
→ 配合 `00-MASTER-PLAN-v2.md` §9 实施计划 (按周排期)

### 场景 C: 你要查具体证据
→ 客户原话: `01-客户档案/` 中 4 次会议
→ 宏见演示: `02-宏见演示素材/audio.txt` + `keyframes_hd/`
→ Cretas 代码状态: `03-审计过程/AUDIT_FRESH_C_CODE.md`
→ v2 高强度审计: `03-审计过程/MASTER_AUDIT_1/2/3.md + REDLINE_AUDIT.md`

---

## 🔑 8 轮审计演进 (元层学习)

```
轮 1: REPORT.md           → 偏"总结演示讲了什么"
轮 2: REVIEW.md           → 偏"评审, 但仍乐观"
轮 3: AUDIT.md            → 硬证据, 但 subagent 表面扫描误判 7 处
轮 4: TRUTH_AUDIT         → 4 路 fresh-eyes, 找到 23 处不一致
轮 5: REVISED_STRATEGY    → 通读 4 次客户会议, 推翻 "AI 一句话替代万能"
轮 6: MUST_COPY/UX_BORROW → 三重过滤后的可执行清单
轮 7: MASTER-PLAN v1      → 12 章合成 (后发现 10 处错误)
轮 8: MASTER_AUDIT_1/2/3 + REDLINE_AUDIT → 高强度审计 60+ 问题, v2 + v2.1 修正全部
```

**核心元教训**:
1. **客户档案 > 竞品分析** — 4 会议 > 137 帧视频
2. **HD vs 压缩源差 15 倍信息密度** — 微信压缩误读 10+ 处
3. **"AI 替代 UI"是 PR 话术** — 业务流合规性不可压缩
4. **"实体存在"≠"功能可用"** — Label 有 QR 字段 ≠ 生产任务能生 QR
5. **每次声明都要 file:line 证据** — Subagent 表面扫描会误导
6. **声明 vs 实现可能已变** — sessionId / slot-filling 红线 fresh audit 发现已 ship
7. **27 个用户决策驱动** — v1 → v2 不是单一来源, 是多轮问答合成

---

## 📊 关键数字 (v2 + v2.1 修正后)

| 指标 | v1 (错) | **v2 + v2.1 (正)** |
|---|---|---|
| 宏见演示时长 | "17 分钟" | **23:32 视频 / 21:36 音频** |
| 宏见 12 模块 + 子模块数 | 280+ | 280+ (无变) |
| 宏见 UX 模式提取数 | 63 | 63 (无变) |
| 客户六扇门会议次数 | 4 | 4 (无变) |
| 客户需求条目数 | 47 (P0:18 / P1:17 / P2:10 / P3:2) | 47 (无变) |
| Cretas Tool 数 | "404 (低估 67)" | **404 (Audit B fresh 实测确认)** |
| Cretas Skill 数 | "32" | **18 默认 + 14 SKILL.md** |
| Cretas 餐饮 Tool 数 | "35+ 个独家" | **~80 个 (19.8%)** |
| Cretas Screen 数 | "100+" | **410 (v2 早期 4 倍低估)** |
| Cretas Entity 数 | "43" | **326 (88 root + 53 enums + 185 subdirs)** |
| Cretas 死代码 / Stub | 4 项 | **3 项** (sessionId 已 ship) |
| 销售话术红线 | 4 条禁 | **2 条解除 + 2 条仍禁** |
| 必抄项总数 (三重过滤后) | 18 业务 + 23 UX = 41 项 | 18 业务 + 23 UX = 41 项 (无变) |
| ASAP 范围工时 | 46d 名义 | **48d 名义 (+产品导入助手)** |
| 总工时估算 | "145 人天 / 6 月单人" | **真实 270d / Claude 加速 + 25% buffer = 30 周 ≈ 7 月** |
| AI 真替代占比 | "50%" 浪漫主义 | **12.2%** (Hybrid 主流) |
| Hybrid 占比 (UI 主+AI 辅) | 未识别 | **46.9% 主流** |
| 用户决策记录 | 0 | **27 个** (附录 E) |

---

## 📅 时间线

- **March-2026**: 客户第一次会议
- **2026-03-18**: 客户第二次会议 (放弃传统 ERP)
- **2026-05-07**: 客户第三次会议 (UI 测试)
- **2026-05-10**: 客户第四次会议 (BOM 测试)
- **2026-05-13**: 用户提供宏见演示视频 (微信压缩版)
- **2026-05-13**: 用户提供 HD 未压缩源
- **2026-05-13**: PR #596 ship SlotFilling LLM (sessionId / slot-filling 不再是死代码)
- **2026-05-14**: 完成 6 轮审计 + v1 MASTER-PLAN
- **2026-05-14**: 8 轮 fresh audit (高强度) + v2 + v2.1 amendments

---

## 🚀 v1 → v2 → v2.1 演进简要

### v1 (历史, 已废弃)
- 总工时 145 人天 / 6 月单人
- 销售红线 4 条禁说
- N# 编号混乱 (FINAL_A.N31 ≠ MUST_COPY.N31)
- 单主线 (没明确餐饮 + 食品厂)
- ASAP 排期模糊

### v2 (主要修正)
- 8 轮 fresh audit 发现 10 处错误
- 销售红线 4 → 2 (sessionId + slot-filling 已 ship)
- Phase 0 死代码 4 → 3
- N# 统一业务域前缀 (S/P/M/W/F/H/Q/C/U)
- 双主线明确 (餐饮 QHJ 10% 维护 + 食品厂 80% 主推)
- ASAP 按周详细排期 (Week 1-6)
- 工时按 Claude 1.7-2x 加速重算
- 实测 Tool 404 / Skill 18+14 / Screen 410 / Entity 326 / 餐饮 ~80

### v2.1 amendments (基于 27 个用户决策)
- Sprint 0 加产品导入助手 (+2d, 解决数据迁移 / 培训)
- 加 25% 风险 buffer
- 食品厂客户群高度一致 (六扇门 + 1-2 在谈)
- KPI 修正 (六扇门未成交状态, ASAP 后 30-60 天签约)
- 最终: 30 周 ≈ 7 个月单人

---

## ⚠️ 重要提示 (v2 新)

1. **v1 已 DEPRECATED** — 不要从 v1 执行, 工时低估 2 倍 + 红线过时 + N# 混乱
2. **REPORT/REVIEW/GAPS 也已 DEPRECATED** — 仅作历史
3. **MUST_COPY / UX_BORROW + v2 是最终决策** — 执行从这三份开始
4. **客户档案是绝对权威** — 当任何分析与客户原话冲突, 以客户原话为准
5. **27 个用户决策记录在 v2 附录 E** — 决策可追溯
6. **本次审计的 8 路并行 audit 在 `03-审计过程/`** — 共 28 份分析文档

---

## 📞 团队读法 (按角色)

| 角色 | 读什么 | 时长 |
|---|---|---|
| 老板 / 决策者 | v2 §0 摘要 + §8 战略 + 附录 A 销售话术 | 15 分钟 |
| 产品负责人 | v2 全篇 + MUST_COPY + UX_BORROW | 60 分钟 |
| 工程负责人 | MUST_COPY + UX_BORROW + v2 §9 实施计划 + 客户档案 | 90 分钟 |
| 销售负责人 | v2 §11 销售物料 + 附录 A 销售话术 + 客户档案第二次会议 | 45 分钟 |
| 工程师 | MUST_COPY 自己负责的项 + v2 §9.1 ASAP 按周排期 | 30 分钟 |

---

## 🎬 下一步行动

**即将启动 Week 1** (Sprint 0):
- Mon-Tue: N# 重编 + NUMBERING_MAP.md (2d)
- Wed-Fri: 双主线能力拆分表 (Tool/Skill/Screen/Entity 4 类 tag, 3d)

详细排期见 v2 §9.1。
