# Canvas 安全 E2E 套件 65/65 PASS 基线独立质量审计 — Final Integrated Report

**审计日期**: 2026-04-13
**审计对象**: `tests/canvas-security-e2e/` 65 测试基线
**审计深度**: Researcher×3 (度量 / 证据 / 角色) → Analyst → Critic → Integrator
**输出语言**: 中文

---

## Final Integrated Report

### Executive Summary

- **Recommendation**: 将 "65/65 PASS" 基线从"交付完成"降级为"首轮通过,待质量硬化",执行 R1 硬化 (1-2 周)。不全盘推翻 Analyst 结论,但按 Critic 代码验证修正部分过激判断。
- **Confidence**: 中高 (Critic 的代码级反驳在多处有具体 file:line 引用,权重优先于 Analyst 的静态统计推断)
- **Key Risk**: run-all.sh 的 PASS_COUNT 计数逻辑 + J1 Phase C Canvas 模块启停真实缺口,是"65/65"口径唯一真正脆弱的两点
- **Timeline Impact**: R1 硬化 5-7 天 (比 Analyst 原估 10-14 天缩短,因 J3 S5-S9 / 3 处 @RequireRole 被 Critic 合理排除)
- **Cost/Effort**: 低-中。无需重写套件,只需修正计数 + 补 J1 Phase C + 澄清 evidence 格式约定

---

### Consensus & Disagreements

| Topic | Researcher | Analyst | Critic | Final Verdict |
|-------|-----------|---------|--------|--------------|
| **测试计数** 59 unique vs 65 声称 | R-A 发现 59 唯一 ID + 多处循环/重复 ID 膨胀 | P0: 修正 65→59 | 同意有膨胀,但实际 log 调用 220-262,不是 Analyst 说的 "≤40 真实 PASS" | **共识**: 口径需修正, run-all.sh 的 PASS_COUNT 逻辑有 bug (混淆 journey count 和 assertion count);但不必降到 ≤40 |
| **results/ JSON 缺失** | R-A: "全部不存在" | P0: 必须落盘 + CI artifact | `.gitignore:164` 明确排除, **设计决策** | **Critic Override**: 不是 bug 是 gitignore 设计。但 Analyst 的 "CI artifact 上传" 建议仍有价值 (部分采纳) |
| **J3 S5-S9 缺失** | R-A: 11 未实现任务中的 5 个 | P0: 补齐 (Fix 14 唯一正向路径) | `j3-consumer.mjs:12-17` 文件头主动跳过,Fix 14 主验证在 **J1-B2**,不是唯一路径 | **Critic Override**: Analyst 对 "唯一路径" 的判断基于错误假设。J3 S5-S9 不补,保持现状 |
| **3 处 @RequireRole 裸奔** | R-C: FeatureConfig PUT + sub-table CRUD + custom-fields PUT + ConfigChangeSet GET 无注解 | P0: 全部补注解 | sub-table 有 `verifyParentOwnership` 兜底 + custom-fields PUT 有 factory_id 同厂拦截 + FeatureConfig 被 `JwtAuthInterceptor:178-184` 跨租户挡住 | **Critic Override (部分)**: 同厂内越权风险降为"中",非"高"。FeatureConfig **不属于 Canvas 安全 commit `8d3755222` scope**。列入独立 roadmap |
| **Evidence 结构化 0/183** | R-B: log 签名是 `evidence: string`, 纯字符串拼接 | P0: 结构化 JSON | 未直接反驳 | **共识**: 确为弱点。但严重性中等,非阻断 |
| **J1 Phase C 缺失** | R-A: 6 任务完全未实现 | P0: 补齐 | 同意, 这是真实 gap | **3 方共识**: Canvas 模块启停 0% E2E 覆盖,必须补 |
| **WARN 计 PASS** | R-A: 在 PASS_COUNT 里 | P0: WARN 不应计 PASS | 未直接反驳 | **共识**: run-all.sh PASS_COUNT 统计口径有 bug |
| **permission_admin @Deprecated 从未测** | R-C: 仍持有 Canvas 写权限 | 列入 MUST-FIX | 未涉及 | **Researcher 原发现**: 中等优先级,短期处理 |
| **角色覆盖 4/20 = 20%** | R-C 统计 | 列入质量问题 | 未直接反驳 | **共识**: 覆盖率偏低,但与 Canvas 写场景相关的关键角色已覆盖,不是阻断 |

