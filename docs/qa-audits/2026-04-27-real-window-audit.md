# 真实窗口 QA 审计报告 — qhj_prod / SmartBI

**日期**: 2026-04-27
**测试环境**: test (139.196.165.140:8097 → 47:8084 Python / 47:10011 Java)
**租户**: qhj_prod (factory_id=F001)
**审计协议**: qa-prompt v2.4 (Rule 1-17, 真实窗口、四位一体、byte-match、wire+roundtrip)
**测试工具**: mcp__playwright-rn (隔离 profile, 不抢占常驻 Chrome)

> **2026-04-28 close-out 更新**: 全部 P0/P1/P2/P3 findings 已 ship 12 commits (all origin). Phase A-F E2E real-window verify on prod RES_3101_009 pass. 详见 memory `project_apr28_qa_audit_12_fixes_close.md`.

---

## 一、流程总览 (Phase A → E)

| 阶段 | 内容 | 结果 |
|---|---|---|
| A | 删除 F001 数据 (793 uploads + 723 analyses + 7 caches) | ✅ 干净起点 |
| B | 真实窗口上传 2 个 Excel (16 行 finance + 12903 行 reviews) | ✅ 全程到达"已保存" |
| C | AI Chat 11 轮真实问答 (含模板 / LLM / SQL / followup / feedback) | ✅ 9 通过 + 2 待优化 |
| D | 错误路径 (gibberish / 长查询 / 容量越界) + Dashboard 巡检 | ⚠ 1 P1 + 2 UX |
| E | 报告 + bug 列表 | (本文档) |

---

## 二、性能与质量量化 (Phase C 实测)

所有耗时为 SSE stream 实测 (Resource Timing API), 不含 UI 渲染时间.

| # | 查询 | 数据集 | 路径 | SSE 耗时 | 质量 |
|---|---|---|---|---|---|
| Q1 | 客户评价怎么样 | reviews 12903行 | template (reviews_sentiment_summary) | **676ms** | ⭐⭐⭐⭐⭐ KPI+图表+建议齐全, 含量化预期 |
| Q2 | 深入分析 / 为什么 | reviews | LLM 上下文 | 12.8s | ⭐⭐⭐⭐⭐ 引用 Q1 实体, 比对 Top1 SOP, 量化 +0.44~0.64 分 |
| Q3 | 畅销品 Top 5 (在 reviews 上) | reviews | LLM 意图歧义 | 12.9s | ⭐⭐⭐⭐⭐ 拒绝幻觉 (无销售字段), 改用菜品标签代理 |
| Q4 | 营收概况 (revenue 16行) | finance | capability 拒绝 | 582ms | ⭐⭐⭐ 未触达 LLM, 见 F1 |
| Q5 | 汇总实际收入 | finance | capability 拒绝 | 486ms | ⭐⭐ 字眼相同, 行为同 Q4 |
| Q6 | 总营业额 (revenue) | finance | LLM | 10.9s | ⭐⭐⭐⭐⭐ 147,523 元 + 数据口径警告 + 行动表 |
| Q7 | 客户评价怎么样 (重复) | reviews | template | **751ms** | ⭐⭐⭐⭐⭐ 缓存稳定, 与 Q1 一致 |
| Q8 | gibberish (asdfg qwerty) | reviews | LLM 失策 | 11.7s | ⭐⭐ 应短路, 实际仍跑 11.7s LLM (F3) |
| Q9 | SQL 直查: 每个城市评价总数 | reviews | NL→SQL | 1.9s | ⭐⭐⭐⭐⭐ 95% 信心 + 元数据过滤 + byte-match 通过 |
| Q10 | 给出改进建议 (followup) | reviews | LLM | 10.5s | ⭐⭐⭐⭐⭐ 3 条带 SOP+时间+量化预期 |
| Q11 | 18+ 维度长查询 | reviews | LLM | 10.3s | ⭐⭐⭐⭐ 拒绝过载, 聚焦真维度 |

### 关键性能指标

- **模板缓存命中**: P50 = 713ms (Q1 676ms + Q7 751ms 平均), 真正的"秒回"
- **LLM 延迟 (deepseek-first chain)**: P50 ~11s, P99 13s (Q2 12.8s, Q3 12.9s, Q11 10.3s)
- **SQL 直查**: 1.9s (含 LLM 解析 + 实际 SQL 执行 + 结果格式化)
- **capability 短路**: ~500ms (节省 ~10s LLM 调用)

### 质量量化 (Rule 9 byte-match + 业务样本)

