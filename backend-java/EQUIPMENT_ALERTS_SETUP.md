# 设备告警API设置和测试指南

## 📋 概述

设备告警功能已完成后端API实现，包括：
- **确认告警** API: `POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/acknowledge`
- **解决告警** API: `POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/resolve`

## ⚠️ 重要提示

目前ServiceImpl中的方法签名需要从 `Integer alertId` 更新为 `String alertId`，以支持前端的动态ID格式（如 `MAINT_1`, `WARRANTY_1`）。

## 🔧 设置步骤

### 1. 数据库准备

执行SQL脚本创建表并插入测试数据：

```bash
# 连接到MySQL数据库
mysql -u root -p cretas_db

# 执行SQL脚本
source src/main/resources/sql/equipment_alerts_test_data.sql

# 或者直接执行：
mysql -u root -p cretas_db < src/main/resources/sql/equipment_alerts_test_data.sql
```

**注意**：请根据实际的equipment表中的设备ID调整SQL脚本中的 `equipment_id` 值。

查询现有设备ID：
```sql
SELECT id, name FROM equipment WHERE factory_id = 'CRETAS_2024_001' LIMIT 5;
```

### 2. 修改ServiceImpl代码

需要在 `MobileServiceImpl.java` 中修改方法签名：

**位置**: `src/main/java/com/cretas/aims/service/impl/MobileServiceImpl.java:1312` 和 `line:1344`

**需要修改**:
```java
// 修改前：
public MobileDTO.AlertResponse acknowledgeAlert(String factoryId, Integer alertId, ...)
public MobileDTO.AlertResponse resolveAlert(String factoryId, Integer alertId, ...)

// 修改后：
public MobileDTO.AlertResponse acknowledgeAlert(String factoryId, String alertId, ...)
public MobileDTO.AlertResponse resolveAlert(String factoryId, String alertId, ...)
```

**支持动态ID的逻辑** (添加到方法开头):
```java
// 1. 获取或创建告警记录（支持动态ID）
EquipmentAlert alert = getOrCreateAlert(factoryId, alertId);
```

