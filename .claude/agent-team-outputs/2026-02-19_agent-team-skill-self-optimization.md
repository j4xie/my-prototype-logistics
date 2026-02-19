# Agent-Team Skill 自身优化分析

**日期**: 2026-02-19
**模式**: Full | 语言: Chinese | Grounding: ENABLED

---

## 执行摘要

Agent-team skill 存在三类可操作优化空间：（1）**零成本高收益**——Integrator 模型从 Sonnet 换为 Opus，Critic 规则从强制异议改为"质疑OR验证"，max_turns 8→12，开发时间合计不超过 15 分钟；（2）**低成本结构改进**——统一压缩策略、Resume 降级规范、幻觉防护扩展，约 2 小时；（3）**高成本存疑项**——token 减少 25%、质量提升 30-40% 等量化收益缺乏基准数据，置信度低。系统已有 64 个输出、9 天稳定运行，改动应聚焦最高 ROI 项，避免过度工程化。

---

## 综合优先级排序（按 ROI）

| 排名 | 建议 | 开发时间 | 置信度 | 风险 |
|------|------|----------|--------|------|
| 1 | Integrator Sonnet→Opus | 5 分钟 | Medium | 极低 |
| 2 | Critic 规则改"质疑 OR 验证" | 5 分钟 | High | 极低 |
| 3 | max_turns 8→12（grounding 模式） | 5 分钟 | High | 成本略增 |
| 4 | Resume 降级输出规范 | 30 分钟 | High | 低 |
| 5 | 统一压缩策略 | 1 小时 | High | 需设计压缩格式 |
| 6 | 幻觉防护扩展至非 grounding 模式 | 30 分钟 | High | 低 |
| 7 | Analyst 工具权限明确化 | 15 分钟 | High | 低 |
| 8 | token 基准测量后再决定验证策略 | 先测量 | Low | — |
| 9 | Manager 角色独立研究 | 独立任务 | Low | — |

---

## 共识与分歧图谱

### 跨团队强共识（3/3 agent + Analyst + Critic 均确认）

| 编号 | 共识点 | 支持方 |
|------|--------|--------|
| C1 | 格式验证仅检查标记存在，无内容校验 | R-A、R-B、R-C、Analyst、Critic |
| C2 | Resume 机制仅一次，无降级输出规范 | R-A、R-B、R-C、Analyst |
| C3 | Critic 强制异议规则产生反模式 | R-A、R-C、Analyst、Critic |
| C4 | 压缩不对称（R→A 压缩，A→C 不压缩） | R-B、Analyst、Critic（修正表述） |
| C5 | max_turns=8 与 codebase grounding 需求冲突 | R-B、Analyst、Critic |

### 分歧点

| 编号 | 分歧点 | Analyst 观点 | Critic 观点 | 最终判定 |
|------|--------|-------------|-------------|---------|
| D1 | Token 减少 25% | High confidence | 无基准，Low | **Low** — 需先测量 |
| D2 | 质量提升 30-40% | High confidence | 不可验证，Low | **Low** — 不可证伪 |
| D3 | 角色边界模糊 | 是关键问题 | 代码验证否定，问题是工具权限 | **工具权限问题** |
| D4 | 三重数据叠加 | 严重 token 峰值 | 修正为一压缩+两全量 | **Medium** — 存在但被夸大 |
| D5 | Manager 是最关键瓶颈 | 未提及 | Critic 独有发现 | **Low** — 未验证 |
| D6 | Integrator 用 Sonnet 是瓶颈 | 未提及 | 最高 ROI 候选 | **Medium** — 需 A/B 测试 |

---

## 最终置信度评估

