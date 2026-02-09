---
name: temp-worker-boost
displayName: 临时工培养策略
description: 给临时工更多学习机会，分配简单任务加速技能提升，同时保证最低分配数
version: 1.0.0
triggers:
  - "临时工"
  - "新人培训"
  - "新员工"
  - "实习"
tools:
  - TempWorkerService
  - WorkerFeatureLearningService
contextNeeded:
  - factoryId
  - workerType
  - hireDate
parameters:
  boostFactor: 1.5
  maxConsecutiveDays: 3
  minWeeklyAssignments: 3
  skillDecayDays: 14
  preferLowComplexity: true
requiredPermission: "scheduling:temp-worker:execute"
category: "scheduling"
priority: 70
---
# 功能说明
专门针对临时工和新人的调度策略

## 核心逻辑
1. 识别临时工（入职 < 30天 或 标记为临时工）
2. LinUCB权重降低到 0.7倍（能力评估不稳定）
3. 公平性权重提升到 1.5倍（需要更多练习机会）
4. 优先分配低复杂度SKU
5. 保证每周最少N次分配

## 技能成长追踪
- 记录初始技能等级
- 追踪技能成长率
- 效率达标后建议转正
