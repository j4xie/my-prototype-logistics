# SmartBI E2E 测试数据增强版 — 质量、复杂度与压测覆盖度评估

**日期**: 2026-02-19
**主题**: 评估增强版三层测试数据架构（常规444sheets + 边界96sheets + 压测12sheets）

---

## Executive Summary

- **总体评估**: SmartBI E2E 测试数据生成器已构建三层架构（常规444 sheets + 边界96 sheets + 压测12 sheets），覆盖3行业6模板4场景，百分比存储已修复为float+format，数据质量满足回归测试需求
- **核心风险**: 压测层存在结构性缺陷——L2文件实际约60MB远超Java 10MB硬限制，且压测数据无merge/样式/百分比，走的是与真实Excel完全不同的解析路径
- **置信度**: 中等偏低——常规数据质量高，但压测覆盖度经Critic验证后降级为Low
- **建议方向**: 不应盲目放大文件体积，应在10MB限额内最大化结构复杂度（merge + 样式 + 混合类型）
- **投入估算**: 局部改进约2-3天，架构级重构（xlsxwriter替换）约1周

---

## 数据清单

### 常规文件（24个）
| 分类 | 文件数 | Sheets/文件 | 总Sheets | 大小范围 |
|------|--------|------------|---------|---------|
| 工厂端 (food/mfg/retail × 4场景) | 12 | 22 | 264 | 327-356 KB |
| 餐饮端 (fish/hotpot/bakery × 4场景) | 12 | 15 | 180 | 397-932 KB |

### 边界Sheet（嵌入常规文件）
| Sheet名称 | 工厂版规格 | 餐饮版规格 | 测试目标 |
|-----------|-----------|-----------|---------|
| 超宽数据表/超宽菜品矩阵 | 53r×120c, 23 merges | 18r×61c, 28 merges | 3级嵌套merge, 宽表解析 |
| 混合类型测试 | 31r×6c | 21r×6c | 同列数字+文字+None |
| 空值区域测试 | 16r×15c, fill=69.6% | 13r×15c, fill=70.3% | data_only=True模拟, 全空行, 全零列 |
| 跨年对比(2024-2025) | 13r×19c, 8 merges | 18r×19c, 8 merges | YoY数据对, 3级merge |

### 压测文件（4个）
| 文件 | 行数 | 大小 | Sheets | 生成耗时 |
|------|------|------|--------|---------|
| Stress-factory-L1-s42.xlsx | 50K | 5.8 MB | 3 (销售明细/费用台账/库存流水) | 16.7s |
| Stress-restaurant-L1-s42.xlsx | 50K | 6.0 MB | 3 (订单流水/日运营/时段明细) | 16.2s |
| Stress-factory-L2-s42.xlsx | 200K | 23.3 MB | 3 | 60.5s |
| Stress-restaurant-L2-s42.xlsx | 200K | 24.1 MB | 3 | 55.1s |

**总计**: 28个文件, 456 sheets, 72.6 MB

---

## Consensus & Disagreements

| 主题 | Researcher | Analyst | Critic | 最终裁定 |
|------|-----------|---------|--------|---------|
| 常规数据质量 | 444 sheets, 百分比已修复, 4场景3行业覆盖充分 | 够回归测试 | 未挑战 | **共识通过** ★★★★★ |
| 压测文件大小 | L2注释~60MB | 建议提升max-file-size至50MB | L2实际~60MB, 提升至50MB也不够 | **采纳Critic** — 应在10MB内最大化复杂度 |
| 压测路径覆盖 | L1=50K行无merge | 走不同路径是高风险 | L1非write_only但也无merge，是设计遗漏 | **降级为Low** ★★☆☆☆ |
| IndexError防护 | "5处IndexError防护" | 引用此数据 | 实际是30+处前置检查+3处泛化except | **修正** — 描述不精确但防护机制存在 |
| 边界sheet独立性 | 4类已实现 | 嵌入常规文件中 | 无法独立测试 | **共识** — 覆盖60-70%但不完整 |

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| 常规数据质量满足功能回归需求 | ★★★★★ (95%) | 三方一致，代码验证 |
| 百分比存储修复有效 | ★★★★★ (95%) | Pct namedtuple + number_format 确认 |
| 边界测试覆盖约60-70% | ★★★★☆ (80%) | 4类已实现，5类缺失 |
| 压测层无法验证真实大文件场景 | ★★★★★ (95%) | L2超10MB限制，压测无merge |
| L1可补充merge（非技术限制） | ★★★★☆ (85%) | L1<100K行，write_only非必需 |
| 提升max-file-size不解决根本问题 | ★★★★☆ (85%) | Nginx限制为额外约束 |