| 发现 | 置信度 | Evidence Basis |
|------|--------|----------------|
| 格式验证不检查内容（C1） | **High** | 仅代码验证 |
| Resume 仅一次无降级（C2） | **High** | 仅代码验证 |
| Critic 强制异议产生反模式（C3） | **High** | 代码验证+外部共识 |
| 压缩不对称（C4） | **Medium** | 仅代码验证（表述已修正） |
| max_turns=8 不足（C5） | **High** | 代码验证+外部共识 |
| Integrator 用 Sonnet 是瓶颈（D6） | **Medium** | 仅外部来源 |
| Token 减少 25%（D1） | **Low** | 仅外部来源 |
| 质量提升 30-40%（D2） | **Low** | 仅外部来源 |
| 角色边界模糊（D3） | **Low**（已否定） | 仅代码验证（Critic 推翻） |

---

## 可操作建议详情

### P0 — 零成本，立即执行

#### [局部修改] 1. Integrator 模型从 Sonnet 换为 Opus
- **位置**: SKILL.md Phase 4 的 Task 调用配置
- **理由**: Integrator 负责跨团队冲突仲裁和信心评估，是最终综合节点。Sonnet 在多源推理上存在结构性劣势。改一个单词、0 开发时间。
- **风险**: 成本略增，无质量下降风险

#### [局部修改] 2. Critic 规则从"必须异议"改为"质疑 OR 验证"
- **位置**: `.claude/agents/critic.md` 第 63 行
- **当前**: `You MUST disagree with at least 2 major points — even if you have to play devil's advocate`
- **建议改为**: `You MUST critically examine at least 3 major claims. Challenge those with weak evidence; for well-supported claims, explicitly verify and explain why the evidence is convincing. Do NOT generate disagreements without substantive grounds.`
- **风险**: 极低

#### [局部修改] 3. max_turns 从 8 提升至 12（仅 grounding 模式）
- **位置**: SKILL.md Phase 1 Researcher prompt template
- **理由**: Codebase grounding 需 2-3 turns 读代码，当前 8 turns 仅剩 5 用于 web search
- **建议**: 条件化——`max_turns: CODEBASE_GROUNDING ? 12 : 8`

### P1 — 低成本（1-2 小时）

#### [局部修改] 4. Resume 失败降级输出规范
- **位置**: SKILL.md 所有 Output validation 段
- **当前**: "resume once; if still empty, note the gap and proceed"
- **建议改为**: "resume once with feedback about what's missing; if second attempt also fails, extract any partial content from the response, mark as [PARTIAL], and pass downstream with a quality warning"

#### [局部修改] 5. 统一压缩策略
- **位置**: SKILL.md Phase 3 (Critic) 和 Phase 4 (Integrator)
- **建议**: Analyst 输出压缩格式保留 `{claim, evidence_ref, priority, confidence}` 结构
- **保留原文**: Decision Framework 和 Risk Assessment 不压缩（Critic 需要这些做验证）

#### [局部修改] 6. 幻觉防护扩展至非 grounding 模式
- **位置**: researcher.md 的 Rules 部分
- **建议添加**: "对于 web 来源的 finding，必须标注来源类别（官方文档/博客/论文/社区讨论），★★☆以下的来源必须注明'低可靠性'"

#### [局部修改] 7. Analyst 工具权限明确化
- **位置**: analyst.md 的 Tools Available 部分
- **当前**: `You should use: Read, Grep, Glob (read-only analysis — do NOT modify files)`
- **建议添加**: "当 Codebase Grounding 启用时，可使用 Read/Grep 验证 Researcher 引用的代码片段，但不启动新的 grounding 轮次"

### P2 — 存疑/后续

#### [无需代码改动] 8. 建立 token 消耗基准
- 在 5 次 Full mode 运行中记录各阶段 token 消耗，再决定是否引入 SELF-REFINE 等重量级模式

#### [架构级] 9. Manager 角色优化
- Critic 指出 Manager（SKILL.md 本身）可能是最关键瓶颈（mode 选择、数据传递、格式验证）
- 建议作为独立 agent-team 研究课题

---

## 开放问题

