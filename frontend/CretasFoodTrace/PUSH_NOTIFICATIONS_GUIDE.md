# Expo 推送通知集成指南

## 概述

本项目已集成 Expo Push Notifications，支持在真机上接收推送通知。

## 功能特性

- ✅ 设备自动注册/注销
- ✅ 前台通知显示
- ✅ 后台通知处理
- ✅ 通知点击导航
- ✅ 应用角标管理
- ✅ 多设备支持
- ✅ 分类通知渠道（Android）
- ✅ 批量推送

---

## 快速开始

### 1. 前端集成

在你的 App 根组件中使用 `usePushNotifications` Hook：

```typescript
// App.tsx 或主导航组件
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { useNavigation } from '@react-navigation/native';

function App() {
  const navigation = useNavigation();

  usePushNotifications({
    onNotificationReceived: (notification) => {
      console.log('收到通知:', notification.request.content.title);
    },
    onNotificationTapped: (response) => {
      const data = response.notification.request.content.data;

      // 根据通知类型导航到相应页面
      if (data.screen) {
        navigation.navigate(data.screen as never, data as never);
      }
    },
  });

  return <YourAppNavigator />;
}
```

### 2. 手动控制

如果需要手动控制注册/注销：

```typescript
const {
  registerDevice,
  unregisterDevice,
  clearAllNotifications,
  setBadgeCount,
} = usePushNotifications({
  autoRegisterOnLogin: false,  // 禁用自动注册
  autoUnregisterOnLogout: false,
});

// 手动注册
await registerDevice();

// 手动注销
await unregisterDevice();

// 清除所有通知
await clearAllNotifications();

// 设置角标数量
await setBadgeCount(5);
```

---

## 后端使用

### 1. 发送推送到单个用户

```java
@Autowired
private PushNotificationService pushNotificationService;

public void sendNotificationToUser(Long userId) {
    Map<String, Object> data = new HashMap<>();
    data.put("type", "approval");
    data.put("approvalId", 123);
    data.put("screen", "ApprovalDetail");

    pushNotificationService.sendToUser(
        userId,
        "审批通知",
        "您有一条新的审批请求",
        data
    );
}
```

### 2. 发送推送到工厂所有用户

```java
pushNotificationService.sendToFactory(
    "F001",
    "系统通知",
    "系统将于今晚 22:00 进行维护",
    null
);
```

### 3. 发送审批通知

```java
pushNotificationService.sendApprovalNotification(
    userId,
    "plan",         // 审批类型
    planId,         // 审批项 ID
    "生产计划需要您的审批"
);
```

### 4. 发送质检通知

```java
pushNotificationService.sendQualityNotification(
    userId,
    inspectionId,
    "FAILED",       // 质检结果
    "质检未通过，请查看详情"
);
```

### 5. 发送紧急插单通知

```java
pushNotificationService.sendUrgentInsertNotification(
    userId,
    planId,
    "紧急插单：客户 XYZ 要求今日完成"
);
```

---

## 通知数据格式

### 前端收到的通知结构

```typescript
{
  request: {
    content: {
      title: "通知标题",
      body: "通知内容",
      data: {
        type: "approval",        // 通知类型
        approvalId: 123,         // 业务 ID
        screen: "ApprovalDetail" // 导航目标页面
      }
    }
  }
}
```

### 后端发送的数据

```java
Map<String, Object> data = new HashMap<>();
data.put("type", "approval");          // 必填：通知类型
data.put("approvalId", 123);           // 业务 ID
data.put("screen", "ApprovalDetail");  // 前端导航目标
data.put("priority", "high");          // 可选：优先级
```

---

## 通知类型

| 类型 | 说明 | 导航页面 |
|------|------|---------|
| `approval` | 审批通知 | ApprovalDetail |
| `quality` | 质检通知 | QualityInspectionDetail |
| `plan_change` | 计划变更 | PlanDetail |
| `urgent_insert` | 紧急插单 | UrgentInsertScreen |
| `test` | 测试通知 | - |

---

## Android 通知渠道

应用已配置以下通知渠道（可在系统设置中单独控制）：

| 渠道 ID | 名称 | 重要性 | 用途 |
|---------|------|--------|------|
| `default` | 默认通知 | MAX | 一般通知 |
| `approval` | 审批提醒 | HIGH | 审批相关通知 |
| `quality` | 质检通知 | HIGH | 质检相关通知 |

---

## 测试

### 1. 测试推送通知

使用后端提供的测试接口：

```bash
curl -X POST http://139.196.165.140:10010/api/mobile/F001/devices/test-notification \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 2. 前端测试脚本

在项目根目录创建 `test-push.sh`：

```bash
#!/bin/bash