---

### 详细分析

#### 1. "65/65 PASS" 口径真伪

**Evidence For 质疑 (R-A + Analyst)**:
- 59 unique test IDs,声称 65 → 至少 6 处循环展开 / ID 重复
- J1-A3 循环展开 ×7 (+6), D2-pub/D3-pub +2, J2-7c +1, J4-6b/SETUP-B/SETUP-SO +3
- PASS_COUNT 可能把 WARN 计入

**Evidence Against 一刀切降级 (Critic)**:
- 实际 log 调用 ~220-262 次 (远超 "≤40 真实 PASS")
- "65" 是 journey 粒度的累加,不是每个 assertion 粒度
- run-all.sh 的 PASS_COUNT 逻辑 bug 是**具体可修**的,不等于"套件注水"

**Net Assessment**:
- Analyst 的 "≤40 PASS" 数字缺实证 (Critic 在代码里找不到支撑 ≤40 的证据)
- 但 run-all.sh PASS_COUNT 计数逻辑确实有 bug,需修
- **结论**: 口径从 "65/65" 改为 "59 测试 ID / 实际执行 ~65 次 (含重复) / X PASS + Y WARN + Z SKIP",不是降到 40

#### 2. results/ JSON 落盘

**Evidence For (R-A + Analyst)**:
- 找不到任何 JSON 产物
- CI 无法复跑或归档

**Evidence Against (Critic)**:
- `.gitignore:164` 主动排除 results/ 目录 — 设计决策
- 本地测试产物不入库是合理约定

**Net Assessment**:
- Analyst 对 "JSON 落盘到 Git" 判断错误 (Critic 正确)
- 但 **CI 跑起来时应上传 artifact** (JUnit XML / 日志文件 ZIP 归档) 的建议仍成立
- **分层处理**: 本地跑不需要, CI 集成时必须

#### 3. J3 Consumer S5-S9 是否为 Fix 14 唯一路径

**Evidence For (Analyst)**:
- J3 S5-S9 被编号在套件里,看起来"应该实现但被跳过"
- Fix 14 (某关键验证) 被 R-A 列为需要的正向路径

**Evidence Against (Critic)**:
- `j3-consumer.mjs:12-17` 文件头**明确写出跳过这 5 个编号的理由**
- Fix 14 的主验证在 **J1-B2**,J3 S5-S9 只是补充负向路径
- Analyst 的 "唯一正向路径" 结论基于对套件结构的错误解读

**Net Assessment**:
- **Critic Override**: Analyst 的判断有代码级反证
- J3 S5-S9 不补,保持 j3-consumer.mjs:12-17 的当前跳过状态
- 但需在 EVIDENCE.md 里明确说明"为什么跳过"避免后续审计误判

#### 4. 3 处 @RequireRole "裸奔" 严重性

**Evidence For 严重 (R-C)**:
- FeatureConfigController.PUT 无 @RequireRole (代码级确认)
- sub-table CRUD / custom-fields PUT / ConfigChangeSet GET 均无 @RequireRole

**Evidence Against 全面降级 (Critic)**:
- **跨租户**: 被 `JwtAuthInterceptor:178-184` 挡住
- **同厂内越权**: 成立,但有 `verifyParentOwnership` 兜底和 factory_id 拦截
- FeatureConfig 不在 Canvas 安全 commit `8d3755222` scope 内 (该 commit 明确只含 V3 动态字段 / 变更集 / 模板 / AI / cron)
- permission_admin @Deprecated 但仍持写权限是独立问题