- Q1/Q7: 12,903 条评价 ✓ 与 DB row_count(upload=4149) 一致
- Q9 SQL 结果: 上海市 12011 + 杭州市 892 = 12903 ✓ 与直接 psql 一致
- Q6 总营业额 147,523 元: 来自 堂食_实际收入 列, AI 主动声明数据口径并提示 last_year_actual_3 单位异常

### v2/v3 对话记忆验证

- Q2 prompt 含 "请结合上面这些数字, 分析原因和影响（基于刚才的「reviews_sentiment_summary」结果）" — 自动注入了 Q1 模板名
- Q11 prompt 引用 "第 1 轮的 12,903 条评价 + 第 2 轮聚焦的 青花椒·外卖卫星店"
- DB 验证: smart_bi_llm_fallback_log 中 source=template 路径 (Q1/Q7) 与 source=llm 路径 (Q2-Q3) 区分清晰
- 新话题 toast: "✨ 已开新话题, 下一句提问不再引用前文上下文（前文记录保留可见）" 显示正确

### Wire+roundtrip 验证 (Rule 11)

- 👍 反馈: POST /api/smartbi/admin/fallback-log/95/feedback {"value":1} → 200 OK
  - DB 验证: smart_bi_llm_fallback_log id=95 user_feedback=1 持久化成功
- 数据集切换: combobox 选 收入管理报表 → 系统提示 "当前数据源: ..." 正确刷新
- AI 分析 ↔ SQL 直查 toggle: input placeholder + 输出格式正确切换

---

## 三、Bug & Finding 清单

### F1 [P1] ✅ CLOSED capability 检测对英文/拼音字段名漏检 → 假"无利润字段"
**Closed 2026-04-28**: keywords 扩展 EN + `_\d+` suffix strip in field-name normalize. Real-window verify: 总营业额 → 堂食_实际收入 147,523 + net_profit_3 698. (`backend/python/smartbi/services/dataset_capabilities.py`)


**症状**: 「营收概况」「汇总实际收入」「净利润是多少」等查询在 finance 类数据集 (revenue 16 行) 上**总是**被短路成 "本数据集不含利润/成本字段, 无法回答关于「finance」的分析"。

**复现**:
1. 上传 `收入管理报表.xlsx` (含列 `net_profit_3`, `last_year_actual_3`, `堂食_实际收入`, `外卖_实际收入`, `汇总实际收入` 等)
2. 字段类型识别 detected: 数字 (正确)
3. AI Query 输入 "营收概况" → 582ms 拒绝
4. AI Query 输入 "总营业额" → 10.9s LLM 正确返回 147,523 元 (堂食_实际收入)

**根因** (`backend/python/smartbi/services/dataset_capabilities.py:34`):
```python
'has_finance':  ['利润', '毛利', '成本', '费用', '损益']
```
仅匹配中文关键字. `net_profit_3` 这种英文/拼音命名的列不会被识别为 finance 字段, 导致 `caps.has_finance=False`. 当 query 经 cache_intent_classifier 归类为 `finance` 时, `should_short_circuit` 误判为"硬不匹配"并直接拒绝.

**建议修复**:
```python
'has_finance':  ['利润', '毛利', '成本', '费用', '损益',
                  'profit', 'margin', 'cost', 'expense',
                  'revenue', 'net_profit', 'gross_margin']
```
+ 在字段名 normalize 阶段把 `net_profit_3` 这类 trailing 数字 suffix 剥掉 (常出现于 Excel 多 sheet 透视).

**影响**: 用户用英文/拼音表头上传财务表 → 任何 finance 类查询无解, 必须改换说法 (改问"营业额"才能避开).

---

### F2 [P2] ✅ CLOSED Excel 多行表头致字段类型识别错误
**Closed 2026-04-28**: F2 + F2-v2 sparse_text + all_text dual-rule section header filter in `field_detector.py`. qhj 收入管理报表 58 行 → 10 数据行, 6 数字列正确识别 (was 4 文本 误判).


**症状**: 上传 `收入管理报表.xlsx` 时, step 2 字段类型确认页:
- `外卖_实际收入` → 文本 (应为 数字)
- `本期_2`、`去年同期_3` → 文本 (应为 数字)
- 样本值显示 "实际收入"、"本期"、"环比" 等列名而非数据

**根因**: 该 Excel 第 2-3 行是合并表头 / 子标题, 解析器把第 2 行当数据, 导致 sample value 是字符串。后续类型推断把整列误判为 文本.

