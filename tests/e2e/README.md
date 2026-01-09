# AI 意图识别系统 E2E 测试套件

本目录包含 AI 意图识别系统的端到端业务测试脚本和报告。

## 测试概览

### 最新测试结果 (2026-01-07)

| 指标 | 值 | 目标 | 状态 |
|------|-----|------|------|
| 总测试数 | 35 | - | - |
| 通过率 | 60% | > 80% | ❌ |
| 意图识别准确率 | 57.14% | > 95% | ❌ |
| 平均响应时间 | 2894ms | < 2000ms | ❌ |

**结论**: ⚠️ 系统需要重大优化后才能生产发布

---

## 测试脚本

### 1. 主测试脚本
**文件**: `ai_intent_e2e_test.sh`
**测试数**: 17
**覆盖范围**:
- 查询类意图 (4 个测试)
- 操作类意图 (3 个测试)
- 异常场景处理 (3 个测试)
- 多轮对话 (2 个测试)
- 性能测试 (5 个并发请求)

**执行命令**:
```bash
cd /Users/jietaoxie/my-prototype-logistics/tests/e2e
bash ai_intent_e2e_test.sh
```

### 2. 高级场景测试
**文件**: `ai_intent_advanced_scenarios.sh`
**测试数**: 18
**覆盖范围**:
- 完整生产流程 (6 步)
- 口语化表达 (8 个测试)
- 边界条件 (4 个测试)

**执行命令**:
```bash
bash ai_intent_advanced_scenarios.sh
```

### 3. 全量测试
```bash
# 运行所有测试
bash ai_intent_e2e_test.sh && bash ai_intent_advanced_scenarios.sh
```

---

## 测试报告

### 综合报告
**文件**: `AI_INTENT_E2E_COMPREHENSIVE_REPORT.md`
**包含内容**:
- 执行摘要
- 详细测试结果分析
- 性能分析
- 缺陷清单 (10 个缺陷)
- 优化建议与行动计划

**关键发现**:
1. ❌ 多轮对话机制未生效
2. ❌ 意图识别准确率低 (57%)
3. ❌ 关键词冲突导致误识别
4. ✅ 完整生产流程可用
5. ✅ 安全性验证通过

### 自动生成报告
**位置**: `test_results/AI_INTENT_E2E_TEST_REPORT_*.md`
**格式**: Markdown
**包含**:
- 测试总结
- 核心指标
- 性能分析
- 优化建议

---

## 关键缺陷

### P0 - 阻塞性缺陷 (必须修复)

| ID | 问题 | 修复优先级 |
|----|------|----------|
| DEF-001 | 多轮对话机制未生效 | **紧急** |
| DEF-002 | 意图识别准确率 57% | **紧急** |
| DEF-003 | 状态枚举不一致 | **紧急** |

### P1 - 功能性缺陷 (1 周内修复)

| ID | 问题 | 影响 |
|----|------|------|
| DEF-004 | 关键词冲突 (MATERIAL_UPDATE vs MATERIAL_BATCH_USE) | 原料管理 |
| DEF-005 | 设备相关意图缺失 | 设备管理 |
| DEF-006 | 批次号提取失败 | 溯源查询 |

---

## 优化建议

### 紧急修复 (1-2 天)

#### 1. 修复多轮对话机制
```java
// IntentExecutorServiceImpl.java
if (matchResult.needsLlmFallback()) {
    ConversationService.ConversationSession session =
        conversationService.startConversation(factoryId, userInput, userId);

    return IntentExecuteResponse.builder()
        .intentRecognized(false)
        .status("CONVERSATION_CONTINUE")
        .sessionId(session.getSessionId()) // 关键: 必须返回
        .message(session.getClarificationQuestion())
        .build();
}
```

#### 2. 统一状态枚举
```java
// 全局替换 NEED_CLARIFICATION → NEED_MORE_INFO
grep -r "NEED_CLARIFICATION" src/ --include="*.java" -l | \
  xargs sed -i '' 's/NEED_CLARIFICATION/NEED_MORE_INFO/g'
```

### 短期优化 (3-5 天)

#### 3. 解决关键词冲突
```sql
UPDATE ai_intent_configs
SET priority = 85, keywords = '使用,消耗,领用,出库'
WHERE intent_code = 'MATERIAL_BATCH_USE';

UPDATE ai_intent_configs
SET priority = 70, keywords = '更新,修改,编辑'
WHERE intent_code = 'MATERIAL_UPDATE';
```

#### 4. 补充设备意图
```sql
INSERT INTO ai_intent_configs (intent_code, intent_name, keywords)
VALUES ('DEVICE_STATUS_QUERY', '设备状态查询',
        '摄像头,状态,在线,离线,设备,坏了,怎么回事');
```

#### 5. 补充口语化关键词
```sql
UPDATE ai_intent_configs SET keywords = CONCAT(keywords, ',仓库里,还有多少')
WHERE intent_code = 'MATERIAL_BATCH_QUERY';
```

---

## 测试场景详解

### 场景组 1: 查询类意图 (4/4 覆盖)

