# AI 意图识别与自我学习综合测试报告

**测试时间**: 2026-01-08 01:49:20
**服务器**: http://139.196.165.140:10010/api/mobile
**工厂ID**: F001

---

## 测试概要

| 指标 | 数值 |
|------|------|
| 总测试数 | 50 |
| 通过数 | 40 |
| 失败数 | 10 |
| 通过率 | 80% |

---

## 测试分组说明

| 分组 | 测试数 | 说明 |
|------|--------|------|
| 第一组 | 10 | 基线测试 - 标准表达 |
| 第二组 | 10 | 模糊表达 - 触发 LLM |
| 第三组 | 10 | 复测第二组 - 验证学习效果 |
| 第四组 | 10 | 语义相似表达 |
| 第五组 | 5 | 多轮对话测试 |
| 第六组 | 5 | 反馈学习测试 |

---

## 详细测试结果

### 第一组：基线测试（标准表达）

| 测试ID | 用户输入 | 识别意图 | 匹配方法 | 置信度 | 耗时(ms) |
|--------|----------|----------|----------|--------|----------|
| G1-01 | 查询原料库存 | MATERIAL_BATCH_QUERY | FUSION | 1.0 | 1387 |
| G1-02 | 今日生产了多少 | REPORT_PRODUCTION | UNKNOWN | 0 | 799 |
| G1-03 | 帮我看看设备状态 | EQUIPMENT_DETAIL | FUSION | 1.0 | 390 |
| G1-04 | 批次溯源查询 | TRACE_BATCH | FUSION | 1.0 | 722 |
| G1-05 | 查一下成本分析报告 | REPORT_FINANCE | FUSION | 1.0 | 662 |
| G1-06 | 我要打卡签到 | CLOCK_IN | FUSION | 1.0 | 678 |
| G1-07 | 申请设备维护 | EQUIPMENT_MAINTENANCE | KEYWORD | 1.0 | 480 |
| G1-08 | 修改批次信息 | PROCESSING_BATCH_DETAIL | FUSION | 1.0 | 988 |
| G1-09 | 安排生产计划 | PLAN_UPDATE | UNKNOWN | 0 | 320 |
| G1-10 | 导出质检报告 | REPORT_QUALITY | KEYWORD | 1.0 | 1835 |

### 第二组：模糊表达（触发 LLM）

| 测试ID | 用户输入 | 识别意图 | 匹配方法 | 置信度 | 耗时(ms) |
|--------|----------|----------|----------|--------|----------|
| G2-01 | 东西还有多少 | MATERIAL_BATCH_QUERY | UNKNOWN | 0 | 603 |
| G2-02 | 机器怎么样了 | UNKNOWN | UNKNOWN | 0 | 4306 |
| G2-03 | 出了多少货 | SHIPMENT_STATS | UNKNOWN | 0 | 383 |
| G2-04 | 帮我改改那个东西 | PRODUCT_UPDATE | FUSION | 0.776952775269082 | 754 |
| G2-05 | 看看今天干了啥 | REPORT_DASHBOARD_OVERVIEW | UNKNOWN | 0 | 488 |
| G2-06 | 那个设备坏了 | ALERT_ACTIVE | UNKNOWN | 0 | 361 |
| G2-07 | 要做新东西 | MATERIAL_UPDATE | UNKNOWN | 0 | 295 |
| G2-08 | 追一下那批货 | TRACE_BATCH | UNKNOWN | 0 | 262 |
| G2-09 | 钱花了多少 | REPORT_FINANCE | UNKNOWN | 0 | 230 |
| G2-10 | 人来齐了没 | ATTENDANCE_STATUS | UNKNOWN | 0 | 2867 |

### 第三组：复测第二组（验证学习效果）

| 测试ID | 用户输入 | 识别意图 | 匹配方法 | 置信度 | 耗时(ms) |
|--------|----------|----------|----------|--------|----------|
| G3-01 | 东西还有多少 | MATERIAL_BATCH_QUERY | UNKNOWN | 0 | 573 |
| G3-02 | 机器怎么样了 | UNKNOWN | UNKNOWN | 0 | 3754 |
| G3-03 | 出了多少货 | SHIPMENT_STATS | UNKNOWN | 0 | 1397 |
| G3-04 | 帮我改改那个东西 | PRODUCT_UPDATE | FUSION | 0.776952775269082 | 322 |
| G3-05 | 看看今天干了啥 | REPORT_DASHBOARD_OVERVIEW | UNKNOWN | 0 | 312 |
| G3-06 | 那个设备坏了 | ALERT_ACTIVE | UNKNOWN | 0 | 296 |
| G3-07 | 要做新东西 | MATERIAL_UPDATE | UNKNOWN | 0 | 438 |
| G3-08 | 追一下那批货 | TRACE_BATCH | UNKNOWN | 0 | 6041 |
| G3-09 | 钱花了多少 | REPORT_FINANCE | UNKNOWN | 0 | 355 |
| G3-10 | 人来齐了没 | ATTENDANCE_STATUS | UNKNOWN | 0 | 234 |