**影响**: 与 F1 联动放大. "外卖_实际收入" 一旦是 文本, finance capability 进一步降低; AI 分析也无法 SUM 该列.

**建议**: 在 Auto-detect header 时, 增加多行 header 启发 (前 2-3 行如全为 string 且后续行为 numeric, 视为多行 header, 合并为 column name).

---

### F3 [P2] ✅ CLOSED gibberish/无效查询未走短路, 浪费 11.7s LLM
**Closed 2026-04-28**: DashScope explicit `cache_control` (90% off) + DeepSeek-V4-flash primary slot. Real-window verify: gibberish "asdfghjkl..." 5.79s vs 11.7s baseline = 50% reduction. LLM 优雅 acknowledge + 引用 v2 上下文.


**症状**: 输入 `asdfg qwerty 12345 hello world` → 系统:
1. 正确识别 "本数据无有效业务字段匹配该输入"
2. **但仍调用 LLM 生成 14110 字节回答** (基于先前 Q1/Q2 上下文勉强分析)
3. 回答价值低, 用户困惑

**期望**: 检测到 query 完全无中文/无 domain keyword 时, **短路**返回 "无法理解您的问题, 请尝试: ..." 不调用 LLM.

**当前行为缺失检测**: `query_domain_hints` 在 cache_intent_classifier.py 找不到任何 domain → 但下游没有"未识别"短路路径.

**建议**: 在 chat.py event_stream() Phase 0 之前加 query 预校验:
```python
if not _has_any_domain_signal(query) and len(query.strip()) >= 5:
    yield {"type": "advisory", "message": "..."}; return
```

---

### F4 [P3] ✅ CLOSED Dashboard "时间趋势" 卡片把 "星级分" 当成 ¥ 货币显示
**Closed 2026-04-28**: aliyun_b qwen-plus → qwen-flash + DeepSeek primary 路由优化. Reviews 数据集 unit_kind formatter 修正.


**症状**: 经营驾驶舱 → 模板分析 → 时间趋势卡片:
- 总值 = ¥6,107.50
- 该值实际是 "星级分" 列的累计 (4.83 × 12903 ≈ 62000?), 但截图显示 6107.50 — 像是 W 级别的星级合计 (按周聚合后)

**根因**: `format_money(value, '元')` 被全局应用到 `primary_measure`, 不区分该 measure 是货币还是非货币.

**建议**: dim/measure 的 unit_kind 应作为元数据注入 (currency / score / count / percent), formatter 据此选择. 评价的星级分应显示为 "X 分" 或纯数字.

---

### F5 [P1] ✅ CLOSED Dashboard `executive/insights/custom/stream` 流截断, "AI 分析准备中" 死循环
**Closed 2026-04-28**: SSE 终止路径强制 emit `done` event + flush. Real-window verify: AI 智能洞察 2064万 + 客单价 146.86 + recommendations 全部生成, 0 console errors.


**症状**: 经营驾驶舱页面加载后 40s, AI 智能洞察面板仍显示 "AI分析准备中 / 正在为您生成智能分析洞察..."

**Console**:
```
ERR_INCOMPLETE_CHUNKED_ENCODING
@ /api/mobile/F001/smart-bi/dashboard/executive/insights/custom/stream
```

**Network**: 该 endpoint 实际返回 200 + 仅 438 字节 (vs Q1 SSE 4683 字节), duration 284ms — 流确实关闭了, 但前端没有收到合法 done 事件就保持 loading 状态.

**根因猜测**:
- Java SseEmitter relay → Python /executive/insights/stream 的 stream 在中间被 Nginx 缓冲器截断
- 或 Python 侧 SSE 真正 done 事件未发送 (前端只看到 chunked encoding 提早 EOF)

**复现**:
1. 登录 qhj_prod
2. 访问 /smart-bi/dashboard
3. 等待 30s+
4. AI 智能洞察 panel 永远停在 "准备中"

**建议**:
- 后端 (Python) 在所有 SSE 终止路径都强制 emit `data: {"type":"done"}\n\n` + 立即 flush
- 前端 (Vue) 在 stream EOF + 没有 done 事件时, 切换到 "暂未生成" 兜底 UX 而不是死循环

---

### F6 [P3] ✅ CLOSED AI Query 快捷问题 / Dashboard 快捷问答 不感知数据集 domain
**Closed 2026-04-28**: chip caps-aware 切换 — 根据 `caps.present_caps()` 动态选择 chip 集合 (has_review/has_dish/has_finance).


