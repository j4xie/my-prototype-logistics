# Expo 推送通知集成示例

## 完整集成示例

### 1. App.tsx 集成

```typescript
// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <NavigationContainer>
      <AppWithNotifications />
    </NavigationContainer>
  );
}

function AppWithNotifications() {
  const navigation = useNavigation();

  // 初始化推送通知
  usePushNotifications({
    onNotificationReceived: (notification) => {
      // 前台收到通知时的处理
      console.log('收到通知:', notification.request.content.title);

      // 可选：显示 Toast 或对话框
      Alert.alert(
        notification.request.content.title || '通知',
        notification.request.content.body || ''
      );
    },
    onNotificationTapped: (response) => {
      // 用户点击通知时的处理
      const data = response.notification.request.content.data;

      console.log('通知数据:', data);

      // 根据通知类型导航到不同页面
      switch (data.type) {
        case 'approval':
          navigation.navigate('ApprovalDetail', {
            approvalId: data.approvalId,
            approvalType: data.approvalType,
          });
          break;

        case 'quality':
          navigation.navigate('QualityInspectionDetail', {
            inspectionId: data.inspectionId,
          });
          break;

        case 'plan_change':
          navigation.navigate('PlanDetail', {
            planId: data.planId,
          });
          break;

        case 'urgent_insert':
          navigation.navigate('UrgentInsertScreen', {
            planId: data.planId,
          });
          break;

        default:
          // 未知类型，导航到首页
          navigation.navigate('Home');
      }
    },
  });

  return <RootNavigator />;
}
```

---

### 2. 后端集成示例

#### 审批流程中发送通知

```java
// ApprovalService.java
@Service
@RequiredArgsConstructor
public class ApprovalServiceImpl implements ApprovalService {

    private final PushNotificationService pushNotificationService;

    @Override
    public void submitForApproval(Long planId, Long submitterId) {
        // 1. 创建审批记录
        Approval approval = createApproval(planId, submitterId);

        // 2. 获取审批人
        Long approverId = getNextApprover(planId);

        // 3. 发送推送通知
        pushNotificationService.sendApprovalNotification(
            approverId,
            "plan",
            approval.getId(),
            "您有一条新的生产计划审批"
        );

        log.info("审批通知已发送: approverId={}, approvalId={}",
                 approverId, approval.getId());
    }
}
```

#### 质检结果通知

```java
// QualityInspectionService.java
@Service
@RequiredArgsConstructor
public class QualityInspectionServiceImpl implements QualityInspectionService {

    private final PushNotificationService pushNotificationService;

    @Override
    public void completeInspection(Long inspectionId, String result) {
        QualityInspection inspection = getInspectionById(inspectionId);

        // 保存质检结果
        inspection.setResult(result);
        inspectionRepository.save(inspection);

        // 获取需要通知的人员
        Long productionManagerId = getProductionManagerId(inspection.getFactoryId());

        // 发送通知
        String message = result.equals("PASSED")
            ? "质检通过，可以继续生产"
            : "质检未通过，请查看详情";

        pushNotificationService.sendQualityNotification(
            productionManagerId,
            inspectionId,
            result,
            message
        );
    }
}
```

#### 计划变更通知

```java
// SchedulingService.java
@Service
@RequiredArgsConstructor
public class SchedulingServiceImpl implements SchedulingService {

    private final PushNotificationService pushNotificationService;
    private final UserRepository userRepository;

    @Override
    public void updateProductionPlan(Long planId, ProductionPlanDTO updates) {
        ProductionPlan plan = getPlanById(planId);

        // 更新计划
        plan.setScheduledDate(updates.getScheduledDate());
        plan.setQuantity(updates.getQuantity());
        productionPlanRepository.save(plan);

        // 通知相关人员
        List<User> affectedUsers = userRepository.findByFactoryIdAndRoleIn(
            plan.getFactoryId(),
            List.of("PRODUCTION_MANAGER", "DISPATCHER", "WORKER")
        );

        Long[] userIds = affectedUsers.stream()
            .map(User::getId)
            .toArray(Long[]::new);

        pushNotificationService.sendPlanChangeNotification(
            userIds,
            planId,
            "SCHEDULE_UPDATE",
            "生产计划已调整，请查看最新安排"
        );

        log.info("计划变更通知已发送: planId={}, affectedUsers={}",
                 planId, userIds.length);
    }
}
```

---

### 3. 前端接收通知示例

#### 审批详情页面

```typescript
// ApprovalDetailScreen.tsx
import React, { useEffect } from 'react';
import { useRoute, RouteProp } from '@react-navigation/native';

type RouteParams = {
  ApprovalDetail: {
    approvalId: number;
    approvalType: string;
    // 来自推送通知的参数
  };
};

export default function ApprovalDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'ApprovalDetail'>>();
  const { approvalId, approvalType } = route.params;

  useEffect(() => {
    // 加载审批详情
    loadApprovalDetail(approvalId, approvalType);

    // 标记通知为已读（如果有通知 ID）
    // markNotificationAsRead(notificationId);
  }, [approvalId]);

  return (
    <View>
      {/* 审批详情 UI */}
    </View>
  );
}
```

---

### 4. 自定义通知样式（Android）

