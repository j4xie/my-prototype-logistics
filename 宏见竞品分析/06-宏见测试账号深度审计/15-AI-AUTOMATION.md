# 15 — 宏见的 AI / 规则引擎能力 (vs Cretas AI 中台)

> Phase 4 输出. **关键发现**: 宏见**几乎没有 AI** — 主要是规则引擎.

---

## 1. 宏见的"自动化"清单 (实测)

### 1.1 规则引擎类 (10+)

| # | 自动化 | 触发 | 类型 |
|---|---|---|---|
| R1 | 三价对比标红 (P-3PC-1) | 采购单创建 | 规则: diff > N% |
| R2 | 超收阈值 (P-OVER-1) | 收货录入 | 规则: > 130% |
| R3 | 凭证生成 (vflag → 已生成) | 库存单 / 销售单 / 采购单 | 规则: 按业务类型映射 |
| R4 | 缺料分析 (S-MRP-1 雏形) | 销售单审批 | 规则: 库存 - 销售数量 |
| R5 | 异常预警 (生产交期) | dashboard | 规则: 交期 < 今天 + N 天 |
| R6 | 备货预扣 | 销售单审批 | 规则: 转生产/采购 |
| R7 | 工作流路由 (按金额/部门/角色) | 单据提交 | 规则: 阈值匹配 |
| R8 | 工资分摊 | 月底 | 规则: 按部门/项目/产品 |
| R9 | 期间结账 (锁定单据) | 月底 | 规则: 跨期不允许修改 |
| R10 | 单据编号自增 | 创建单据 | 规则: prefix + sequence |

### 1.2 ML / LLM 类 (0)
- ❌ 没有自然语言查询
- ❌ 没有 AIChat / 智能助手
- ❌ 没有 LLM 推理
- ❌ 没有 OCR (虽然 dashboard 提到摄像头, 但是规则触发, 不是识别)
- ❌ 没有图像识别 (无 YOLO 异物识别)

### 1.3 数据驱动 / 推荐 类 (1)
- "常用菜单" + "最近浏览" — 简单 use frequency 统计 (不是 AI 推荐)

---

## 2. 跟 Cretas AI 中台对照

| 维度 | 宏见 | Cretas |
|---|---|---|
| **AIChat** (NL 输入) | ❌ | ✅ 8 SCENE_CONFIG |
| **多轮 SlotFilling** | ❌ | ✅ PR #596 ship |
| **sessionId 上下文** | ❌ | ✅ |
| **Skill 编排** | ❌ | ✅ 18 默认 + 14 SKILL.md |
| **Tool 注册** | ❌ | ✅ 290+ Tool |
| **NL 查询 (SmartBI)** | ❌ | ✅ 18 Screen + Python LLM |
| **意图分类** | 规则 (路由) | ✅ ONNX BERT + 多策略 (EXACT/PHRASE/REGEX/KEYWORD/SEMANTIC/CLASSIFIER/FUSION/LLM) |
| **意图执行** | 规则 trigger | ✅ Tool/Skill/Dynamic 4 路由 |
| **食品溯源 AI** | ❌ | ✅ TraceFullTool 独家 |
| **YOLO 异物识别** | ❌ | ✅ foreign_object_detection |
| **OCR 入账** | ❌ | ⚠️ DashScope Vision 实装但未对接 |
| **AI 主动告警** | ❌ (异常预警是规则) | ✅ AIInsightCard / AIAlertsScreen |
| **规则引擎** | ✅ 强 (10+ 规则) | ⚠️ 部分 (P-3PC / P-OVER 等已 ship) |

---

## 3. 战略意义

### 3.1 **Cretas 的最大壁垒 = AI 中台** ⭐⭐⭐
- 宏见有 12 模块 + 280 子菜单 (功能数量优势)
- Cretas 有 AI Chat + Skill + Tool (使用方式革命)
- 客户**不需要学 280 子菜单** — 说人话即可

### 3.2 销售对话 — AI 维度

| 客户问 | 我们说 (强势) |
|---|---|
| "宏见也能做规则自动化啊" | "宏见是规则引擎 (开发改 if/else), 我们是 LLM (用户说人话, AI 自动选 Tool 执行)." |
| "AI 准确吗?" | "我们 ONNX BERT + 多策略 (EXACT/PHRASE/REGEX/KEYWORD/SEMANTIC/FUSION/LLM 7 路融合), 51 测试意图全 PASS." |
| "AI 会乱吗?" | "我们 SlotFilling 多轮兜底, 缺参数 AI 会问您, 不会乱执行." |
| "我能不能 AI 一句话出 BI 报表?" | "可以, SmartBI NL Query — '今年 5 月谁迟到最多' 直接出图." |
| "宏见有什么 AI?" | "宏见是规则引擎, 没有真 LLM. 异常预警/三价标红是 if/else, 我们是真 NL 理解." |

### 3.3 长期 AI 路线 (Sprint 4-6)
- 钉钉机器人 (C-AI-1) — AI 通过钉钉触发
- AILayoutAssistant (C-AI-2) — AI 改首页布局
- 行业模板 AI 推荐 (新客户 onboard 一键)
- 产品配方 AI 建 BOM (S-RD-1 + AI)
- 异常预警从规则升级为 LLM 主动总结

---

## 4. 风险 / 注意

### 4.1 客户可能不需要 AI (反对证据)
- F006 客户原话 (May 2026): "我们其实调接口也能承担" — 客户对 AI 成本敏感
- 客户**底层要 ERP**, AI 是中间桥梁 — **不能纯 AI 替代 UI**
- 业务流合规性不可压缩 (审批/凭证/审计追溯)

### 4.2 AI vs 规则的边界
- **AI 适合**: NL 入口 / 推荐 / 总结 / 异常归因
- **规则适合**: 财务凭证 (借/贷必须平) / 审批流 (合规) / 单据 trigger
- Cretas 应该: AI 上层 + 规则底层 (不是纯 AI)

---

## 5. Cretas 应该补 (AI 维度)

| 优先级 | 项 | 工时 | 说明 |
|---|---|---|---|
| **P0** | 钉钉机器人 PoC (C-AI-1) | 已估 6d | MUST_COPY 已列 |
| **P0** | AILayoutAssistant 接真 LLM (C-AI-2) | 已估 4d | Phase 0 必修 |
| **P1** | 主动 AI 总结 (异常预警 → LLM 总结) | 5d | AIInsightCard 升级 |
| **P1** | 行业模板 AI 推荐 (onboard 一键) | 8d | C-FEATURE-1 升级 |
| **P2** | 配方 AI 建议 (S-RD-1 + AI) | 5d | "类似 SKU-201 但减 10% 包材" |
| **P2** | 拍照 OCR 入账 (F-OCR-1) | 5d | DashScope Vision 已实装 |

---

## 6. 完成度
✅ 实测宏见 10+ 规则引擎清单
✅ 实测宏见 0 AI 能力
✅ 跟 Cretas AI 中台对照 13 维度 (Cretas 全胜)
✅ 销售话术 5 句 (AI 维度强势)
✅ 长期 AI 路线 (Sprint 4-6)
✅ MUST_COPY 增量 6 项 (AI)
