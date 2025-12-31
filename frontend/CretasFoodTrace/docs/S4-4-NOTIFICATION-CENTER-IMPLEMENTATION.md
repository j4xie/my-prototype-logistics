# S4-4 通知中心 UI 实现报告

## 概述

完成了完整的通知中心界面实现，包括 API 客户端、通知列表屏幕和气泡组件。所有代码严格遵循 TypeScript 类型安全规范，禁止使用 `as any`，并使用 `isAxiosError` 进行错误处理。

---

## 已创建的文件

### 1. API 客户端

**文件路径**: `/src/services/api/notificationApiClient.ts`

**功能**:
- 完整类型定义（`Notification`, `NotificationListResponse`, `NotificationType`）
- 7个核心 API 方法：
  - `getNotifications()` - 获取通知列表（分页）
  - `getUnreadCount()` - 获取未读数量
  - `getRecentNotifications()` - 获取最近10条通知
  - `getNotificationById()` - 获取通知详情
  - `markAsRead()` - 标记单条为已读
  - `markAllAsRead()` - 标记全部已读
  - `deleteNotification()` - 删除通知
- 使用 `logger.createContextLogger('NotificationAPI')` 记录日志
- 严格类型安全，无 `any` 类型

**对接后端 API**:
```
GET    /api/mobile/{factoryId}/notifications
GET    /api/mobile/{factoryId}/notifications/unread-count
GET    /api/mobile/{factoryId}/notifications/recent
GET    /api/mobile/{factoryId}/notifications/{id}
PUT    /api/mobile/{factoryId}/notifications/{id}/read
PUT    /api/mobile/{factoryId}/notifications/mark-all-read
DELETE /api/mobile/{factoryId}/notifications/{id}
```

---

### 2. 通知中心屏幕

**文件路径**: `/src/screens/common/NotificationCenterScreen.tsx`

**核心功能**:
- ✅ 通知列表展示（分页加载）
- ✅ 6种类型筛选（全部/告警/信息/警告/成功/系统）
- ✅ 未读/已读状态区分（未读用粗体显示，浅蓝背景）
- ✅ 单条删除（点击右上角 x 图标）
- ✅ 标记已读/全部已读
- ✅ 下拉刷新 + 滚动加载更多
- ✅ 点击通知跳转到相关页面（根据 `source` 字段）
- ✅ 高优先级通知用红色左边框标识

**UI 设计规范**:
- 主色调: `#1976D2` (项目主题色)
- 不同类型图标和颜色：
  - ALERT: 红色 `#F44336` (alert-circle)
  - INFO: 蓝色 `#2196F3` (information)
  - WARNING: 橙色 `#FF9800` (alert)
  - SUCCESS: 绿色 `#4CAF50` (check-circle)
  - SYSTEM: 灰色 `#9E9E9E` (cog)
- 未读通知: 粗体标题 + 浅蓝背景 `#F3F8FF`
- 高优先级通知: 红色左边框 + 红色未读点

**智能时间格式化**:
- 1分钟内: "刚刚"
- 60分钟内: "X分钟前"
- 24小时内: "X小时前"
- 7天内: "X天前"
- 7天以上: 显示日期

**错误处理**:
- 使用 `isAxiosError` 类型守卫
- 明确错误提示，不返回假数据
- 使用项目 `logger` 记录日志

---

### 3. 通知气泡组件

**文件路径**: `/src/components/common/NotificationBadge.tsx`

**功能**:
- 显示未读通知数量
- 超过99显示 "99+"
- 无未读时自动隐藏
- 支持3种大小（small/medium/large）
- 自定义背景色和文字颜色

**使用示例**:
```tsx
import { NotificationBadge } from '@/components/common';

<NotificationBadge count={5} />
<NotificationBadge count={150} size="small" />
<NotificationBadge count={0} /> // 不显示
```

---

### 4. 组件导出文件

**文件路径**: `/src/components/common/index.ts`

**内容**:
```typescript
export { default as NotificationBadge } from './NotificationBadge';
export { default as MaterialBatchSelector } from './MaterialBatchSelector';
export { default as ProductTypeSelector } from './ProductTypeSelector';
export { default as SupplierSelector } from './SupplierSelector';
export { default as CustomerSelector } from './CustomerSelector';
export { default as MarkdownRenderer } from './MarkdownRenderer';
```

---

## 集成指南

### 1. 在导航中添加通知中心

**方式一：添加到主导航栈**
```typescript
// 在主导航器中添加
import NotificationCenterScreen from '@/screens/common/NotificationCenterScreen';

<Stack.Screen
  name="NotificationCenter"
  component={NotificationCenterScreen}
/>
```

