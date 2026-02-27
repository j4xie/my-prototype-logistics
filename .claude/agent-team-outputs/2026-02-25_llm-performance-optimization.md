# Cretas LLM 功能性能优化与 Bug 修复 — 最终综合报告

**日期**: 2026-02-25
**分析模式**: Full (3 Researchers + Analyst + Critic + Integrator)
**测试基准**: 26 端点测试，22 PASS / 4 FAIL / 8 SLOW

---

## 一、执行摘要

本项目共有 63+ 个 LLM 调用点，分布于 Java 后端和 Python SmartBI 两大模块。Java 端已优化至 1-3 秒响应，表现良好。核心瓶颈集中在 Python SmartBI 的 `insight_generator`（单次调用 50-90 秒）和 `chart_recommender` 等模块，主因是 Tier 2 级任务统一使用 qwen3.5-plus 高成本模型。同时存在 3 个确认的工程 Bug（D5 钻取逻辑错误、G2 会话表缺失、J1 字段名不匹配）需修复。建议通过模型分级降级 + Bug 修复双线推进，可实现 SmartBI 端到端延迟降低 40-60%。

---

## 二、团队共识与分歧

### 共识项（高置信度）

| 编号 | 共识内容 | 置信度 |
|------|---------|--------|
| C1 | Java 端 LLM 性能已良好（1-3s），无需优先优化 | 95% |
| C2 | Python SmartBI 是性能瓶颈，`insight_generator` 是最慢调用点 | 95% |
| C3 | D5 Bug（`routes.py` L223 `child_dimension=request.dimension`）确认存在 | 90% |
| C4 | G2 Bug（`conversation_sessions` 表 DDL 仍为 MySQL 语法）确认存在 | 90% |
| C5 | `chart_recommender` 已有内存缓存（MD5 hash, TTL 3600s）| 95% |
| C6 | `unified_analyzer.py` Phase 3 已实现 `asyncio.gather()` 并行 | 98% |

### 分歧项及裁定

| 分歧 | Analyst 观点 | Critic 观点 | 裁定 |
|------|-------------|-------------|------|
| O1 flash 提速幅度 | 3-5x | 2-4x，JSON 解析失败率可能上升 | **采纳 Critic: 2-4x（60% 置信度）**，需 A/B 验证 |
| O4 enrichSheet 并行化 | P1 优先 | 已实现（`asyncio.gather` L461-473），建议无效 | **采纳 Critic: 删除 O4** |
| "无重试机制"评估 | 全局缺失 | `insight_generator` 已有完善重试，其他模块确实缺失 | **部分正确**：按模块逐一补充 |
| G2 优先级 | ICE=1000（最高） | 降至 500，Layer 5 边缘路径 | **采纳 Critic: 降至 500** |

---

## 三、最终置信度评估

| 建议项 | 修正置信度 | 修正理由 |
|--------|-----------|---------|
| O1: insight 换 flash 模型 | **60%** | flash 中文结构化 JSON 输出质量未验证，需 A/B |
| O2: Prompt 压缩至 2000 token | **70%** | 压缩空间存在但需保留核心指令 |
| O3: chart 相关调用换 turbo | **75%** | 已有缓存，首次调用受益 |
| ~~O4: enrichSheet 并行化~~ | ~~5%~~ | **删除：已实现** |
| O5: backoff + RPM 感知 | **70%** | insight_generator 已有重试，其他模块缺失 |
| O6: LLM 缓存 | **65%** | chart_recommender 已有，insight_generator 需补充 |
| D5: 钻取 child_dimension Bug | **90%** | 代码确认，两处独立路径 |
| G2: conversation_sessions 表 | **85%** | DDL MySQL 语法确认 |
| J1: fieldName vs name | **55%** | 需追踪完整调用链确认 |

---

## 四、可执行建议

### 立即执行（本周内）

#### P0: D5 — drill-down 500 错误修复（两处）

**文件 1**: `backend/python/smartbi/services/cross_analyzer.py` L282
```python
# 修复前
"measure_totals": {m: grouped[m].sum() for m in measures}

# 修复后
"measure_totals": {m: float(grouped[m].sum()) for m in measures}
```

**文件 2**: `backend/python/chat/api/routes.py` L219-226
```python
# 修复前
child_dimension=request.dimension,  # Same dimension, filtered

# 修复后 — 自动选择下级维度
# 参考 smartbi/api/chat.py L245-286 的 auto_detect_hierarchy() 逻辑
child_dimension=_auto_select_child(df, request.dimension),
```

#### P1: G2 — conversation_sessions DDL 重写

移除 MySQL 语法（COMMENT, INDEX 内联），使用 PG 标准语法：
```sql
CREATE TABLE IF NOT EXISTS conversation_sessions (
    session_id VARCHAR(36) NOT NULL PRIMARY KEY,
    factory_id VARCHAR(50),
    user_id BIGINT,
    session_mode VARCHAR(30),
    known_intent_code VARCHAR(100),
    required_parameters_json TEXT,
    collected_parameters_json TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_cs_factory_user ON conversation_sessions(factory_id, user_id);
CREATE INDEX idx_cs_status ON conversation_sessions(status);
```