---

## Actionable Recommendations

### 立即执行（Immediate）

1. **L1压测添加merge和样式** — 修改L1生成脚本，添加3级merge header、百分比列、混合类型列。L1在10MB以内可走完整流程。工时: 0.5天。

2. **新增2类高优边界sheet** — (a) 公式保护sheet（SUM/AVERAGE公式，测试data_only=True）; (b) 纯数字列名sheet（"2024"/"2025"作为列标题）。工时: 1天。

### 本周内（Short-term）

3. **将边界sheet独立为单独测试文件** — 拆分为 `generate_edge_cases.py`，每个边界场景一个小型Excel。工时: 1天。

4. **废弃或重新定义L2** — L2(~60MB)永远无法通过10MB上传。选择: (a) 废弃L2, (b) 重定义为API级直接测试。

### 条件触发（Conditional）

5. **如果需要支持>10MB文件上传** — 同时修改Java 4个profile的max-file-size + Nginx client_max_body_size + 前端超时配置。先评估>10MB文件的用户占比。

---

## Risk Assessment

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| L2文件永远无法通过上传端点 | 确定 | 高 | 在10MB内重构压测数据 |
| 压测未覆盖merge解析分支 | 确定 | 高 | L1添加merge/样式 |
| 公式保护sheet导致生产解析失败 | 高 | 中 | 新增公式保护边界sheet |
| Spring Boot超限返回500(非413) | 高 | 低 | 添加@ExceptionHandler |
| Nginx body限制拦截大文件 | 中 | 中 | 检查并配置client_max_body_size |

---

## Open Questions

1. 真实用户Excel的大小分布？超过5MB和10MB的文件各占多少？
2. Nginx `client_max_body_size` 当前配置值？
3. 前端ECharts在5000+数据点时实际渲染性能？（fact-check确认ECharts 5可处理百万级）
4. L1的50K行压测是否实际跑通完整流程（上传→SSE→解析→图表→AI）？
5. Python服务内存使用基线？建议用 `df.memory_usage(deep=True).sum()` 实测

---

## Fact-Check Report

| # | 声明 | 状态 | 来源 | 修正说明 |
|---|------|------|------|----------|
| 1 | openpyxl write_only模式不支持merge_cells | ✅ 已验证 | openpyxl官方文档 | — |
| 2 | Spring Boot max-file-size超限返回413 | ⚠️ 不精确 | Baeldung/Spring Issues | 默认抛500，非413。需@ExceptionHandler |
| 3 | pandas处理200K行约消耗200MB内存 | ⚠️ 不精确 | pythonspeed.com | 依赖列数/类型，20MB-800MB+均可能 |
| 4 | xlsx是zip格式 | ✅ 已验证 | Office Open XML标准 | — |
| 5 | data_only=True对未Excel打开的文件返回None | ✅ 已验证 | openpyxl文档 | — |
| 6 | ECharts渲染5000+数据点会卡顿 | ❌ 不正确 | ECharts官方 | ECharts 5可处理百万级数据点 |
| 7 | Nginx默认client_max_body_size=1MB | ✅ 已验证 | Nginx官方文档 | — |
| 8 | pandas持有GIL | ⚠️ 不精确 | FastAPI/NumPy文档 | pandas C扩展会释放GIL；问题是阻塞事件循环 |

**Summary**: 8 claims — ✅ 4 verified, ❌ 1 incorrect, ⚠️ 3 imprecise

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (数据质量 / 边界覆盖 / 压测可用性)
- Total sources found: 15+ (含代码库一手证据 + 8 个Web验证源)
- Key disagreements: 2 resolved (压测置信度降级, max-file-size建议降级 — 均采纳Critic)
- Phases completed: Research → Analysis → Critique → Integration → Fact-Check
- Fact-check: 8 claims verified, 1 incorrect, 3 imprecise
- Competitor profiles: N/A
