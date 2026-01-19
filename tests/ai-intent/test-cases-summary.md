# P0测试用例生成总结

## 概览
- **文件名**: `test-cases-p0-remaining-140.json`
- **生成日期**: 2026-01-16
- **测试套件**: AI Intent Recognition - P0 Remaining Cases
- **总测试用例数**: 142个（超过要求的140个）

## 测试用例分布

| 类别 | 数量 | ID范围 | 说明 |
|------|------|--------|------|
| **MATERIAL** | 33个 | TC-P0-MATERIAL-005 ~ TC-P0-MATERIAL-037 | 原料批次管理 |
| **QUALITY** | 28个 | TC-P0-QUALITY-003 ~ TC-P0-QUALITY-030 | 质量检验管理 |
| **PROCESSING** | 40个 | TC-P0-PROCESSING-001 ~ TC-P0-PROCESSING-040 | 生产批次管理 |
| **SHIPMENT** | 23个 | TC-P0-SHIPMENT-003 ~ TC-P0-SHIPMENT-025 | 出货记录管理 |
| **TRACE** | 18个 | TC-P0-TRACE-003 ~ TC-P0-TRACE-020 | 批次溯源查询 |

## MATERIAL类测试用例细分 (33个)

### 按材料类型筛选 (5个)
- TC-P0-MATERIAL-005: 带鱼批次查询
- TC-P0-MATERIAL-006: 草鱼批次查询（口语化）
- TC-P0-MATERIAL-007: 虾仁批次查询
- TC-P0-MATERIAL-008: 鱿鱼库存查询
- TC-P0-MATERIAL-009: 扇贝库存查询（口语化）

### 按状态筛选 (3个)
- TC-P0-MATERIAL-010: AVAILABLE状态查询
- TC-P0-MATERIAL-011: RESERVED状态查询
- TC-P0-MATERIAL-012: USED/DEPLETED状态查询（口语化）

### 按日期范围筛选 (3个)
- TC-P0-MATERIAL-013: 最近7天入库
- TC-P0-MATERIAL-014: 本月入库（口语化）
- TC-P0-MATERIAL-015: 指定日期段查询

### FIFO查询 (2个)
- TC-P0-MATERIAL-016: 最早入库批次
- TC-P0-MATERIAL-017: 先进先出推荐（口语化）

### 即将过期查询 (2个)
- TC-P0-MATERIAL-018: 7天内过期查询
- TC-P0-MATERIAL-019: 快过期预警（口语化）

### 低库存预警 (3个)
- TC-P0-MATERIAL-020: 库存<100kg
- TC-P0-MATERIAL-021: 库存<200kg
- TC-P0-MATERIAL-022: 库存预警（口语化）

### 正常使用扣减 (3个)
- TC-P0-MATERIAL-023: 单批次使用
- TC-P0-MATERIAL-024: 部分使用
- TC-P0-MATERIAL-025: 口语化使用表达

### 超量使用拒绝 (2个)
- TC-P0-MATERIAL-026: 超出可用库存
- TC-P0-MATERIAL-027: 考虑预留量

### 批次全部使用 (2个)
- TC-P0-MATERIAL-028: 恰好用完
- TC-P0-MATERIAL-029: 全部用掉（口语化）

### 多批次同时使用 (3个)
- TC-P0-MATERIAL-030: 两批次同时使用
- TC-P0-MATERIAL-031: 多批次取料
- TC-P0-MATERIAL-032: 口语化多批次操作

### 预留原料 (3个)
- TC-P0-MATERIAL-033: 单批次预留
- TC-P0-MATERIAL-034: 累加预留
- TC-P0-MATERIAL-035: 口语化预留

### 调整库存 (2个)
- TC-P0-MATERIAL-036: 增加数量
- TC-P0-MATERIAL-037: 减少数量

## QUALITY类测试用例细分 (28个)

### 合格品质检 (3个)
- TC-P0-QUALITY-003: 高合格率（98%）
- TC-P0-QUALITY-004: 标准合格率（95%）
- TC-P0-QUALITY-005: 口语化质检

### 不合格品质检 (3个)
- TC-P0-QUALITY-006: 低合格率（60%）
- TC-P0-QUALITY-007: 严重不合格（50%）
- TC-P0-QUALITY-008: 口语化不合格

### 部分合格质检 (2个)
- TC-P0-QUALITY-009: 临界合格率（70%）
- TC-P0-QUALITY-010: 边界情况（75%）

### 多批次质检 (2个)
- TC-P0-QUALITY-011: 同时检测多批
- TC-P0-QUALITY-012: 批量检测

### 紧急质检 (2个)
- TC-P0-QUALITY-013: 快速检测
- TC-P0-QUALITY-014: 口语化紧急