1. Integrator 模型替换的实际质量差异需要 A/B 对比测试
2. Analyst 输出压缩后 Critic 能否有效工作？需要设计具体压缩格式
3. Quick 模式锚定效应的实际影响未量化
4. 并行 Researcher 信息孤岛问题是否值得引入协调器
5. Critic 的"sufficient challenge"判断标准需要可操作定义

---

## Researcher 原始发现

### Researcher A: Prompt 工程 + 角色定义

1. [★★★★★] 格式验证仅检查标题标记存在，无内容字段数/表格行数/必填列校验 — SKILL.md:101-104
2. [★★★★★] Researcher "Don't analyze" vs Analyst "Cite findings" — 实际是工具权限问题非角色边界
3. [★★★★★] 4 个 agent prompt 均无 few-shot 完整填写范例 — 所有 agents/*.md
4. [★★★★★] 幻觉防护仅在 Codebase Grounding 模式生效 — researcher.md:75
5. [★★★★★] Output validation 单次 resume，无二次校验 — SKILL.md:104,152,238,275
6. [★★★★★] Codebase Grounding 依赖约 20 个固定关键词白名单 — SKILL.md:31-37
7. [★★★★★] Quick mode Analyst+Critic 合并存在锚定效应 — SKILL.md:156-188
8. [★★★★★] Critic 强制异议规则可能产生形式反对 — critic.md:63

### Researcher B: 工作流效率 + 错误处理

1. [★★★★★] Resume 仅一次，无降级输出规范 — SKILL.md:309
2. [★★★★★] 压缩不对称：R→A 压缩，A→C 不压缩 — SKILL.md:110-138,208-216
3. [★★★★★] Integrator 接收一压缩+两全量数据 — SKILL.md:254-257
4. [★★★★★] 超时处理无具体标准 — SKILL.md:308
5. [★★★★★] Quick/Full 模式切换纯主观 — SKILL.md:41-46
6. [★★★★★] max_turns=8 vs codebase grounding 前 2-3 turns — SKILL.md:71
7. [★★★★★] 并行 Researcher 无冲突检测 — SKILL.md:140-144
8. [★★★★☆] 外部：验证阶段消耗 72% token — openreview.net

### Researcher C: 输出质量控制 + 业界实践

1. [★★★★★] 唯一验证是格式标记+单次 resume — SKILL.md:104,152,275
2. [★★★★★] 线性流水线无回溯 — SKILL.md:24-280
3. [★★★★☆] AutoGen Validation Agent 模式 — arxiv:2308.08155
4. [★★★★★] SELF-REFINE 迭代提升质量 — openreview
5. [★★★★☆] Bag of Agents 反模式 17x 错误放大 — Towards Data Science
6. [★★★★☆] CIR3 独立否决权达最高评分 — ScienceDirect

---

## Critic 代码验证

| # | Analyst 声明 | 检查文件 | 实际发现 | 判定 |
|---|-------------|---------|---------|------|
| 1 | 格式验证仅检查标题标记 | SKILL.md:104,152,238,275 | 四处均为字符串存在性检查 | ✅ 确认 |
| 2 | 压缩不对称 | SKILL.md:110-137 vs 209-215 | R→A 压缩确认；A→C 不压缩确认；但 Integrator 收到的是一压缩+两全量，非三重全量 | ⚠️ 部分正确 |
| 3 | Integrator 三重叠加 | SKILL.md:253-262 | 一压缩+两全量，"三重叠加"表述夸大 | ⚠️ 部分正确 |
| 4 | Critic MUST disagree 2 points | critic.md:63 | 确认原文包含"even if you have to play devil's advocate" | ✅ 确认 |
| 5 | 角色边界模糊 | researcher.md:80, analyst.md:66 | 分工定义清晰，问题是工具权限 | ❌ 不准确 |
| 6 | max_turns=8 | SKILL.md:71 | 确认仅 Researcher 阶段设置 | ✅ 确认 |

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Total sources found: 16+ (11 codebase, 5+ external papers)
- Key disagreements: 4 resolved, 2 unresolved
- Phases completed: Research → Analysis → Critique → Integration
