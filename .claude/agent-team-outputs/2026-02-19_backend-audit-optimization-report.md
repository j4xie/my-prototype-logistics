# 后端代码审计 + 整合优化报告

**日期**: 2026-02-19
**范围**: 272 entity, 111 controller, ~1517 endpoints
**状态**: Phase 1 已执行, BUILD SUCCESS ✅

---

## 综合审计结论

### 前端调用覆盖率

| 类别 | 数量 | 说明 |
|------|------|------|
| 前端有调用 (USED) | 8/17 checked | IsapiSmartAnalysis, ScaleProtocol, LinUCB, POS, SOP, FeatureConfig, FoodKBFeedback, System |
| 前端无调用 (UNUSED) | 9/17 checked | IsapiRecording, APSAdaptive, ActiveLearning, StrategyWeight, ScaleSimulator, Onboarding, AIContext, GenericAIChat, ProductionLineSupervisor |
| 已废弃 | 1 | SmartBIController (0 endpoints, @Deprecated) |

### 实体重复分析

| 实体 | 位置 | 判定 | 操作 |
|------|------|------|------|
| SkuComplexity (aps/) | aps/ vs smartbi/ | aps版本零引用、无Repository | ✅ **已删除** |
| AlertLevel | enums/ vs smartbi/enums/ | 不同语义(设备vs业务) | ✅ **已重命名** enums→DeviceAlertLevel |
| Department | Entity vs Enum | 不同用途(组织架构vs分类) | 保持不变 (设计合理) |

### 实体层组织评估 (272 files)

| 包 | 文件数 | 质量 |
|----|--------|------|
| Root level | 100 (36.8%) | ⚠️ 过度拥挤，未来可拆分 |
| enums/ | 46 (16.9%) | ✅ 良好 |
| smartbi/ | 22 (8.1%) | ✅ 良好 |
| config/ | 20 (7.4%) | ✅ 可接受 |
| inventory/ | 16 (5.9%) | ✅ 良好 |
| learning/ | 13 (4.8%) | ✅ 良好 |
| 其他 17 个子包 | 55 | ✅ 各司其职 |

---

## 已执行的变更

### P0: 安全删除 ✅

| 文件 | 操作 | 原因 |
|------|------|------|
| `controller/SmartBIController.java` | 已删除 | @Deprecated, 0 endpoints, 空壳 |
| `entity/aps/SkuComplexity.java` | 已删除 | 零引用, 无Repository, smartbi/版本完整替代 |

### P1: AI Controller 合并 ✅

将 2 个路径兼容的 AI Controller 合并到 AIController：

| 源 Controller | 端点数 | 操作 | 新路径 |
|--------------|--------|------|--------|
| AIContextController | 3 | ✅ 已合并+删除 | `/ai/context/production-summary`, `/ai/context/cost-analysis`, `/ai/context/cost-variance-summary` |
| AIBusinessDataController | 2 | ✅ 已合并+删除 | `/ai/business-data/initialize`, `/ai/business-data/preview` |

**未合并 (路径不兼容)**:
| 源 Controller | 原因 |
|--------------|------|
| GenericAIChatController | 基础路径 `/api/mobile/ai` (无 factoryId)，与 AIController 的 `/api/mobile/{factoryId}/ai` 不兼容 |
| AIQuotaConfigController | 基础路径 `/api/mobile/{factoryId}/ai-quota-configs` (独立前缀)，合并会破坏 API 兼容性 |

### P1b: AlertLevel 重命名 ✅

| 操作 | 文件 |
|------|------|
| 新建 `DeviceAlertLevel.java` | entity/enums/DeviceAlertLevel.java |
| 删除旧 `AlertLevel.java` | entity/enums/AlertLevel.java |
| 更新引用 (6 files) | EquipmentAlert.java, EquipmentAlertsServiceImpl.java, IotDataServiceImpl.java, MobileServiceImpl.java, CreateEquipmentAlertRequest.java, EquipmentAlertDTO.java |

### 附带修复: 预存编译错误 ✅

| 文件 | 问题 | 修复 |
|------|------|------|
| CRMIntentHandler.java:558 | `createSupplier(String, SupplierDTO)` 签名不匹配 | 改用 `CreateSupplierRequest` + `userId` |
| SystemIntentHandler.java:443 | `DecisionType.PURCHASE_ORDER` 不存在 | 改用 `SUPPLIER_APPROVAL` |
| SystemIntentHandler.java:460 | `getApproverRole()` 不存在 | 改用 `getApproverRoles()` |

---

## 最终结果

| 指标 | 变更前 | 变更后 | 差异 |
|------|--------|--------|------|
| Controller 数量 | 102 | 99 | -3 |
| 实体文件数 | 272 | 271 | -1 |
| 端点数量 | ~1517 | ~1517 | 不变 (全部保留) |
| AI Controllers | 8 | 6 | -2 |
| 编译状态 | 有 3 个预存错误 | BUILD SUCCESS | ✅ |

---

## P2: 未来待执行 (中风险)

| 优化项 | Controller 数量 | 预期减少 | 风险 |
|--------|---------------|---------|------|
| Device 整合 (Isapi + Dahua → Equipment) | 2 → 1 | -1 | MEDIUM |
| Scale 整合 (Device + Protocol → ScaleManagement) | 2 → 1 | -1 | MEDIUM |
| Scheduling 整合 (Main + Optimization + Metrics) | 3 → 1 | -2 | MEDIUM |

### P3: 保持不变 (设计合理)

- OnboardingController — 内部API, 独立安全模型 (X-Internal-Key)
- SopController — 文件上传域, OSS + 事件驱动
- FeatureConfigController — Feature flag 模式, 轻量级
- SystemController — 全局端点, 非工厂级 (/api/mobile/system)
- AIIntentConfigController — 大型专用 (32 endpoints)
- AIRuleController — 专用 (Drools + 状态机)
- GenericAIChatController — 路径不兼容 (无 factoryId)
- AIQuotaConfigController — 路径不兼容 (独立前缀)

---

## 9 个前端未调用 Controller 的处置建议

| Controller | 端点数 | 建议 | 理由 |
|-----------|--------|------|------|
| SmartBIController | 0 | ✅ 已删除 | 空壳 |
| AIContextController | 3 | ✅ 已合并 | 合并入 AIController |
| AIBusinessDataController | 2 | ✅ 已合并 | 合并入 AIController |
| GenericAIChatController | 1 | 保留 | 路径不兼容,可能后端内部调用 |
| ProductionLineSupervisorController | 3 | 保留 | 功能完整,等待 UI 集成 |
| OnboardingController | 1 | 保留 | 内部 API, 独立安全模型 |
| IsapiRecordingController | 8 | 保留 | 功能完整,等待 UI 集成 |
| APSAdaptiveController | 12 | 保留 | 功能完整,等待 UI 集成 |
| ActiveLearningController | 16 | 保留 | 功能完整,等待 UI 集成 |
| StrategyWeightAdaptationController | 10 | 保留 | 功能完整,等待 UI 集成 |
| ScaleSimulatorController | 13 | 保留 | 测试工具,条件加载 |