# 配置
API_BASE="http://139.196.165.140:10010"
FACTORY_ID="F001"
ACCESS_TOKEN="your-access-token"

# 发送测试推送
curl -X POST "${API_BASE}/api/mobile/${FACTORY_ID}/devices/test-notification" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json"

echo "\n测试推送已发送"
```

运行测试：

```bash
chmod +x test-push.sh
./test-push.sh
```

### 3. 使用 Expo 推送工具测试

访问 [Expo Push Notification Tool](https://expo.dev/notifications)，输入你的 Push Token 进行测试。

---

## 故障排查

### 问题 1: 无法获取 Push Token

**原因**:
- 在模拟器上运行（推送仅支持真机）
- 未配置 EAS Project ID

**解决方案**:
```bash
# 检查 app.json
cat app.json | grep projectId

# 确保有以下配置
"extra": {
  "eas": {
    "projectId": "com.cretas.foodtrace"
  }
}
```

### 问题 2: 推送未收到

**检查清单**:
1. ✅ 设备是否已注册（查看后端日志）
2. ✅ 应用是否授予通知权限
3. ✅ Push Token 是否有效
4. ✅ 后端是否成功调用 Expo API

**调试命令**:
```bash
# 查看设备注册状态
curl -X GET http://139.196.165.140:10010/api/mobile/F001/devices/list \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 问题 3: 通知点击无反应

**原因**: 未设置 `onNotificationTapped` 处理器

**解决方案**:
```typescript
usePushNotifications({
  onNotificationTapped: (response) => {
    const data = response.notification.request.content.data;
    if (data.screen) {
      navigation.navigate(data.screen, data);
    }
  },
});
```

---

## API 接口

### 设备管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/mobile/{factoryId}/devices/register` | POST | 注册设备 |
| `/api/mobile/{factoryId}/devices/unregister` | DELETE | 注销设备 |
| `/api/mobile/{factoryId}/devices/token` | PUT | 更新 Token |
| `/api/mobile/{factoryId}/devices/list` | GET | 获取设备列表 |
| `/api/mobile/{factoryId}/devices/test-notification` | POST | 测试推送 |
| `/api/mobile/{factoryId}/devices/{deviceId}/toggle` | PUT | 启用/禁用设备 |

---

## 最佳实践

### 1. 推送内容

- ✅ 标题简短明确（< 20 字）
- ✅ 内容描述清晰（< 100 字）
- ✅ 包含可操作的信息
- ❌ 避免发送敏感信息

### 2. 推送时机

- ✅ 工作时间发送（8:00 - 22:00）
- ✅ 紧急通知可随时发送
- ❌ 避免频繁推送（限制频率）

### 3. 用户体验

- ✅ 允许用户控制通知类型
- ✅ 提供通知历史记录
- ✅ 支持免打扰模式
- ✅ 点击通知后导航到相关页面

### 4. 性能优化

- ✅ 批量发送（最多 100 条/次）
- ✅ 定期清理长时间未活跃的设备
- ✅ 使用异步发送，避免阻塞主流程

---

## 安全注意事项

1. **Token 安全**
   - Push Token 存储在安全数据库中
   - 定期清理失效 Token

2. **权限控制**
   - 仅允许用户管理自己的设备
   - 工厂管理员可以向所有员工发送通知

3. **数据隐私**
   - 不在推送中包含敏感信息（如密码、手机号完整号码）
   - 详细信息在应用内查看

---

## 生产环境配置

### 1. 构建生产版本

```bash
cd frontend/CretasFoodTrace

# Android
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production
```

### 2. 配置推送证书（iOS）

iOS 推送需要 APNs 证书：

```bash
# 在 Apple Developer Portal 创建 APNs Key
# 下载 .p8 文件并配置到 EAS
eas credentials
```

### 3. 环境变量

确保后端配置了正确的环境变量：

```properties
# application.yml
expo:
  push:
    api-url: https://exp.host/--/api/v2/push/send
    batch-size: 100
```

---

## 维护任务

### 定期清理未活跃设备

建议每月运行一次：

```java
// 在后端创建定时任务
@Scheduled(cron = "0 0 2 1 * ?") // 每月1号凌晨2点
public void cleanupInactiveDevices() {
    LocalDateTime cutoff = LocalDateTime.now().minusDays(30);
    int deleted = deviceRepository.deleteInactiveDevices(cutoff);
    log.info("清理未活跃设备: 删除 {} 条记录", deleted);
}
```

---

## 参考资源

- [Expo Notifications 官方文档](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Notification 工具](https://expo.dev/notifications)
- [React Navigation Deep Linking](https://reactnavigation.org/docs/deep-linking/)

---

## 技术支持

如有问题，请联系：
- 前端团队：frontend@cretas.com
- 后端团队：backend@cretas.com
- DevOps：devops@cretas.com