**添加辅助方法** (在文件末尾，convertToAlertResponse之前):
```java
/**
 * 获取或创建告警记录（支持动态ID）
 */
private EquipmentAlert getOrCreateAlert(String factoryId, String alertId) {
    // 1. 尝试作为数字ID查询
    if (alertId.matches("\\d+")) {
        Integer numericId = Integer.parseInt(alertId);
        return equipmentAlertRepository.findByFactoryIdAndId(factoryId, numericId)
                .orElseThrow(() -> new ResourceNotFoundException("告警不存在: alertId=" + alertId));
    }

    // 2. 处理动态ID格式：MAINT_{equipmentId} 或 WARRANTY_{equipmentId}
    if (alertId.startsWith("MAINT_") || alertId.startsWith("WARRANTY_")) {
        String[] parts = alertId.split("_");
        if (parts.length != 2) {
            throw new BusinessException("无效的告警ID格式: " + alertId);
        }

        String alertType = parts[0];
        String equipmentIdStr = parts[1];
        Integer equipmentId = Integer.parseInt(equipmentIdStr);

        // 查询设备信息
        Equipment equipment = equipmentRepository.findById(equipmentId)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在: equipmentId=" + equipmentId));

        // 根据类型创建告警记录（从设备维护信息动态生成）
        EquipmentAlert newAlert;
        if ("MAINT".equals(alertType)) {
            newAlert = createMaintenanceAlert(factoryId, equipment);
        } else {
            newAlert = createWarrantyAlert(factoryId, equipment);
        }

        return equipmentAlertRepository.save(newAlert);
    }

    throw new BusinessException("不支持的告警ID格式: " + alertId);
}

private EquipmentAlert createMaintenanceAlert(String factoryId, Equipment equipment) {
    LocalDate nextMaintenanceDate = equipment.getNextMaintenanceDate();
    LocalDateTime triggeredAt = nextMaintenanceDate != null
            ? nextMaintenanceDate.atStartOfDay()
            : LocalDateTime.now();

    long daysOverdue = 0;
    if (nextMaintenanceDate != null) {
        daysOverdue = LocalDate.now().toEpochDay() - nextMaintenanceDate.toEpochDay();
    }

    String message;
    com.cretas.aims.entity.enums.AlertLevel level;

    if (daysOverdue > 7) {
        level = com.cretas.aims.entity.enums.AlertLevel.CRITICAL;
        message = String.format("设备维护已逾期 %d 天", daysOverdue);
    } else if (daysOverdue > 0) {
        level = com.cretas.aims.entity.enums.AlertLevel.WARNING;
        message = String.format("设备维护已逾期 %d 天", daysOverdue);
    } else {
        level = com.cretas.aims.entity.enums.AlertLevel.WARNING;
        message = "设备即将到达维护周期";
    }

    String details = String.format("上次维护: %s\n下次维护: %s",
            equipment.getLastMaintenanceDate() != null ? equipment.getLastMaintenanceDate().toString() : "未记录",
            nextMaintenanceDate != null ? nextMaintenanceDate.toString() : "未设置");

    return EquipmentAlert.builder()
            .factoryId(factoryId)
            .equipmentId(equipment.getId())
            .alertType("维护提醒")
            .level(level)
            .status(AlertStatus.ACTIVE)
            .message(message)
            .details(details)
            .triggeredAt(triggeredAt)
            .build();
}

private EquipmentAlert createWarrantyAlert(String factoryId, Equipment equipment) {
    LocalDate warrantyExpiryDate = null;
    if (equipment.getPurchaseDate() != null) {
        warrantyExpiryDate = equipment.getPurchaseDate().plusYears(2);
    }

    LocalDateTime triggeredAt = warrantyExpiryDate != null
            ? warrantyExpiryDate.atStartOfDay()
            : LocalDateTime.now();

    long daysRemaining = 0;
    if (warrantyExpiryDate != null) {
        daysRemaining = warrantyExpiryDate.toEpochDay() - LocalDate.now().toEpochDay();
    }

    String message;
    com.cretas.aims.entity.enums.AlertLevel level;

    if (daysRemaining <= 7) {
        level = com.cretas.aims.entity.enums.AlertLevel.WARNING;
        message = String.format("保修将在 %d 天后到期", daysRemaining);
    } else {
        level = com.cretas.aims.entity.enums.AlertLevel.INFO;
        message = String.format("保修将在 %d 天后到期", daysRemaining);
    }

    String details = String.format("购买日期: %s\n保修到期: %s\n制造商: %s",
            equipment.getPurchaseDate() != null ? equipment.getPurchaseDate().toString() : "未知",
            warrantyExpiryDate != null ? warrantyExpiryDate.toString() : "未知",
            equipment.getManufacturer() != null ? equipment.getManufacturer() : "未知");

    return EquipmentAlert.builder()
            .factoryId(factoryId)
            .equipmentId(equipment.getId())
            .alertType("保修即将到期")
            .level(level)
            .status(AlertStatus.ACTIVE)
            .message(message)
            .details(details)
            .triggeredAt(triggeredAt)
            .build();
}
```

### 3. 编译和运行

```bash
# 编译
mvn clean package -DskipTests

# 运行
mvn spring-boot:run
```

### 4. 测试API

使用提供的测试脚本：

```bash
# 给脚本执行权限
chmod +x test_equipment_alerts_api.sh

# 修改脚本中的TOKEN变量为实际的访问令牌

# 执行测试
./test_equipment_alerts_api.sh
```

或者使用curl手动测试：

```bash
# 确认告警
curl -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment/alerts/1/acknowledge" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "已知晓"}' | python3 -m json.tool

# 解决告警
curl -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment/alerts/2/resolve" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resolutionNotes": "已完成维护"}' | python3 -m json.tool

# 测试动态ID
curl -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment/alerts/MAINT_1/acknowledge" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool
```

## 📊 数据库验证

验证告警数据：