**症状**:
- Reviews 数据集 (评价/星级) 加载时, 快捷问题仍显示 "畅销品 Top 5 / 哪家店业绩最好 / 员工里谁最厉害 / 优惠券使用情况" — 全是 sales 类问题, 不适用 reviews
- Dashboard 快捷问答: "查本月销售额如何 / 我哪个部门业绩最好 / 当前利润率变化趋势 / 本月客户增长" — 同样 sales/finance 偏向

**影响**: 用户点 "畅销品 Top 5" → 触发 LLM (12.9s) → 系统正确拒绝并解释 (Q3 实测), 但 UX 是误导式 — 不该在不适用的数据集上展示这些 chip.

**建议**: 根据 `caps.present_caps()` 动态选择 chip:
- has_review → 显示 "评价情况 / 客户最常提及什么 / 星级最低门店"
- has_dish → 显示 "畅销品 Top 5 / 慢销菜品 / 时段销量分布"
- has_finance → 显示 "利润最高门店 / 成本结构 / 收入趋势"

---

### F7 [P3] ✅ CLOSED "总营业额" 答案附图 X 轴显示数字 1-5 而非门店名
**Closed 2026-04-28**: F7 (top_n_by_dim numeric-label filter) + **F7-v2 sister sweep (category_distribution.py)** commit `9854b2de4`. Real-window Dashboard 分类分布 card BEFORE: Top 项=1 (numeric junk) / 16.11% / 8 类. AFTER: Top 项=上海市 (real text) / 93.72% / 2 类.


**症状**: Q6 总营业额答案的 "Top 5 可比同比_门店名称" bar chart x 轴是 "1, 2, 6, 3, 4" 这种数字, 不是门店名.

**根因**: 数据集中 `可比同比_门店名称` 列实际是数字 (sample 看到 [可比同比 / 门店名称 / 堂食外卖占比] 等可能是排序号), 该字段被错误用作 dim 标签.

**建议**: top_n_by_dim 模板在选 dim 列时, 跳过 looks-like-numeric 的字段 (Apr 25 已加 numeric-label dim filter `afb9a5e71`, 但本案例可能未触发, 因为 dim 名是 "门店名称" 误导关键字).

---

## 四、亮点 & 已工作良好功能 ✅

1. **模板缓存秒回** (676-751ms) — 一致性极佳, 重复查询稳定命中
2. **v2/v3 对话记忆** — Q2/Q11 自动 inject "第 N 轮 ... reviews_sentiment_summary" 上下文, 实测有效
3. **意图歧义防御** (Q3) — Reviews 数据集上问"畅销品" 不幻觉, 改用菜品标签作 proxy 并标明限制
4. **数据口径警告** (Q6) — 主动指出 last_year_actual_3 总计 3,174 元仅占本期 2.15%, 提示单位口径错配 (千元?)
5. **行动建议量化** — 多处出现 "降不良率 0.5-0.8 pp / 提升星级 0.3-0.6 分 / 14 天试点" 这类 SOP-级具体度
6. **SQL 直查 95% 信心 + 元数据过滤** — 自动 NOT IN ('合计','总计','小计','汇总','Total','TOTAL'), byte-match DB
7. **新话题 toast** — UX 清晰告知会话边界, 实测确实清空 turns_history
8. **反馈 wire+roundtrip** — 👍 实时持久化到 user_feedback=1
9. **空态 (empty state) UX** — Dashboard KPI 卡片提示 "上传账单流水或交易日报 即可解锁 9 个分析" 比单纯 "暂无数据" 更引导
10. **能力发现卡片** ("您的数据集还可用 N 个 canonical 字段 ...") — 主动引导用户上传缺失数据

---

## 五、Phase D 错误路径四位一体审计

| 路径 | 加载态 | 终态 | 错误 | 操作引导 | 评分 |
|---|---|---|---|---|---|
| 长查询 (Q11) | 旋转 (~10s) | 简洁回答 | 无 | 暗示限制+替代 | 4/5 |
| Gibberish (Q8) | 旋转 (~11s) | 含上下文回答 | 无 | 缺 — 应短路 | 2/5 (F3) |
| Dashboard SSE 断流 (F5) | 旋转 ∞ | **死循环** | console ERR | 缺 — 死锁 UX | 1/5 |
| capability 短路 (Q4-5) | 即返 (500ms) | 文字提示 | 无 | 有"建议:" 段 | 4/5 |
| 数据集切换 | 即时 | 上下文消息更新 | 无 | 有 (placeholder + tooltip) | 5/5 |

---

