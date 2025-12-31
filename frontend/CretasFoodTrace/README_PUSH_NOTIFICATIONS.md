# Expo 推送通知 - 快速导航

## 文档索引

| 文档 | 说明 | 路径 |
|------|------|------|
| **实现总结** | 完整的实现总结和文件清单 | `/PUSH_NOTIFICATIONS_IMPLEMENTATION.md` |
| **使用指南** | API 文档、故障排查、最佳实践 | `./PUSH_NOTIFICATIONS_GUIDE.md` |
| **集成示例** | 前后端集成示例代码 | `./PUSH_INTEGRATION_EXAMPLE.md` |

---

## 快速开始

### 1. 前端使用（推荐）

在 App 根组件中添加一行代码即可：

```typescript
import { usePushNotifications } from './src/hooks/usePushNotifications';

function App() {
  usePushNotifications({
    onNotificationTapped: (response) => {
      const data = response.notification.request.content.data;
      navigation.navigate(data.screen, data);
    },
  });

  return <YourApp />;
}
```

### 2. 后端使用

```java
@Autowired
private PushNotificationService pushNotificationService;

// 发送通知
pushNotificationService.sendToUser(
    userId,
    "通知标题",
    "通知内容",
    Map.of("type", "approval", "approvalId", 123)
);
```

---

## 核心文件

### 前端
- **Hook**: `src/hooks/usePushNotifications.ts`
- **Service**: `src/services/pushNotificationService.ts`
- **API**: `src/services/api/deviceApiClient.ts`
- **测试页面**: `src/screens/test/PushNotificationTestScreen.tsx`

### 后端
- **Controller**: `backend-java/src/main/java/com/cretas/aims/controller/DeviceController.java`
- **Service**: `backend-java/src/main/java/com/cretas/aims/service/impl/PushNotificationServiceImpl.java`
- **Entity**: `backend-java/src/main/java/com/cretas/aims/entity/DeviceRegistration.java`

---

## 测试工具

### 命令行测试
```bash
# 使用测试脚本
export ACCESS_TOKEN='your-token'
./scripts/test-push-notifications.sh all
```

### 应用内测试
导航到 `PushNotificationTestScreen` 进行可视化测试

---

## 主要功能

✅ 自动设备注册/注销
✅ 前台/后台通知
✅ 通知点击导航
✅ 应用角标管理
✅ 多设备支持
✅ 批量推送
✅ 分类通知渠道（Android）

---

## 需要帮助？

查看完整文档：
- [使用指南](./PUSH_NOTIFICATIONS_GUIDE.md)
- [集成示例](./PUSH_INTEGRATION_EXAMPLE.md)
- [实现总结](../../PUSH_NOTIFICATIONS_IMPLEMENTATION.md)

或联系技术支持：dev@cretas.com