```sql
-- 查看所有告警
SELECT id, equipment_id, alert_type, level, status, message
FROM equipment_alerts
WHERE factory_id = 'CRETAS_2024_001';

-- 查看已确认的告警
SELECT id, alert_type, status, acknowledged_by_name, acknowledged_at
FROM equipment_alerts
WHERE factory_id = 'CRETAS_2024_001' AND status = 'ACKNOWLEDGED';

-- 查看已解决的告警
SELECT id, alert_type, status, resolved_by_name, resolved_at, resolution_notes
FROM equipment_alerts
WHERE factory_id = 'CRETAS_2024_001' AND status = 'RESOLVED';
```

## ✅ 功能验证清单

- [ ] 数据库表创建成功
- [ ] 测试数据插入成功
- [ ] ServiceImpl方法签名已更新为String类型
- [ ] 添加了getOrCreateAlert辅助方法
- [ ] 编译通过
- [ ] 数字ID告警确认成功
- [ ] 数字ID告警解决成功
- [ ] 动态ID (MAINT_xxx) 确认成功
- [ ] 动态ID (WARRANTY_xxx) 解决成功
- [ ] 重复确认返回正确错误
- [ ] 不存在的告警返回正确错误

## 🔍 故障排查

### 问题1: 编译失败 - 找不到AlertLevel或AlertStatus

**解决**: 确保已创建枚举类文件：
- `src/main/java/com/cretas/aims/entity/enums/AlertLevel.java`
- `src/main/java/com/cretas/aims/entity/enums/AlertStatus.java`

### 问题2: 运行时找不到EquipmentAlert表

**解决**: 执行SQL脚本创建表：
```bash
mysql -u root -p cretas_db < src/main/resources/sql/equipment_alerts_test_data.sql
```

### 问题3: API返回404

**解决**: 检查URL路径是否正确，确保后端服务已启动在10010端口

### 问题4: 动态ID创建告警失败

**解决**: 确保equipment表中存在对应的设备记录

## 📝 API响应示例

### 成功响应（确认告警）:
```json
{
  "code": 200,
  "success": true,
  "message": "告警已确认",
  "data": {
    "id": 1,
    "factoryId": "CRETAS_2024_001",
    "equipmentId": 1,
    "equipmentName": "冷冻机组A",
    "alertType": "维护提醒",
    "level": "CRITICAL",
    "status": "ACKNOWLEDGED",
    "message": "设备维护已逾期 15 天",
    "details": "上次维护: 2025-10-01\n下次维护: 2025-11-04",
    "triggeredAt": "2025-11-04T00:00:00",
    "acknowledgedAt": "2025-11-19T14:30:00",
    "acknowledgedBy": "张三",
    "resolvedAt": null,
    "resolvedBy": null,
    "resolutionNotes": null
  }
}
```

### 成功响应（解决告警）:
```json
{
  "code": 200,
  "success": true,
  "message": "告警已解决",
  "data": {
    "id": 2,
    "factoryId": "CRETAS_2024_001",
    "equipmentId": 2,
    "equipmentName": "传送带B",
    "alertType": "维护提醒",
    "level": "WARNING",
    "status": "RESOLVED",
    "message": "设备维护已逾期 3 天",
    "details": "上次维护: 2025-10-16\n下次维护: 2025-11-16",
    "triggeredAt": "2025-11-16T00:00:00",
    "acknowledgedAt": "2025-11-19T14:30:00",
    "acknowledgedBy": "张三",
    "resolvedAt": "2025-11-19T15:00:00",
    "resolvedBy": "李四",
    "resolutionNotes": "已完成设备维护，更换了润滑油"
  }
}
```

### 错误响应（重复确认）:
```json
{
  "code": 400,
  "success": false,
  "message": "告警已被确认"
}
```

## 🚀 下一步

设备告警API基础功能已完成，后续可以扩展：
1. 添加告警查询API（按状态、级别、时间范围筛选）
2. 添加告警统计API（各级别告警数量、趋势）
3. 实现定时任务自动扫描设备生成告警
4. 添加告警通知（邮件、短信、推送）
5. 添加告警操作历史记录
