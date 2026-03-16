# 工序生产(Process-Mode)完整性评估报告

**日期**: 2026-03-14
**评估方式**: Agent Team (3 Researcher + Analyst + Critic + Integrator)

## Executive Summary

工序生产系统**后端就绪度 85%**，报工+审批链路已可用，但存在 **1 个 P0 阻断**(NFC签到调错 API 必返 400)和 **1 个 P1 业务体验问题**(150% 超量硬拦截)。修复 P0 后整体就绪度可达 **60-65/100**，满足有限上线条件。

## 上线前必须修的 2 项 (P0)

| # | 问题 | 根因 | 修复 | 工时 |
|---|------|------|------|------|
| **P0-A** | NFC签到 Process Mode 下 100% 返回 400 | `NfcCheckinScreen.tsx:242` 调用 `/work-reporting/checkin`，`CheckinRequest.java:17` 要求 `@NotNull batchId`，无 processTaskId 字段。签退同样崩溃。 | 前端 process-mode 分支改为调用已有的 `ProcessCheckinController`(`/process-checkin`) | **2-3h** |
| **P0-B** | 150% 超量是硬 return 非确认弹窗 | `ProcessTaskReportScreen.tsx:50-52` Alert 后直接 `return`，水产品出品率波动大会频繁阻断工人报工 | 改为带"仍然提交"按钮的确认弹窗 | **1h** |

## 短期优化 (P1, 上线后一周内)

| # | 问题 | 修复 | 工时 |
|---|------|------|------|
| P1-1 | generateFromProduct 无前端 UI 入口 | Web-Admin 添加"从产品生成工序任务"按钮 | 8h |
| P1-2 | 员工显示"员工 #12345"非姓名 | NfcCheckinScreen 签到列表改显示员工姓名 | 2h |
| P1-3 | 字体 12px / 按钮 size=small 偏小 | ProcessTaskReportScreen 改为 14-16px / medium | 2h |
| P1-4 | 校准定时器硬编码 F001 | 改为动态查询所有 PROCESS 模式工厂 | 1h |

## 需求覆盖矩阵

| 客户需求 | 后端 | RN 前端 | Vue 前端 | E2E 测试 | 操作体验 |
|---------|------|---------|---------|---------|---------|
| 1. 按工序排计划 | 85% | 0% (无入口) | 0% (无入口) | 0% | N/A |
| 2. 产品关联工序 | 95% | 75% | 90% | 80% | 良好 |
| 3. NFC签到按工序 | 20% (DTO不匹配) | 70% (UI有,API错) | N/A | 10% | **阻断** |
| 4. 报工+审批 | 90% | 85% | 85% | 60% | 75% |
| 5. 操作简单 | N/A | 40% | 60% | 0% | **不达标** |
| 6. 数据准确可追溯 | 90% | 80% | 70% | 30% | 80% |

## E2E 测试覆盖缺口

| 场景 | 状态 | 说明 |
|------|------|------|
| 工序管理 CRUD | ✅ 完整 | VUE-01/02/19/20/23/25 |
| 产品-工序关联 | ⚠️ 缺排序 | VUE-03/08/09/10 有增删无排序 |
| **generateFromProduct** | ❌ 零覆盖 | 最大业务缺口 |
| **跨端同步** | ❌ 零覆盖 | RN报工→Vue审批→RN更新 |
| **状态机流转** | ❌ 零覆盖 | PENDING→...→SUPPLEMENTING→恢复 |
| **NFC签到(工序模式)** | ❌ 零覆盖 | 仅有批次模式 E2E |
| 正常报工 UI | ⚠️ 半覆盖 | RN-PT-04 导航到页面但未提交 |
| 审批通过/驳回 | ✅ 已覆盖 | VUE-11/12/13 |
| 批量审批 | ✅ 已覆盖 | VUE-13 |
| 150% 超量 | ❌ 未覆盖 | |
| 补报全流程 | ❌ 未覆盖 | 仅有入口 UI 检查 |
| 多角色权限 | ✅ 已覆盖 | VUE-21 + RN-07 |

**注意**: 44/44 Playwright 测试中约 15-19 处为 console.log SKIP（条件不满足时软跳过），CI 绿灯但实际执行到断言的约 25 个。

## Process Note
- Mode: Full
- Researchers: 3 (需求覆盖 / 测试覆盖 / 操作体验)
- Total sources: 11 key source files verified
- Key disagreements: 4 resolved (就绪度评分/generateFromProduct优先级/注释矛盾/RN测试SKIP), 1 unresolved (精确评分)
- Phases: Research (3 parallel) → Analysis → Critique → Integration