**Net Assessment**:
- Researcher 的"代码级缺注解"发现**正确**
- Analyst 的"P0 立即补"判断**过激**
- **Critic Override (部分)**: 同厂内越权是"中"不是"高"
- **处理方式**:
  1. FeatureConfig 列入独立 roadmap (非本次 Canvas E2E scope)
  2. sub-table / custom-fields / ConfigChangeSet 三处: 在 J5 L3 增加 RBAC E2E 测试验证兜底机制生效; 补 @RequireRole 作为纵深防御第二道 (优先级 P1 非 P0)

#### 5. Evidence 结构化 (183 条 0% JSON)

**Evidence For 弱点 (R-B + Analyst)**:
- log() 函数签名 `evidence: string`
- 整套 0/183 = 0% 结构化
- 只有 J4-4 例外 (含 JSON.stringify)

**Evidence Against 阻断 (Critic 未反驳)**:
- 无代码级反证

**Net Assessment**:
- **共识**: 是弱点
- 严重性评估: 中 — 影响二次审计可读性,不影响测试正确性
- **处理方式**: R1 中期目标 (非立即),添加 `evidenceJson?: object` 可选字段,新增测试强制用结构化,旧测试保留字符串

---

### Confidence Assessment

| Conclusion | Confidence | Based On | Evidence Basis |
|-----------|------------|----------|----------------|
| run-all.sh PASS_COUNT 计数逻辑有 bug (需修) | ★★★★★ | 3 方共识, R-A 有 ID 级别证据 | 代码验证 + 外部共识 |
| J1 Phase C Canvas 模块启停 0% 覆盖 | ★★★★★ | 3 方共识, 无反驳 | 仅代码验证 |
| results/ 本地 JSON 不需要落盘 (gitignore 设计) | ★★★★☆ | Critic 引用 `.gitignore:164` 推翻 Analyst | 代码验证 |
| CI 跑起来时需归档 artifact | ★★★★☆ | Analyst 建议合理, Critic 未反对 | 外部共识 |
| "≤40 真实 PASS" 数字不支撑 | ★★★★☆ | Critic 找不到证据链, 实际 log 220-262 | 代码验证 |
| J3 S5-S9 不补 (保持 j3-consumer.mjs:12-17 跳过) | ★★★★☆ | Critic 引用文件头注释推翻 Analyst | 代码验证 |
| FeatureConfig 不在 Canvas E2E scope | ★★★★☆ | Critic 引用 commit `8d3755222` 明确边界 | 代码验证 |
| 3 处 @RequireRole 同厂内越权是"中"风险 | ★★★☆☆ | Critic vs Researcher 对严重性分歧 | 代码验证 + 评估分歧 |
| Evidence 结构化改造是中期目标 | ★★★☆☆ | Analyst 的 P0 降为 P1/P2 | 外部共识 |
| permission_admin @Deprecated 仍持权限 | ★★★☆☆ | R-C 独家发现, 未被其他方验证 | 仅代码验证 |

---

### Actionable Recommendations

**修订立场**: 基于 Critic 代码验证结果,R1 Action List 不采纳 Analyst 全部 Top 5 P0,以下标注 [Consensus] 或 [Critic Override]。

#### Immediate (本周内, 必做)