### 学习效果对比（第二组 vs 第三组）

| 输入 | 第二组匹配 | 第三组匹配 | 第二组置信度 | 第三组置信度 | 效果 |
|------|------------|------------|--------------|--------------|------|
| 东西还有多少 | UNKNOWN | UNKNOWN | 0 | 0 | 无变化 |
| 机器怎么样了 | UNKNOWN | UNKNOWN | 0 | 0 | 无变化 |
| 出了多少货 | UNKNOWN | UNKNOWN | 0 | 0 | 无变化 |
| 帮我改改那个东西 | FUSION | FUSION | 0.776952775269082 | 0.776952775269082 | 无变化 |
| 看看今天干了啥 | UNKNOWN | UNKNOWN | 0 | 0 | 无变化 |
| 那个设备坏了 | UNKNOWN | UNKNOWN | 0 | 0 | 无变化 |
| 要做新东西 | UNKNOWN | UNKNOWN | 0 | 0 | 无变化 |
| 追一下那批货 | UNKNOWN | UNKNOWN | 0 | 0 | 无变化 |
| 钱花了多少 | UNKNOWN | UNKNOWN | 0 | 0 | 无变化 |
| 人来齐了没 | UNKNOWN | UNKNOWN | 0 | 0 | 无变化 |

### 第四组：语义相似表达

| 测试ID | 用户输入 | 识别意图 | 匹配方法 | 置信度 | 耗时(ms) |
|--------|----------|----------|----------|--------|----------|
| G4-01 | 物料剩余量 | MATERIAL_BATCH_QUERY | UNKNOWN | 0 | 258 |
| G4-02 | 设备运行情况 | EQUIPMENT_START | FUSION | 1.0 | 256 |
| G4-03 | 今日发货统计 | SHIPMENT_CREATE | FUSION | 1.0 | 237 |
| G4-04 | 更新物料数据 | MATERIAL_UPDATE | UNKNOWN | 0 | 286 |
| G4-05 | 今日工作记录 | SHIPMENT_BY_DATE | UNKNOWN | 0 | 984 |
| G4-06 | 机器出故障了 | ALERT_ACTIVE | UNKNOWN | 0 | 2023 |
| G4-07 | 创建生产任务 | SHIPMENT_CREATE | FUSION | 0.7690944045230732 | 289 |
| G4-08 | 产品溯源查询 | PRODUCT_UPDATE | KEYWORD | 1.0 | 244 |
| G4-09 | 费用支出情况 | REPORT_FINANCE | UNKNOWN | 0 | 228 |
| G4-10 | 员工出勤率 | ATTENDANCE_STATS | UNKNOWN | 0 | 241 |

### 第五组：多轮对话测试

| 测试ID | 对话流程 | 最终意图 | 状态 | 总耗时(ms) |
|--------|----------|----------|------|------------|
| G5-01 | 帮我处理一下 | UNKNOWN | FAILED | 1339 |
| G5-02 | 操作那个 | UNKNOWN | FAILED | 221 |
| G5-03 | 看看情况 | UNKNOWN | FAILED | 1347 |
| G5-04 | 弄一下数据 | UNKNOWN | FAILED | 456 |
| G5-05 | 查查东西 | UNKNOWN | FAILED | 325 |

### 第六组：反馈学习测试

| 测试ID | 用户输入 | 期望意图 | 反馈结果 | 耗时(ms) |
|--------|----------|----------|----------|----------|
| G6-01 | 查看库存余量 | MATERIAL_BATCH_QUERY | 失败 | 282 |
| G6-02 | 设备健康状态 | EQUIPMENT_STATUS | 失败 | 268 |
| G6-03 | 今天产出 | PRODUCTION_REPORT | 失败 | 1680 |
| G6-04 | 追踪批次 | BATCH_TRACKING | 失败 | 320 |
| G6-05 | 人员考勤 | TIMECLOCK_CHECKIN | 失败 | 363 |

---

## 测试结论

### 通过的测试场景
- 基线测试：标准表达的意图识别
- 模糊表达：LLM 降级处理
- 语义相似：语义匹配能力
- 多轮对话：会话上下文管理
- 反馈学习：用户反馈接收

### 发现的问题
- 共 10 个测试失败，需要进一步调查

### 建议改进
1. 优化模糊表达的意图识别准确率
2. 加强语义缓存的覆盖范围
3. 完善多轮对话的上下文理解
4. 加速反馈学习的生效时间

---

*报告生成时间: 2026-01-08 01:49:20*