### 短期执行（1-2 周内）

#### P1: O1 — insight_generator 模型降级

```python
# config.py 新增:
llm_insight_model: str = "qwen3.5-flash"

# generator.py L487 修改:
"model": self.settings.llm_insight_model,  # 替代 self.settings.llm_model
```
预期：延迟从 50-90s 降至 15-30s，成本降低 ~70%

#### P1: O5 — 补充重试机制（chart_builder, llm_mapper, scenario_detector）

```python
async def _call_llm_with_retry(self, prompt: str, max_retries: int = 3) -> str:
    for attempt in range(max_retries):
        try:
            return await self._call_llm(prompt)
        except (httpx.TimeoutException, httpx.HTTPStatusError) as e:
            if attempt == max_retries - 1:
                raise
            wait = min(2 ** attempt * 2, 30)
            await asyncio.sleep(wait)
```

#### P2: O3 — chart_recommender / field_detector 换 qwen-turbo

```python
# recommender.py L724:
"model": self.settings.llm_fast_model,  # qwen-turbo
```

### 条件执行

| 编号 | 前置条件 | 行动 |
|------|---------|------|
| O1-V | 部署 O1 后 | A/B 测试：10 个 Excel 同时用 plus 和 flash，对比 JSON 解析成功率和人工评分 |
| J1 | 加日志验证调用链 | 确认 fieldName → name 的转换发生在哪个层 |
| O6 | 确认重复分析频率 | 为 insight_generator 添加数据 hash 缓存 |

---

## 五、模型分级架构（建议目标态）

```
任务类型                    当前模型           建议模型           成本变化
─────────────────────────────────────────────────────────────────
字段检测 (detector_llm)    qwen3.5-plus      qwen-turbo        -85%
场景识别 (scenario)         qwen3.5-plus      qwen-turbo        -85%
图表推荐 (recommender)      qwen3.5-plus      qwen-turbo        -85%
字段映射 (llm_mapper)       qwen3.5-plus      qwen3.5-flash     -70%
洞察生成 (insight)          qwen3.5-plus      qwen3.5-flash*    -70%
跨 Sheet 分析 (cross)       qwen3.5-plus      qwen3.5-plus      不变
意图分类 (Java)             qwen3.5-plus      qwen3.5-plus      不变
视觉分析 (VL)               qwen-vl-max       qwen-vl-max       不变
深度推理 (Layer 4)          qwq-32b           qwq-32b           不变

* 需 A/B 测试验证后确认
```

---

## 六、开放问题

| 问题 | 影响 | 建议行动 |
|------|------|---------|
| DashScope 账号实际 RPM 配额？ | O5 退避参数设置 | 查 DashScope 控制台 |
| qwen3.5-flash 中文商业分析 JSON 质量？ | O1 可行性 | A/B 测试 |
| J1 调用链中 fieldName→name 转换点？ | 修复位置 | 加日志追踪 |
| insight_generator P95 延迟实测？ | 优化 baseline | 生产埋点 |

---

## 七、风险提示

1. **模型降级质量风险**：flash/turbo 在复杂中文财务分析场景下的结构化 JSON 输出稳定性未经验证。建议灰度发布，先对 20% 流量切换。
2. **D5 修复涉及两个独立代码路径**（`chat/api/routes.py` 和 `smartbi/services/cross_analyzer.py`），需同步修复。
3. **G2 DDL 需包含 Entity 中的 4 个新字段**（session_mode, known_intent_code, required_parameters_json, collected_parameters_json）。

---

## 八、关键文件索引

| 文件 | 路径 | 相关建议 |
|------|------|---------|
| SmartBI 配置 | `backend/python/smartbi/config.py` | O1, O3 |
| 洞察生成器 | `backend/python/smartbi/services/insight/generator.py` | O1, O2, O5 |
| 统一分析器 | `backend/python/smartbi/services/unified_analyzer.py` | O4（已并行） |
| 图表推荐器 | `backend/python/smartbi/services/chart/recommender.py` | O3, O6 |
| 跨维度分析 | `backend/python/smartbi/services/cross_analyzer.py` | D5b |
| 钻取路由(chat) | `backend/python/chat/api/routes.py` | D5 |
| 会话表 DDL | `backend/java/.../migration-pg-converted/V2026_01_06_10__conversation_sessions_table.sql` | G2 |
| 字段映射器 | `backend/python/smartbi/services/field/llm_mapper.py` | J1 |

---

### Healer Notes: All checks passed

### Process Note
- Mode: Full
- Researchers deployed: 3
- Browser explorer: OFF
- Total sources found: ~20 (codebase files + DashScope docs)
- Key disagreements: 4 resolved (O1 speed, O4 validity, retry scope, G2 priority), 1 unresolved (J1 root cause)
- Phases completed: Research → Analysis → Critique → Integration
- Fact-check: disabled (codebase-grounded topic)
- Healer: 5 checks passed, 0 auto-fixed
- Competitor profiles: N/A
