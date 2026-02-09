---
name: fair-mab-balancing
displayName: 公平性均衡调度
description: 基于Fair-MAB算法确保工人获得公平的任务分配机会，避免高效工人被过度使用
version: 1.0.0
triggers:
  - "公平分配"
  - "均衡调度"
  - "轮换"
  - "公平性"
tools:
  - FairMABService
  - WorkerAllocationFeedbackRepository
contextNeeded:
  - factoryId
  - workerHistory
parameters:
  fairnessRatio: 0.8
  explorationBonus: 0.1
  virtualQueueDecay: 0.95
requiredPermission: "scheduling:fairness:execute"
category: "scheduling"
priority: 60
---
# 功能说明
基于学术论文 "Fair Learning for Combinatorial MAB" 实现

## 核心公式
Score(w,t) = LinUCB(w,t) + α × FairnessBonus(w) + β × VirtualQueue(w)

## 参数说明
- fairnessRatio: 目标公平比例，每个工人至少获得此比例的任务
- explorationBonus: 探索加成，鼓励尝试不常分配的工人
- virtualQueueDecay: 虚拟队列衰减率