| 测试 | 用户输入 | 期望意图 | 结果 |
|------|---------|---------|------|
| 1.1 | "帮我查一下批次 PB-F001-20250101-001 的溯源信息" | TRACE_BATCH | ✅ 识别成功 / ❌ 执行失败 |
| 1.2 | "帮我查一下批次溯源" | TRACE_BATCH | ✅ 识别成功 / ❌ 状态错误 |
| 1.3 | "我想看看现在仓库里还有多少原材料" | MATERIAL_BATCH_QUERY | ✅ 全部通过 |
| 1.4 | "1号摄像头现在是什么状态" | DEVICE_STATUS_QUERY | ❌ 未识别 |

### 场景组 2: 操作类意图 (3/3 覆盖)

| 测试 | 用户输入 | 期望意图 | 结果 |
|------|---------|---------|------|
| 2.1 | "使用批次 MB-F001-001 的原材料 100公斤" | MATERIAL_BATCH_USE | ❌ 误识别为 MATERIAL_UPDATE |
| 2.2 | "使用批次 MB-F001-001" | MATERIAL_BATCH_USE | ❌ 误识别 |
| 2.3 | "对批次 PB-F001-20250101-001 执行质检" | QUALITY_CHECK_EXECUTE | ✅ 全部通过 |

### 场景组 3: 异常场景 (3/3 覆盖)

| 测试 | 用户输入 | 期望行为 | 结果 |
|------|---------|---------|------|
| 3.1 | "帮我查一下那个批次" | 触发多轮对话 | ❌ 未创建会话 |
| 3.2 | "帮我搞一下" | LLM Fallback | ⚠️ 触发但无有效结果 |
| 3.3 | "帮我预测明天的销售额" | 拒绝操作 | ✅ 正确拒绝 |

### 场景组 4: 多轮对话 (2/2 覆盖)

| 测试 | 用户输入 | 期望行为 | 结果 |
|------|---------|---------|------|
| 4.1 | "查询库存" | 创建会话 | ❌ 未创建 |
| 4.2 | "原材料批次" (延续) | 延续会话 | ❌ 跳过 |

### 高级场景: 完整生产流程 (6/6 通过) ✅

1. ✅ 查询原料库存
2. ✅ 启动生产批次
3. ✅ 记录原料消耗
4. ✅ 执行质检
5. ✅ 创建出货记录
6. ✅ 查询批次溯源

**结论**: 完整业务流程可用，证明系统架构合理

### 高级场景: 口语化表达 (3/8 通过)

| 用户输入 | 识别结果 | 状态 |
|---------|---------|------|
| "帮我看看仓库里还有多少带鱼" | 未识别 | ❌ |
| "那个批次现在到哪了" | BATCH_UPDATE | ✅ |
| "摄像头坏了吗" | 未识别 | ❌ |
| "给我找一下上个月的质检记录" | QUALITY_CHECK_EXECUTE | ✅ |
| "我要出货100箱" | 未识别 | ❌ |
| "查一下今天用了多少原料" | 未识别 | ❌ |
| "库存快没了，提醒一下采购" | MATERIAL_BATCH_QUERY | ✅ |
| "这个设备怎么回事" | 未识别 | ❌ |

**结论**: 口语化识别能力不足，需要补充关键词

### 高级场景: 边界条件 (4/4 通过) ✅

| 测试 | 结果 |
|------|------|
| 超长输入 (200+ 字符) | ✅ |
| 空输入 | ✅ |
| 特殊字符 (XSS) | ✅ |
| 数字和单位识别 | ✅ |

**结论**: 系统安全性良好

---

## 性能分析

| 指标 | 值 | 目标 | 状态 |
|------|-----|------|------|
| 最小响应时间 | 219ms | - | ✅ |
| 最大响应时间 | 9125ms | < 5000ms | ❌ |
| 平均响应时间 | 2894ms | < 2000ms | ❌ |
| P95 响应时间 | ~7000ms | < 3000ms | ❌ |

**性能瓶颈**:
1. LLM Fallback 超时 (6-9秒)
2. 语义匹配未启用
3. 可能存在 N+1 查询

**优化方案**:
```yaml
# application.yml
llm:
  timeout: 5000  # 从 10s 降低
  cache:
    enabled: true
    ttl: 3600

intent:
  matching:
    semantic-enabled: true
    semantic-threshold: 0.75
```

---

## 下一步行动

### 本周 (Week 1)
- [ ] 修复 DEF-001: 多轮对话机制
- [ ] 修复 DEF-003: 统一状态枚举
- [ ] 修复 DEF-004: 关键词冲突

### 下周 (Week 2)
- [ ] 补充设备相关意图
- [ ] 增强批次号提取
- [ ] 补充口语化关键词
- [ ] 性能优化 (LLM 超时、缓存)

### 本月 (Month 1)
- [ ] 启用语义匹配
- [ ] 扩充训练样本
- [ ] 重新测试，目标通过率 > 90%

---

## 联系与支持

**测试维护者**: AI Intent Test Team
**问题反馈**: 请在项目 Issue 中提交
**文档更新**: 每次测试后更新本文档

**相关文档**:
- [综合测试报告](./AI_INTENT_E2E_COMPREHENSIVE_REPORT.md)
- [缺陷清单](./AI_INTENT_E2E_COMPREHENSIVE_REPORT.md#四缺陷与问题清单)
- [优化建议](./AI_INTENT_E2E_COMPREHENSIVE_REPORT.md#五优化建议与行动计划)