1. **[Consensus] [局部修改] 修正 run-all.sh PASS_COUNT 计数逻辑**
   - 诊断 "65 vs 59 unique" 差异
   - 确保 WARN 不计入 PASS (Analyst 原 MUST-FIX #5, 共识保留)
   - 输出 `X PASS + Y WARN + Z SKIP` 格式
   - 预估 2-4 小时

2. **[Consensus] [局部修改] 补 J1 Phase C Canvas 模块启停 E2E**
   - 3 方共识真实 gap
   - 覆盖 Canvas 编辑器 enable/disable 工厂级开关路径
   - 预估 1-2 天

3. **[无需代码改动] 在 EVIDENCE.md 增加"为什么跳过"文档**
   - 解释 J3 S5-S9 跳过原因 (引用 j3-consumer.mjs:12-17)
   - 解释 `.gitignore:164` 为何排除 results/
   - 预估 1 小时

#### Short-term (本月内, 应做)

4. **[Critic Override] [局部修改] sub-table / custom-fields / ConfigChangeSet 补 @RequireRole**
   - 作为纵深防御第二道,非 P0 阻断
   - 同厂内越权兜底机制已有,但显式注解更清晰
   - 在 J5 L3 同步增加 RBAC E2E 验证兜底生效
   - 预估 0.5-1 天 (含测试)

5. **[局部修改] CI artifact 归档**
   - 在 CI 配置里上传 results/*.json 和日志文件为 artifact
   - 本地运行仍按 gitignore 不入库 (不违反 Critic 认定)
   - 预估 2-4 小时 (取决于 CI 平台)

6. **[局部修改] log() 签名扩展 `evidenceJson?: object`**
   - 新增测试强制结构化,旧测试保留字符串
   - 作为可选字段,不破坏现有 183 调用
   - 预估 4-8 小时

#### Conditional (视情况)

7. **[架构级] 如把 FeatureConfig 纳入 Canvas 安全 scope, 则补 @RequireRole + J5 L3 测试**
   - 当前 Critic 认定不在 scope (`commit 8d3755222` 明确边界)
   - 如 PM 决定扩 scope, 则升级为 P0
   - 预估 1-2 天

8. **[局部修改] permission_admin @Deprecated 角色确认**
   - 如仍在使用 → 补 E2E 测 Canvas 写场景
   - 如确认弃用 → 在代码里移除权限或彻底清理
   - 预估 2-4 小时 (含决策沟通)

#### 明确拒绝 (Critic Override)

- ❌ **不补 J3 S5-S9**: Critic 代码级验证推翻 Analyst "唯一正向路径" 判断
- ❌ **不把 "65/65" 降到 "≤40"**: Analyst 数字缺支撑, 实际 log 220-262
- ❌ **不要求 results/ JSON 提交到 Git**: `.gitignore:164` 设计决策
- ❌ **不把 FeatureConfig 作为 Canvas E2E P0**: commit `8d3755222` scope 边界明确

---

### Open Questions

1. **run-all.sh PASS_COUNT 的具体计数公式是什么?** — 需查看 shell 脚本,确认 bug 源头 (是 grep 条件错还是 sum 逻辑错)
2. **FeatureConfig 是否应扩入 Canvas 安全 scope?** — 需 PM 决策,影响 R1 是否升级 `[Conditional] #7`
3. **permission_admin @Deprecated 真实使用情况?** — 需业务侧确认是否还有客户在用
4. **CI 平台是什么?** — 影响 artifact 归档方案 (GitHub Actions / GitLab / 自建)
5. **`verifyParentOwnership` 在 sub-table 全部 CRUD 路径都生效吗?** — Critic 引用但未全量验证,需 spot check
6. **Canvas 安全 scope 的正式文档在哪里?** — commit `8d3755222` message 是唯一来源, 建议写入 ADR 避免再次爭议

---

### Methodology Note

- **Researchers deployed**: 3 (R-A 度量膨胀 / R-B 证据厚度 / R-C 角色覆盖)
- **Sources consulted**: tests/canvas-security-e2e/ 全量代码 + .gitignore + 多个 Controller Java 源码 + JwtAuthInterceptor + commit 8d3755222 diff
- **Key disagreements resolved**: 5
  1. "≤40 PASS" (Critic Override)
  2. J3 S5-S9 (Critic Override)
  3. results/ JSON 落盘 (Critic Override)
  4. FeatureConfig 作为 Canvas scope (Critic Override)
  5. 3 处 @RequireRole 严重性 (P0 → P1, 部分 Critic Override)
- **Unresolved disagreements**: 1
  - permission_admin @Deprecated 的严重性 (仅 R-C 提及, 未充分交叉验证)
- **Confidence shifts after Critic**:
  - Analyst 原 5 个 MUST-FIX → Critic 认定仅 2 个真实必做 (#1 计数 + #2 J1-C)
  - 整体 P0 数从 5 降为 2,P1 从未列 → 3
- **最终 R1 策略**: 采纳 Critic 修订立场。R1 硬化 5-7 天 (非 Analyst 原估 10-14 天)

---

**报告保存位置**: `.claude/agent-team-outputs/2026-04-13_canvas-e2e-r1-audit.md`