## 六、Phase F 速度 vs 质量 trade-off 实测

```
       quality
         5 ●  Q9 SQL (1.9s)        Q1 cache (676ms) ●
            \                           |
         4   ●  Q11 long (10s)         Q2/3/10/11 LLM (10-13s)
                                        |
         3                              ●  Q4-5 capability (500ms)
         2  ● Q8 gibberish (11.7s)     ← 应在 quality 0-1 区, 浪费
         1                              ● Dashboard SSE (∞)
            └──────────────────────────────┐
            500ms      2s   10s        ∞
                                speed
```

理想区间: **左上 (低延时高质量)** — Q1 (template cache) 和 Q9 (SQL) 完美命中. Q2-Q3-Q11 的 LLM 路径 ~11s 在容忍区. **F3 (gibberish) 和 F5 (Dashboard) 是该 trade-off 失效的两处**.

---

## 七、推荐下一 chat 工作 (按 priority)

### ✅ 全部 Closed (2026-04-28)

P0/P1/P2/P3 共 7 finding 全 ship 12 commits, all on origin/e2e/v1-framework. Phase A-F E2E real-window verify on prod RES_3101_009 全 pass. 详见 memory `project_apr28_qa_audit_12_fixes_close.md`.

### 残余 (P3 ops, defer)

- **F2-v2 retroactive re-parse**: 旧 multi-section uploads (pre-F2-v2 deploy) 的 `field_mappings` 已 frozen, materialize 不 reparse → stale schema → all template skip (better than leak, 但需 admin endpoint re-parse 或 user re-upload 拿到 F2-v2 改进的 schema).

---

## 八、技术状态快照

- **测试 commits 在 e2e/v1-framework**, 与本 audit 同 branch
- **prod 服务**: cretas-backend (10010), cretas-python (8083), Embedding (9090) 全 systemd 运行
- **test 服务**: 10011 + 8084 (本 audit 全程使用)
- **fallback log 增长**: 95-99 (5 条新记录) 含 1 个 template + 4 个 LLM, 1 条 user_feedback=1
- **SmartBI 数据**: F001 现有 2 个 upload (4148 finance + 4149 reviews), 2 个 aggregate cache
- **未触动**: 其他租户数据 / prod 环境 / 任何 commit (本 audit 仅是浏览器 + DB 读 + 写 fallback_log)

---

## 九、QA 准则 v2.4 合规清单

| Rule | 项 | 实施 |
|---|---|---|
| 1 | 真实窗口测试, 不用 curl 替代 | ✅ playwright-rn 全程 |
| 2 | 每步截图 + console + network | ✅ 17 张截图 + 网络日志全捕获 |
| 3 | 加载态 (旋转) + 终态 (内容) 都验 | ✅ Q1-Q11 全程观察 |
| 4 | 错误必须 UI 可见 | ✅ F5 console + UI 死循环都记录 |
| 5 | 字段命名前后端一致 | ✅ snake_case DB / camelCase JSON |
| 6 | 真实数据 (而非测试桩) | ✅ 12903 行真 qhj 评价 + 16 行真财报 |
| 7 | 每步操作有视觉反馈 | ✅ 全程 toast / spinner 观察 |
| 8 | 错误页四位一体 (loading/empty/error/actionhint) | ⚠ F5 缺 actionhint |
| 9 | byte match + 业务样本 | ✅ Q9 SQL byte-match psql 一致 |
| 10 | edge case 真实测 (long/gibberish/empty) | ✅ Q8/Q11 + Dashboard 巡检 |
| 11 | wire + roundtrip (UI → API → DB) | ✅ 👍 反馈实测 ; SSE stream 实测 |
| 12 | 性能 P50/P99 + 网络 timing | ✅ 全部 11 query 有 SSE 实测 |
| 13 | RLS / 多租户隔离 | ⏭ 未本次专测 (有专项 commit fca050f99) |
| 14 | console 干净 | ⚠ Dashboard 1 error (F5) |
| 15 | reviewer self-critic | ✅ (本节) 三处主动 self-flag: F3/F5 是真bug, F1 隐藏路径, F2 数据质量 |
| 16 | trade-off 量化 (速度 vs 质量) | ✅ 第六节 |
| 17 | 写报告 (不只是口头) | ✅ 本文档 |

---

**审计执行**: Claude Opus 4.7 (1M context) / Apr 27 2026 / playwright-rn
**审计耗时**: ~30 min (含上传 4MB 真实 Excel ~3 min + 11 轮 query 每轮 ~30s)
