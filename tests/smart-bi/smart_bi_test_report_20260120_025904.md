# SmartBI 全面测试报告

**测试时间**: 2026-01-20 02:59:04
**测试环境**: http://139.196.165.140:10010/api/public/smart-bi

---


## Phase 1: 基础数据验证

- ❌ FAIL: 经营驾驶舱 - 无法获取KPI数据
- ❌ FAIL: 销售数据概览 - API响应异常
- ✅ PASS: 销售员排名 - 返回 8 位销售员数据
- ✅ PASS: 部门分析 - 返回 4 个部门数据
- ✅ PASS: 区域分析 - 返回 4 个区域数据
- ✅ PASS: 产品分析 - 返回 4 个产品数据

## Phase 2: 图表数据测试

- ✅ PASS: 销售趋势图 - 图表类型: LINE, 数据点: 16
- ⚠️ WARN: 部门排名图 - 图表类型: UNKNOWN (期望BAR)
- ⚠️ WARN: 产品分布图 - 图表类型: UNKNOWN (期望PIE)
- ⚠️ WARN: 区域热力图 - 图表类型: UNKNOWN (期望HEATMAP/MAP)

## Phase 3: 自然语言查询测试

- ✅ PASS: "本月销售额是多少" -> QUERY_SALES_OVERVIEW (置信度: 1.0)
- ✅ PASS: "哪个部门业绩最好" -> QUERY_DEPARTMENT_PERFORMANCE (置信度: 1.0)
- ⚠️ WARN: "华东区销售怎么样" -> QUERY_SALES_OVERVIEW (期望: QUERY_REGION_ANALYSIS, 置信度: 1.0)
- ✅ PASS: "应收账款多少" -> QUERY_RECEIVABLE (置信度: 1.0)
- ✅ PASS: "销售趋势如何" -> QUERY_SALES_TREND (置信度: 1.0)
- ✅ PASS: "产品销量排名" -> QUERY_PRODUCT_ANALYSIS (置信度: 1.0)
- ✅ PASS: "库存情况怎么样" -> QUERY_INVENTORY (置信度: 1.0)
- ✅ PASS: "预测下个月销售" -> FORECAST (置信度: 0.8999999999999999)
- ✅ PASS: 多轮对话第1轮 - 华东区销售查询成功
- ✅ PASS: 多轮对话第2轮 - 指代消解测试成功

## Phase 4: 动态交互测试

- ⚠️ WARN: 区域下钻 - 无下钻数据
- ⚠️ WARN: 部门下钻 - 无下钻数据
- ✅ PASS: 时间范围: today - 查询成功
- ✅ PASS: 时间范围: week - 查询成功
- ✅ PASS: 时间范围: month - 查询成功
- ✅ PASS: 时间范围: quarter - 查询成功
- ⚠️ WARN: 部门筛选 - 查询可能不支持

## Phase 5: 预警与建议测试

- ❌ FAIL: 预警列表 - API调用失败
- ✅ PASS: 建议列表 - 返回 2 条建议
- ⚠️ WARN: 激励方案生成 - 可能不支持或无数据

## Phase 6: 预测服务测试

- ✅ PASS: 预测意图识别 - 正确识别为 FORECAST
- ⚠️ WARN: 预测数据 - 未返回预测点数据

## Phase 7: 统一仪表盘聚合测试

- ✅ PASS: 统一仪表盘 - sales 数据完整
- ✅ PASS: 统一仪表盘 - finance 数据完整
- ⚠️ WARN: 统一仪表盘 - inventory 数据缺失
- ⚠️ WARN: 统一仪表盘 - production 数据缺失
- ⚠️ WARN: 统一仪表盘 - quality 数据缺失
- ⚠️ WARN: 统一仪表盘 - procurement 数据缺失
- ✅ PASS: 统一仪表盘 - deptRank 数据完整
- ✅ PASS: 统一仪表盘 - regionRank 数据完整
- ✅ PASS: 统一仪表盘 - alerts 数据完整
- ✅ PASS: 统一仪表盘 - recs 数据完整

---

## 测试摘要

| 指标 | 数值 |
|------|------|
| 通过 | 26 |
| 失败 | 3 |
| 警告 | 13 |
| 总计 | 42 |
| 通过率 | 61.9% |

---

**测试完成时间**: 2026-01-20 02:59:11