**方式二：在首页添加入口**
```tsx
import { NotificationBadge } from '@/components/common';

// 在首页顶部添加通知图标
<TouchableOpacity onPress={() => navigation.navigate('NotificationCenter')}>
  <MaterialCommunityIcons name="bell" size={24} color="#212121" />
  <NotificationBadge count={unreadCount} size="small" />
</TouchableOpacity>
```

### 2. 获取未读数量

```typescript
import { notificationApiClient } from '@/services/api/notificationApiClient';

const loadUnreadCount = async () => {
  const response = await notificationApiClient.getUnreadCount();
  if (response.success) {
    setUnreadCount(response.data.count);
  }
};
```

### 3. 发送通知（后端）

后端已实现 `NotificationService`，可通过以下方式发送通知：

```java
// 发送给单个用户
notificationService.sendNotification(
  factoryId, userId, "标题", "内容",
  NotificationType.INFO, "SCHEDULING", scheduleId
);

// 发送给角色
notificationService.sendToRole(
  factoryId, FactoryUserRole.dispatcher, "标题", "内容",
  NotificationType.ALERT, "BATCH", batchId
);

// 调度专用通知
notificationService.notifyScheduleDelayed(
  factoryId, scheduleId, "延期原因", 0.85
);
```

---

## 技术规范遵循

### ✅ TypeScript 类型安全
- 所有接口明确定义类型
- 禁止使用 `as any`
- 使用类型守卫 `isAxiosError`

### ✅ 错误处理
```typescript
catch (error) {
  notificationLogger.error('操作失败', error);
  if (isAxiosError(error)) {
    Alert.alert('错误', error.response?.data?.message || '操作失败');
  } else if (error instanceof Error) {
    Alert.alert('错误', error.message);
  }
}
```

### ✅ 日志记录
- 使用 `logger.createContextLogger()` 创建上下文日志
- 记录关键操作（加载、标记已读、删除）
- 记录错误详情

### ✅ API 响应处理
- 统一 `ApiResponse<T>` 格式
- 检查 `response.success` 后使用数据
- 不返回假数据，明确显示错误

---

## 待完成事项

### 1. 路由跳转逻辑完善

当前实现了基础跳转逻辑，需根据实际导航结构调整：

```typescript
// 需要根据实际路由名称调整
case 'SCHEDULING':
  navigation.navigate('PlanDetail', { planId: notification.sourceId });
  break;
case 'BATCH':
  navigation.navigate('ProductionBatchDetail', { batchId: notification.sourceId });
  break;
```

### 2. 实时通知推送（可选）

可以集成 WebSocket 或推送服务实现实时通知：

```typescript
// 示例：使用 WebSocket
const ws = new WebSocket('ws://server/notifications');
ws.onmessage = (event) => {
  const newNotification = JSON.parse(event.data);
  setNotifications(prev => [newNotification, ...prev]);
  setUnreadCount(prev => prev + 1);
};
```

### 3. 通知声音和震动（可选）

```typescript
import { Audio } from 'expo-av';
import { Vibration } from 'react-native';

const playNotificationSound = async () => {
  const { sound } = await Audio.Sound.createAsync(
    require('@/assets/sounds/notification.mp3')
  );
  await sound.playAsync();
};

Vibration.vibrate([0, 200, 100, 200]);
```

---

## 测试建议

### 1. 单元测试

```typescript
describe('NotificationApiClient', () => {
  it('should fetch notifications', async () => {
    const response = await notificationApiClient.getNotifications();
    expect(response.success).toBe(true);
    expect(Array.isArray(response.data.content)).toBe(true);
  });

  it('should mark notification as read', async () => {
    const response = await notificationApiClient.markAsRead(1);
    expect(response.success).toBe(true);
    expect(response.data.isRead).toBe(true);
  });
});
```

### 2. 集成测试

- 创建测试通知
- 验证筛选功能
- 测试分页加载
- 测试标记已读
- 测试删除通知

---

## 总结

本次实现完成了：

1. ✅ **API 客户端** - 完整对接后端 7 个通知接口
2. ✅ **通知中心屏幕** - 包含筛选、分页、刷新、删除等功能
3. ✅ **通知气泡组件** - 支持多种尺寸和自定义样式
4. ✅ **组件导出文件** - 统一管理通用组件

**代码质量**:
- 严格 TypeScript 类型安全
- 统一错误处理机制
- 完整日志记录
- 遵循项目代码规范

**下一步**:
- 集成到主导航栈
- 在首页添加通知入口
- 根据实际路由调整跳转逻辑
- 可选：添加实时推送和通知声音
