你需要完成两个任务:

  任务 A: P5 推送通知对接
  目标文件:
  - backend-java/src/main/java/com/cretas/aims/service/PushNotificationService.java
  - frontend 推送接收处理

  步骤:
  1. 检查现有 PushNotificationService 实现
  2. 决定使用 FCM (Firebase) 还是 APNs 或 Expo Push
  3. 实现真实推送发送逻辑
  4. 前端添加推送接收处理

  任务 B: P6 平台管理完善
  目标文件:
  - frontend/CretasFoodTrace/src/screens/platform/SystemMonitoringScreen.tsx
  - frontend/CretasFoodTrace/src/screens/platform/PlatformReportsScreen.tsx

  步骤:
  1. 检查现有 Screen 实现
  2. 添加服务健康检查 API 调用
  3. 实现跨工厂对比报表逻辑

  验收: 推送可送达设备，平台管理界面功能完整