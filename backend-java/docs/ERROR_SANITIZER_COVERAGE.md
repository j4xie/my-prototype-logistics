# ErrorSanitizer 覆盖报告

## 概述

`ErrorSanitizer` 是用于API响应错误信息脱敏的工具类，防止敏感信息（SQL细节、文件路径、堆栈跟踪、内部类名等）泄露给前端用户。

## 脱敏规则

| 敏感信息类型 | 脱敏后消息 |
|-------------|-----------|
| SQL相关错误 | "数据处理失败，请联系管理员" |
| 数据库连接信息 | "服务暂时不可用，请稍后重试" |
| 堆栈跟踪 | 移除 |
| 内部类名 | "[内部错误]" |
| 文件路径 | "[路径]" |
| NullPointerException等 | "操作失败，请稍后重试" |

## 覆盖统计

**统计日期**: 2026-01-05

| 层级 | 覆盖数量 | 说明 |
|------|---------|------|
| Controller层 | 215处 | 所有用户可见的API响应 |
| Service层 | 34处 | 服务层异常处理 |
| 已导入文件数 | 27个Controller | 所有需要的Controller已导入 |

## 已覆盖的Controller

| Controller | 位置数 |
|------------|-------|
| IntentAnalysisController | 17 |
| LabelController | 17 |
| WorkSessionController | 16 |
| DisposalController | 13 |
| WorkOrderController | 12 |
| BatchRelationController | 11 |
| ShipmentController | 11 |
| LinUCBController | 11 |
| ScaleSimulatorController | 9 |
| SupplierAdmissionController | 7 |
| AIQuotaConfigController | 5 |
| TraceabilityController | 5 |
| AIRuleController | 5 |
| FormAssistantController | 4 |
| ApprovalChainController | 3 |
| TemplatePackageController | 3 |
| RuleController | 2 |
| AIBusinessDataController | 1 |
| EquipmentController | 1 |
| SupplierController | 1 |
| ScaleDeviceController | 1 |
| 其他Controller | 多处 |

## 使用示例

```java
// 导入
import com.cretas.aims.util.ErrorSanitizer;

// 使用方式
catch (Exception e) {
    log.error("操作失败", e);  // 日志保留完整信息用于调试
    return ApiResponse.error("操作失败: " + ErrorSanitizer.sanitize(e));  // API响应脱敏
}
```

## 注意事项

1. **日志语句不脱敏**: `log.error()`, `log.warn()` 等保留完整信息用于调试
2. **API响应必须脱敏**: 所有返回给用户的错误信息必须使用 `ErrorSanitizer.sanitize(e)`
3. **response.getMessage() 不需要脱敏**: 服务层返回的业务响应消息是可控的，无需脱敏

## 验证命令

```bash
# 检查是否有遗漏
grep -rn "e\.getMessage()" src/main/java/com/cretas/aims/controller/*.java | grep -v "log\."

# 统计覆盖数量
grep -r "ErrorSanitizer" src/main/java/com/cretas/aims/controller/*.java | wc -l
```