### 查询质检项配置 (3个)
- TC-P0-QUALITY-015: 标准流程查询
- TC-P0-QUALITY-016: 详细标准查询
- TC-P0-QUALITY-017: 口语化查询

### 查询质检结果 (3个)
- TC-P0-QUALITY-018: 按批次查询
- TC-P0-QUALITY-019: 最近质检记录
- TC-P0-QUALITY-020: 口语化结果查询

### 查询不合格记录 (2个)
- TC-P0-QUALITY-021: 近期不合格
- TC-P0-QUALITY-022: 不合格统计

### 返工处置 (2个)
- TC-P0-QUALITY-023: 标准返工流程
- TC-P0-QUALITY-024: 口语化返工

### 报废处置 (2个)
- TC-P0-QUALITY-025: 严重不合格报废
- TC-P0-QUALITY-026: 口语化报废

### 降级处置 (1个)
- TC-P0-QUALITY-027: 轻微瑕疵降级

### 质检统计 (3个)
- TC-P0-QUALITY-028: 本周统计
- TC-P0-QUALITY-029: 按产品统计
- TC-P0-QUALITY-030: 口语化统计

## PROCESSING类测试用例细分 (40个)

### 创建批次 (8个)
- TC-P0-PROCESSING-001~008: 标准、紧急、计划批次创建

### 启动批次 (6个)
- TC-P0-PROCESSING-009~014: 正常启动、原料不足、设备占用场景

### 暂停批次 (4个)
- TC-P0-PROCESSING-015~018: 暂停生产操作

### 恢复批次 (4个)
- TC-P0-PROCESSING-019~022: 恢复生产操作

### 完成批次 (6个)
- TC-P0-PROCESSING-023~028: 正常完成、提前完成、超期完成

### 批次列表查询 (8个)
- TC-P0-PROCESSING-029~036: 按状态、日期、产品类型查询

### 批次详情查询 (4个)
- TC-P0-PROCESSING-037~040: 详细信息查询

## SHIPMENT类测试用例细分 (23个)

### 创建出货 (8个)
- TC-P0-SHIPMENT-003~010: 标准、紧急、批量出货创建

### 查询出货 (10个)
- TC-P0-SHIPMENT-011~020: 按状态、客户、日期、单号查询

### 更新出货 (3个)
- TC-P0-SHIPMENT-021~023: 更新出货信息

### 取消出货 (2个)
- TC-P0-SHIPMENT-024~025: 取消出货操作

## TRACE类测试用例细分 (18个)

### 原料批次溯源 (3个)
- TC-P0-TRACE-003~005: 原料批次溯源

### 生产批次溯源 (3个)
- TC-P0-TRACE-006~008: 生产批次溯源

### 成品批次溯源 (2个)
- TC-P0-TRACE-009~010: 成品批次溯源

### 完整链路溯源 (2个)
- TC-P0-TRACE-011~012: 端到端溯源

### 端到端完整溯源 (5个)
- TC-P0-TRACE-013~017: 原料-生产-质检-出货完整链路

### 公开溯源码生成 (3个)
- TC-P0-TRACE-018~020: 生成公开溯源码

## 关键特性

### 口语化覆盖率
- 总测试用例: 142个
- 口语化测试用例: ~45个
- 覆盖率: **31.7%**（超过要求的30%）

### SQL语句完整性
- ✅ 所有测试用例包含完整的INSERT语句
- ✅ 所有测试用例包含cleanup语句
- ✅ 使用NOW()函数生成时间戳
- ✅ 符合数据库schema定义

### 验证机制
- ✅ responseAssertion: 响应状态验证
- ✅ dataVerification: 数据准确性验证（查询类）
- ✅ operationVerification: 操作结果验证（操作类）
- ✅ semanticCheck: LLM语义验证

## 文件信息
- 文件大小: 5280行
- JSON格式: 有效（已验证）
- 编码: UTF-8
- 结构完整性: ✅ 通过

## 使用说明

### 运行测试用例
```bash
# 执行所有P0测试用例
npm run test:p0

# 按类别执行
npm run test:p0:material
npm run test:p0:quality
npm run test:p0:processing
npm run test:p0:shipment
npm run test:p0:trace
```

### 验证测试数据
```bash
# 检查测试用例数量
jq '.testCases | length' test-cases-p0-remaining-140.json

# 按类别统计
jq '.testCases | group_by(.category) | map({category: .[0].category, count: length})' test-cases-p0-remaining-140.json

# 检查口语化测试用例
jq '.testCases[] | select(.expectedIntent.matchMethod == "COLLOQUIAL") | .id' test-cases-p0-remaining-140.json
```

## 下一步工作
1. ✅ 完成P0测试用例生成（140/140）
2. ⏳ 执行测试用例并收集结果
3. ⏳ 根据测试结果优化意图识别
4. ⏳ 生成P1、P2优先级测试用例
