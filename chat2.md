你需要修复 frontend 中 hrApiClient.ts 的 6 个 TODO 方法。

  目标文件:
  - frontend/CretasFoodTrace/src/services/api/hrApiClient.ts

  需要修复的方法 (行号):
  1. 378行: getAttendanceAnomalies() - 返回复用逻辑
  2. 393行: resolveAnomaly() - 返回 {success:true}
  3. 412行: getPerformanceStats() - 返回硬编码数据
  4. 447行: getEmployeePerformanceList() - 返回空数组
  5. 471行: getEmployeeAIAnalysis() - 返回 null
  6. 486行: requestEmployeeAIAnalysis() - 返回模拟成功

  步骤:
  1. 先读取 hrApiClient.ts 了解现有模式
  2. 检查后端是否有对应端点 (HRController.java, TimeclockController.java)
  3. 如后端有端点，直接对接；如没有，需先实现后端
  4. 确保 TypeScript 类型与后端 DTO 一致

  后端参考:
  - backend-java/src/main/java/com/cretas/aims/controller/TimeclockController.java
  - backend-java/src/main/java/com/cretas/aims/service/TimeclockService.java

  验收: npx tsc --noEmit 通过，API 返回真实数据