在后端发送推送时，可以自定义通知样式：

```java
public void sendCustomNotification(String pushToken) {
    Map<String, Object> message = new HashMap<>();
    message.put("to", pushToken);
    message.put("title", "标题");
    message.put("body", "内容");
    message.put("sound", "default");

    // Android 样式配置
    Map<String, Object> android = new HashMap<>();
    android.put("channelId", "approval");
    android.put("color", "#FF5722");
    android.put("icon", "./assets/notification-icon.png");
    android.put("sound", "notification-sound.wav");

    // 大图样式
    Map<String, Object> bigPicture = new HashMap<>();
    bigPicture.put("uri", "https://example.com/image.jpg");
    android.put("bigPicture", bigPicture);

    message.put("android", android);

    // iOS 样式配置
    Map<String, Object> ios = new HashMap<>();
    ios.put("sound", "notification-sound.wav");
    ios.put("badge", 1);
    message.put("ios", ios);

    // 发送
    sendPushRequest(Collections.singletonList(message));
}
```

---

### 5. 通知优先级控制

```java
// 紧急通知（高优先级）
pushNotificationService.sendToDevice(
    pushToken,
    "紧急通知",
    "生产线故障，请立即处理",
    data,
    "high"  // 高优先级
);

// 一般通知（默认优先级）
pushNotificationService.sendToDevice(
    pushToken,
    "一般通知",
    "今日生产任务已完成",
    data,
    "default"  // 默认优先级
);
```

---

### 6. 批量发送优化

```java
@Service
public class BatchNotificationService {

    private final PushNotificationService pushNotificationService;
    private final DeviceRegistrationRepository deviceRepository;

    public void sendDailyReport(String factoryId) {
        // 获取所有设备
        List<DeviceRegistration> devices =
            deviceRepository.findByFactoryIdAndIsEnabledTrue(factoryId);

        // 分批发送（每批 100 个）
        List<List<DeviceRegistration>> batches =
            partition(devices, 100);

        for (List<DeviceRegistration> batch : batches) {
            String[] tokens = batch.stream()
                .map(DeviceRegistration::getPushToken)
                .toArray(String[]::new);

            pushNotificationService.sendBatch(
                tokens,
                "每日报告",
                "今日生产数据已生成，点击查看",
                Map.of("type", "daily_report", "date", LocalDate.now().toString())
            );
        }
    }

    private <T> List<List<T>> partition(List<T> list, int size) {
        List<List<T>> partitions = new ArrayList<>();
        for (int i = 0; i < list.size(); i += size) {
            partitions.add(list.subList(i, Math.min(i + size, list.size())));
        }
        return partitions;
    }
}
```

---

### 7. 定时清理任务

```java
@Component
public class DeviceCleanupTask {

    private final DeviceRegistrationRepository deviceRepository;

    @Scheduled(cron = "0 0 2 * * ?") // 每天凌晨 2 点
    public void cleanupInactiveDevices() {
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        int deleted = deviceRepository.deleteInactiveDevices(thirtyDaysAgo);
        log.info("清理未活跃设备: 删除 {} 条记录", deleted);
    }
}
```

---

### 8. 错误处理

```java
@Service
public class SafePushNotificationService {

    private final PushNotificationService pushNotificationService;

    public void sendNotificationSafely(Long userId, String title, String body) {
        try {
            pushNotificationService.sendToUser(userId, title, body, null);
        } catch (Exception e) {
            // 推送失败不应影响主业务流程
            log.error("推送发送失败: userId={}, error={}", userId, e.getMessage());

            // 可选：将失败的推送保存到数据库，稍后重试
            saveFailedNotification(userId, title, body);
        }
    }

    private void saveFailedNotification(Long userId, String title, String body) {
        // 保存到 failed_notifications 表
    }
}
```

---

### 9. 测试工具

#### 快速测试脚本

```bash
#!/bin/bash
# test-push-notification.sh

# 配置
API_BASE="http://139.196.165.140:10010"
FACTORY_ID="F001"
ACCESS_TOKEN="your-access-token"

# 测试推送
echo "发送测试推送..."
curl -X POST "${API_BASE}/api/mobile/${FACTORY_ID}/devices/test-notification" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json"

echo -e "\n\n查看设备列表..."
curl -X GET "${API_BASE}/api/mobile/${FACTORY_ID}/devices/list" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  | jq .

echo -e "\n测试完成"
```

---

## 常见问题

### Q1: 推送在前台显示，后台不显示？

A: 检查 `Notifications.setNotificationHandler` 配置：

```typescript
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

### Q2: iOS 推送无声音？

A: 确保在 `app.json` 中配置了声音文件：

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "sounds": ["./assets/notification-sound.wav"]
        }
      ]
    ]
  }
}
```

### Q3: 如何实现推送分组？

A: 使用 Android 通知渠道（Channel）：

```typescript
await Notifications.setNotificationChannelAsync('approval', {
  name: '审批提醒',
  importance: Notifications.AndroidImportance.HIGH,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#FF5722',
});
```

---

## 下一步

- [ ] 集成深度链接（Deep Linking）
- [ ] 添加推送统计和分析
- [ ] 实现推送重试机制
- [ ] 添加用户推送偏好设置
- [ ] 实现推送历史记录
