# 白垩纪系统待完成任务

**最后更新**: 2026-01-23
**总剩余工作量**: ~2.5个工作日

---

## 一、P2 待完成任务（~2.5天）

### 1. ISAPI阶段3: AI意图扩展（0.5天）

**状态**: ❌ 未实现

**目标**: 增加智能分析相关意图，集成到现有AI意图识别系统

**需实现的意图**:
- `ISAPI_CONFIG_LINE_DETECTION` - 配置行为检测
- `ISAPI_CONFIG_FIELD_DETECTION` - 配置区域入侵
- `ISAPI_QUERY_DETECTION_EVENTS` - 查询检测事件

**实施步骤**:
1. 在 `AIIntentType.java` 添加新意图枚举
2. 在 `ai_intent_config` 表添加配置数据
3. 实现对应的 Handler 类
4. 添加关键词到 `IntentKnowledgeBase.java`

**依赖**: IsapiSmartAnalysisService.java (已完成)

---

### 2. 增强查询/更新区分度（0.5天）

**问题**: "查询"和"更新"操作容易混淆

**解决方案**:
- 在 `IntentKnowledgeBase.java` 添加更多区分短语
- 强化动词识别（查、看、显示 → QUERY；改、更新、修改 → UPDATE）

---

### 3. 错误信息脱敏（1.5天）

**问题**: 异常堆栈信息直接返回用户

**解决方案**:
- 日志保留详情
- 用户看到友好提示
- 增加错误码映射

**需修改文件**: 所有 Handler 的异常处理

---

## 二、长期计划（暂不实施）

### 国际化 (i18n)
- **当前进度**: 49.6% (118/238页面)
- **技术栈**: i18next + react-i18next + expo-localization
- **文档**: `国际化计划.md`

### API文档完善
- **当前进度**: 86% (380/440接口)
- **文档**: `API文档完善计划.md`

### PostgreSQL迁移
- **状态**: 未开始
- **文档**: `PG迁移计划.md`

### 意图识别Complex测试提升
- **当前进度**: Simple 94%, Complex 39%
- **目标**: Complex 70%
- **文档**: `.claude/ralph-loop-progress.md`

---

## 三、已完成模块（参考）

| 模块 | 完成时间 | 关键文件 |
|------|----------|----------|
| AI意图识别 Phase 1 | 2026-01-06 | AIIntentServiceImpl.java |
| IoT完整解决方案 | 2026-01-23核实 | IotDataServiceImpl.java (341行) |
| ISAPI智能分析(阶段1-2) | 2026-01-23核实 | IsapiSmartAnalysisService.java (219行) |
| 硬件测试框架 | 2026-01-23核实 | DeviceBatchOperationsTest.java (23.6KB) |
| SmartBI系统 | 2026-01-23核实 | 90+ Java文件 |
| userId传递链修复 | 2026-01-06 | 7个关键节点修复 |
| 多租户缓存隔离 | 已完成 | FactoryAwareCacheService.java |

---

## 四、快速命令

```bash
# 运行集成测试
cd backend-java && mvn test -Dtest=*FlowTest

# 部署到服务器
./deploy-backend.sh steven

# 查看服务器日志
ssh root@139.196.165.140 "tail -f /www/wwwroot/cretas/cretas-backend.log"

# 检查SemanticRouter统计
ssh root@139.196.165.140 'grep "SemanticRouter:" /www/wwwroot/cretas/cretas-backend.log | grep -o "DIRECT_EXECUTE\|NEED_RERANKING\|NEED_FULL_LLM" | sort | uniq -c'
```
