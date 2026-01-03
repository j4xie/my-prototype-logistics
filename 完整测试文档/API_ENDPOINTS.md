# API 端点完整清单

> 来源: http://139.196.165.140:10010/v3/api-docs
> 同步时间: 2026-01-02
> 总端点数: 791

## 目录

- [模块概览](#模块概览)
- [详细端点列表](#详细端点列表)

---

## 模块概览

> **统计**: Controller 总数 57 个, 端点总数 890 个, 已测试 38 个 (66.7%)

### 核心业务模块 (已测试)

| # | 模块名 | 端点数 | 测试状态 |
|---|--------|--------|----------|
| 1 | scheduling-controller (排程调度) | 48 | ✅ 已测试 |
| 2 | 生产加工管理 (processing-controller) | 41 | ✅ 已测试 |
| 3 | 设备管理 (equipment-controller) | 32 | ✅ 已测试 |
| 4 | 移动端接口 (mobile-api-controller) | 35 | ✅ 已测试 |
| 5 | 原材料批次管理 (material-batch-controller) | 26 | ✅ 已测试 |
| 6 | 客户管理 (customer-controller) | 26 | ✅ 已测试 |
| 7 | 工厂设置管理 (factory-controller) | 26 | ✅ 已测试 |
| 8 | 用户管理 (user-controller) | 25 | ✅ 已测试 |
| 9 | quality-check-item-controller (质检项配置) | 22 | ✅ 已测试 |
| 10 | 转换率管理 (conversion-controller) | 20 | ✅ 已测试 |
| 11 | 生产计划管理 (production-plan-controller) | 20 | ✅ 已测试 |
| 12 | 供应商管理 (supplier-controller) | 19 | ✅ 已测试 |
| 13 | 报表统计管理 (report-controller) | 19 | ✅ 已测试 |
| 14 | 时间统计管理 (time-stats-controller) | 17 | ✅ 已测试 |
| 15 | 产品类型管理 (product-type-controller) | 16 | ✅ 已测试 |
| 16 | 考勤打卡管理 (timeclock-controller) | 14 | ✅ 已测试 |
| 17 | 原材料类型管理 (raw-material-type-controller) | 13 | ✅ 已测试 |
| 18 | approval-chain-controller (审批链) | 12 | ✅ 已测试 |
| 19 | 部门管理 (department-controller) | 11 | ✅ 已测试 |
| 20 | disposal-controller (处置管理) | 11 | ✅ 已测试 |
| 21 | shipment-controller (出货管理) | 11 | ✅ 已测试 |
| 22 | 紧急插单管理 (urgent-insert-controller) | 10 | ✅ 已测试 |
| 23 | 质检处置管理 (quality-disposition-controller) | 9 | ✅ 已测试 |
| 24 | 设备告警管理 (equipment-alerts-controller) | 7 | ✅ 已测试 |
| 25 | 原材料消耗记录管理 (consumption-controller) | 7 | ✅ 已测试 |
| 26 | 溯源管理 (traceability-controller) | 5 | ✅ 已测试 |
| 27 | 标签管理 (label-controller) | 20 | ✅ 已测试 |
| 28 | 批次关联管理 (batch-relation-controller) | 11 | ✅ 已测试 |
| 29 | 工单管理 (work-order-controller) | 14 | ✅ 已测试 |

### AI 服务模块 (Phase 3)

| # | 模块名 | 端点数 | 测试状态 |
|---|--------|--------|----------|
| 30 | AI智能分析 (ai-analysis-controller) | 15 | ⏸️ Phase 3 |
| 31 | AI意图配置 (ai-intent-controller) | 14 | ⏸️ Phase 3 |
| 32 | voice-recognition-controller (语音识别) | 12 | ⏸️ Phase 3 |
| 33 | lin-ucb-controller (智能推荐) | 11 | ⏸️ Phase 3 |
| 34 | AI Rules (ai-rules-controller) | 5 | ⏸️ Phase 3 |
| 35 | AI表单助手 (form-assistant-controller) | 5 | ⏸️ Phase 3 |
| 36 | AI配额配置 (ai-quota-controller) | 5 | ⏸️ Phase 3 |
| 37 | ai-business-data-controller (AI业务数据) | 2 | ⏸️ Phase 3 |

### 系统配置模块 (Phase 3)

| # | 模块名 | 端点数 | 测试状态 |
|---|--------|--------|----------|
| 38 | Platform (平台管理) | 22 | ⏸️ Phase 3 |
| 39 | 系统配置 (system-config-controller) | 17 | ⏸️ Phase 3 |
| 40 | Blueprint Version Management (蓝图版本) | 16 | ⏸️ Phase 3 |
| 41 | Rules (规则管理) | 16 | ⏸️ Phase 3 |
| 42 | 表单模板管理 (form-template-controller) | 15 | ⏸️ Phase 3 |
| 43 | EncodingRules (编码规则) | 15 | ⏸️ Phase 3 |
| 44 | 配置变更管理 (config-change-controller) | 14 | ⏸️ Phase 3 |
| 45 | Factory Blueprint Management (工厂蓝图) | 9 | ⏸️ Phase 3 |
| 46 | 行业模板包 (industry-template-controller) | 8 | ⏸️ Phase 3 |
| 47 | 通知管理 (notification-controller) | 8 | ⏸️ Phase 3 |
| 48 | Rule Pack Management (规则包) | 4 | ⏸️ Phase 3 |
| 49 | 系统管理 (system-controller) | 3 | ⏸️ Phase 3 |

### 扩展功能模块 (Phase 3)

| # | 模块名 | 端点数 | 测试状态 |
|---|--------|--------|----------|
| 50 | 白名单管理 (whitelist-controller) | 20 | ⏸️ Phase 3 |
| 51 | 混批排产管理 (mixed-batch-controller) | 12 | ⏸️ Phase 3 |
| 52 | work-session-controller (工作会话) | 12 | ⏸️ Phase 3 |
| 53 | 工作类型管理 (work-type-controller) | 10 | ⏸️ Phase 3 |
| 54 | supplier-admission-controller (供应商准入) | 7 | ⏸️ Phase 3 |
| 55 | 相机管理 (camera-controller) | 7 | ⏸️ Phase 3 |
| 56 | 原材料规格配置管理 (material-spec-controller) | 5 | ⏸️ Phase 3 |
| 57 | export-controller (数据导出) | 5 | ⏸️ Phase 3 |

### 端点分布统计

| 模块类型 | Controller 数 | 端点数 | 占比 |
|----------|--------------|--------|------|
| 核心业务模块 | 29 | 572 | 64.3% |
| AI 服务模块 | 8 | 69 | 7.8% |
| 系统配置模块 | 12 | 147 | 16.5% |
| 扩展功能模块 | 8 | 102 | 11.4% |
| **总计** | **57** | **890** | **100%** |

---

## 详细端点列表

### 1. Auth Controller (认证模块)

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | `/api/mobile/auth/unified-login` | 统一登录 | 否 |
| POST | `/api/mobile/auth/refresh-token` | 刷新 Token | 否 |
| POST | `/api/mobile/auth/logout` | 退出登录 | 是 |
| POST | `/api/mobile/auth/change-password` | 修改密码 | 是 |
| POST | `/api/mobile/auth/reset-password` | 重置密码 | 否 |
| GET | `/api/mobile/auth/validate-token` | 验证 Token | 是 |
| POST | `/api/mobile/auth/send-verification-code` | 发送验证码 | 否 |
| POST | `/api/mobile/auth/verify-code` | 验证验证码 | 否 |

### 2. User Controller (用户管理)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/users` | 获取用户列表 |
| GET | `/api/mobile/{factoryId}/users/{id}` | 获取用户详情 |
| GET | `/api/mobile/{factoryId}/users/me` | 获取当前用户 |
| POST | `/api/mobile/{factoryId}/users` | 创建用户 |
| PUT | `/api/mobile/{factoryId}/users/{id}` | 更新用户 |
| DELETE | `/api/mobile/{factoryId}/users/{id}` | 删除用户 |
| GET | `/api/mobile/{factoryId}/users/by-role/{role}` | 按角色查询 |
| GET | `/api/mobile/{factoryId}/users/by-department/{deptId}` | 按部门查询 |
| PUT | `/api/mobile/{factoryId}/users/{id}/status` | 更新状态 |
| PUT | `/api/mobile/{factoryId}/users/{id}/role` | 更新角色 |
| GET | `/api/mobile/{factoryId}/users/search` | 搜索用户 |
| GET | `/api/mobile/{factoryId}/users/export` | 导出用户 |

### 3. Scheduling Controller (排程调度)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/scheduling/plans` | 获取排程计划列表 |
| GET | `/api/mobile/{factoryId}/scheduling/plans/{id}` | 获取计划详情 |
| POST | `/api/mobile/{factoryId}/scheduling/plans` | 创建排程计划 |
| PUT | `/api/mobile/{factoryId}/scheduling/plans/{id}` | 更新计划 |
| DELETE | `/api/mobile/{factoryId}/scheduling/plans/{id}` | 删除计划 |
| POST | `/api/mobile/{factoryId}/scheduling/plans/{id}/start` | 开始执行 |
| POST | `/api/mobile/{factoryId}/scheduling/plans/{id}/complete` | 完成计划 |
| POST | `/api/mobile/{factoryId}/scheduling/plans/{id}/cancel` | 取消计划 |
| GET | `/api/mobile/{factoryId}/scheduling/slots` | 获取可用时段 |
| GET | `/api/mobile/{factoryId}/scheduling/slots/by-date` | 按日期查询时段 |
| POST | `/api/mobile/{factoryId}/scheduling/slots/check-conflict` | 冲突检测 |
| GET | `/api/mobile/{factoryId}/scheduling/urgent-insert/slots` | 紧急插单时段 |
| POST | `/api/mobile/{factoryId}/scheduling/urgent-insert` | 创建紧急插单 |
| GET | `/api/mobile/{factoryId}/scheduling/calendar` | 排程日历视图 |
| GET | `/api/mobile/{factoryId}/scheduling/statistics` | 排程统计 |
| ... | (共 48 个端点) | |

### 4. Processing Controller (加工批次)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/processing/batches` | 获取批次列表 |
| GET | `/api/mobile/{factoryId}/processing/batches/{id}` | 获取批次详情 |
| POST | `/api/mobile/{factoryId}/processing/batches` | 创建批次 |
| PUT | `/api/mobile/{factoryId}/processing/batches/{id}` | 更新批次 |
| DELETE | `/api/mobile/{factoryId}/processing/batches/{id}` | 删除批次 |
| POST | `/api/mobile/{factoryId}/processing/batches/{id}/start` | 开始加工 |
| POST | `/api/mobile/{factoryId}/processing/batches/{id}/complete` | 完成加工 |
| POST | `/api/mobile/{factoryId}/processing/batches/{id}/material-consumption` | 原料消耗 |
| GET | `/api/mobile/{factoryId}/processing/batches/{id}/consumption-history` | 消耗历史 |
| GET | `/api/mobile/{factoryId}/processing/batches/by-status/{status}` | 按状态查询 |
| GET | `/api/mobile/{factoryId}/processing/batches/by-date-range` | 按日期范围 |
| GET | `/api/mobile/{factoryId}/processing/batches/statistics` | 批次统计 |
| ... | (共 25 个端点) | |

### 5. Quality Inspection Controller (质量检测)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/quality-inspections` | 获取质检记录 |
| GET | `/api/mobile/{factoryId}/quality-inspections/{id}` | 获取记录详情 |
| POST | `/api/mobile/{factoryId}/quality-inspections` | 创建质检记录 |
| PUT | `/api/mobile/{factoryId}/quality-inspections/{id}` | 更新记录 |
| GET | `/api/mobile/{factoryId}/quality-inspections/by-batch/{batchId}` | 按批次查询 |
| GET | `/api/mobile/{factoryId}/quality-inspections/pending` | 待检列表 |
| POST | `/api/mobile/{factoryId}/quality-inspections/{id}/submit` | 提交质检 |
| GET | `/api/mobile/{factoryId}/quality-inspections/statistics` | 质检统计 |
| ... | (共 18 个端点) | |

### 6. Equipment Controller (设备管理)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/equipments` | 获取设备列表 |
| GET | `/api/mobile/{factoryId}/equipments/{id}` | 获取设备详情 |
| POST | `/api/mobile/{factoryId}/equipments` | 创建设备 |
| PUT | `/api/mobile/{factoryId}/equipments/{id}` | 更新设备 |
| DELETE | `/api/mobile/{factoryId}/equipments/{id}` | 删除设备 |
| GET | `/api/mobile/{factoryId}/equipments/{id}/status` | 获取设备状态 |
| PUT | `/api/mobile/{factoryId}/equipments/{id}/status` | 更新设备状态 |
| GET | `/api/mobile/{factoryId}/equipments/{id}/maintenance-records` | 维护记录 |
| POST | `/api/mobile/{factoryId}/equipments/{id}/maintenance-records` | 创建维护记录 |
| GET | `/api/mobile/{factoryId}/equipments/by-type/{type}` | 按类型查询 |
| GET | `/api/mobile/{factoryId}/equipments/by-status/{status}` | 按状态查询 |
| GET | `/api/mobile/{factoryId}/equipments/statistics` | 设备统计 |
| ... | (共 22 个端点) | |

### 7. Equipment Alerts Controller (设备告警)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/equipment-alerts` | 获取告警列表 |
| GET | `/api/mobile/{factoryId}/equipment-alerts/{id}` | 获取告警详情 |
| POST | `/api/mobile/{factoryId}/equipment-alerts` | 创建告警 |
| PUT | `/api/mobile/{factoryId}/equipment-alerts/{id}/acknowledge` | 确认告警 |
| PUT | `/api/mobile/{factoryId}/equipment-alerts/{id}/resolve` | 解决告警 |
| GET | `/api/mobile/{factoryId}/equipment-alerts/active` | 活跃告警 |
| GET | `/api/mobile/{factoryId}/equipment-alerts/by-equipment/{equipmentId}` | 按设备查询 |
| GET | `/api/mobile/{factoryId}/equipment-alerts/statistics` | 告警统计 |
| ... | (共 15 个端点) | |

### 8. Material Batch Controller (原料批次)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/material-batches` | 获取原料批次列表 |
| GET | `/api/mobile/{factoryId}/material-batches/{id}` | 获取批次详情 |
| POST | `/api/mobile/{factoryId}/material-batches` | 创建原料批次 |
| PUT | `/api/mobile/{factoryId}/material-batches/{id}` | 更新批次 |
| DELETE | `/api/mobile/{factoryId}/material-batches/{id}` | 删除批次 |
| GET | `/api/mobile/{factoryId}/material-batches/by-type/{typeId}` | 按类型查询 |
| GET | `/api/mobile/{factoryId}/material-batches/by-supplier/{supplierId}` | 按供应商 |
| GET | `/api/mobile/{factoryId}/material-batches/available` | 可用批次 |
| GET | `/api/mobile/{factoryId}/material-batches/expiring` | 即将过期 |
| GET | `/api/mobile/{factoryId}/material-batches/statistics` | 库存统计 |
| ... | (共 20 个端点) | |

### 9. Report Controller (报表)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/reports/dashboard/overview` | 仪表盘概览 |
| GET | `/api/mobile/{factoryId}/reports/dashboard/production` | 生产概览 |
| GET | `/api/mobile/{factoryId}/reports/dashboard/quality` | 质量概览 |
| GET | `/api/mobile/{factoryId}/reports/dashboard/equipment` | 设备概览 |
| GET | `/api/mobile/{factoryId}/reports/production` | 生产报表 |
| GET | `/api/mobile/{factoryId}/reports/quality` | 质量报表 |
| GET | `/api/mobile/{factoryId}/reports/efficiency` | 效率报表 |
| GET | `/api/mobile/{factoryId}/reports/cost` | 成本报表 |
| GET | `/api/mobile/{factoryId}/reports/personnel` | 人员报表 |
| GET | `/api/mobile/{factoryId}/reports/trend` | 趋势分析 |
| GET | `/api/mobile/{factoryId}/reports/forecast` | 预测分析 |
| GET | `/api/mobile/{factoryId}/reports/anomaly` | 异常报表 |
| GET | `/api/mobile/{factoryId}/reports/kpi` | KPI 报表 |
| POST | `/api/mobile/{factoryId}/reports/export` | 导出报表 |
| ... | (共 30 个端点) | |

### 10. Customer Controller (客户管理)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/customers` | 获取客户列表 |
| GET | `/api/mobile/{factoryId}/customers/{id}` | 获取客户详情 |
| POST | `/api/mobile/{factoryId}/customers` | 创建客户 |
| PUT | `/api/mobile/{factoryId}/customers/{id}` | 更新客户 |
| DELETE | `/api/mobile/{factoryId}/customers/{id}` | 删除客户 |
| GET | `/api/mobile/{factoryId}/customers/search` | 搜索客户 |
| GET | `/api/mobile/{factoryId}/customers/export` | 导出客户 |
| ... | (共 12 个端点) | |

### 11. Supplier Controller (供应商管理)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/suppliers` | 获取供应商列表 |
| GET | `/api/mobile/{factoryId}/suppliers/{id}` | 获取供应商详情 |
| POST | `/api/mobile/{factoryId}/suppliers` | 创建供应商 |
| PUT | `/api/mobile/{factoryId}/suppliers/{id}` | 更新供应商 |
| DELETE | `/api/mobile/{factoryId}/suppliers/{id}` | 删除供应商 |
| GET | `/api/mobile/{factoryId}/suppliers/search` | 搜索供应商 |
| ... | (共 10 个端点) | |

### 12. Shipment Controller (出货管理)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/shipments` | 获取出货记录 |
| GET | `/api/mobile/{factoryId}/shipments/{id}` | 获取出货详情 |
| POST | `/api/mobile/{factoryId}/shipments` | 创建出货 |
| PUT | `/api/mobile/{factoryId}/shipments/{id}` | 更新出货 |
| DELETE | `/api/mobile/{factoryId}/shipments/{id}` | 删除出货 |
| PUT | `/api/mobile/{factoryId}/shipments/{id}/status` | 更新状态 |
| GET | `/api/mobile/{factoryId}/shipments/by-customer/{customerId}` | 按客户查询 |
| GET | `/api/mobile/{factoryId}/shipments/by-date-range` | 按日期查询 |
| ... | (共 14 个端点) | |

### 13. Traceability Controller (追溯管理)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/traceability/{code}` | 追溯查询 |
| GET | `/api/mobile/{factoryId}/traceability/batch/{batchNumber}` | 批次追溯 |
| POST | `/api/mobile/{factoryId}/traceability/generate` | 生成追溯码 |
| GET | `/api/mobile/{factoryId}/traceability/chain/{batchId}` | 追溯链查询 |
| ... | (共 12 个端点) | |

### 14. Timeclock Controller (考勤打卡)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/timeclock/status` | 获取打卡状态 |
| POST | `/api/mobile/{factoryId}/timeclock/clock-in` | 上班打卡 |
| POST | `/api/mobile/{factoryId}/timeclock/clock-out` | 下班打卡 |
| GET | `/api/mobile/{factoryId}/timeclock/today` | 今日记录 |
| GET | `/api/mobile/{factoryId}/timeclock/history` | 历史记录 |
| GET | `/api/mobile/{factoryId}/timeclock/statistics` | 考勤统计 |
| ... | (共 10 个端点) | |

### 15. Conversion Controller (转换率配置)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/conversions` | 获取转换率列表 |
| GET | `/api/mobile/{factoryId}/conversions/{id}` | 获取配置详情 |
| POST | `/api/mobile/{factoryId}/conversions` | 创建配置 |
| PUT | `/api/mobile/{factoryId}/conversions/{id}` | 更新配置 |
| DELETE | `/api/mobile/{factoryId}/conversions/{id}` | 删除配置 |
| GET | `/api/mobile/{factoryId}/conversions/{id}/history` | 变更历史 |
| ... | (共 8 个端点) | |

### 16. Department Controller (部门管理)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/departments` | 获取部门列表 |
| GET | `/api/mobile/{factoryId}/departments/{id}` | 获取部门详情 |
| POST | `/api/mobile/{factoryId}/departments` | 创建部门 |
| PUT | `/api/mobile/{factoryId}/departments/{id}` | 更新部门 |
| DELETE | `/api/mobile/{factoryId}/departments/{id}` | 删除部门 |
| GET | `/api/mobile/{factoryId}/departments/tree` | 部门树 |
| ... | (共 8 个端点) | |

### 17. AI Services (待测试)

#### AI Rules Controller

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/ai-rules/health` | AI服务健康检查 |
| POST | `/api/mobile/{factoryId}/ai-rules/analyze` | AI分析 |
| POST | `/api/mobile/{factoryId}/ai-rules/predict` | 预测分析 |
| POST | `/api/mobile/{factoryId}/ai-rules/recommend` | 推荐建议 |
| GET | `/api/mobile/{factoryId}/ai-rules/reports` | AI报告列表 |

#### Form Assistant Controller

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/mobile/{factoryId}/form-assistant/generate-schema` | 生成表单Schema |
| POST | `/api/mobile/{factoryId}/form-assistant/validate` | 表单验证 |
| POST | `/api/mobile/{factoryId}/form-assistant/suggest` | 字段建议 |
| ... | (共 8 个端点) | |

### 18. Label Controller (标签管理)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/labels` | 获取标签列表 (分页) |
| GET | `/api/mobile/{factoryId}/labels/stats` | 标签统计 |
| GET | `/api/mobile/{factoryId}/labels/expiring` | 即将过期标签 |
| GET | `/api/mobile/{factoryId}/labels/expired` | 已过期标签 |
| GET | `/api/mobile/{factoryId}/labels/trace/{traceCode}` | 根据追溯码查询 |
| GET | `/api/mobile/{factoryId}/labels/code/{labelCode}` | 根据标签编码查询 |
| GET | `/api/mobile/{factoryId}/labels/batch/{batchId}` | 根据批次查询标签 |
| GET | `/api/mobile/{factoryId}/labels/{id}` | 获取标签详情 |
| POST | `/api/mobile/{factoryId}/labels` | 创建标签 |
| POST | `/api/mobile/{factoryId}/labels/batch` | 批量创建标签 |
| PUT | `/api/mobile/{factoryId}/labels/{id}` | 更新标签 |
| POST | `/api/mobile/{factoryId}/labels/{id}/print` | 打印标签 |
| POST | `/api/mobile/{factoryId}/labels/{id}/apply` | 贴标操作 |
| POST | `/api/mobile/{factoryId}/labels/{id}/void` | 作废标签 |
| DELETE | `/api/mobile/{factoryId}/labels/{id}` | 删除标签 |
| GET | `/api/mobile/{factoryId}/labels/generate-code` | 生成标签编码 |
| GET | `/api/mobile/{factoryId}/labels/generate-trace-code` | 生成追溯码 |
| ... | (共 20 个端点) | |

### 19. Batch Relation Controller (批次关联/追溯)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/batch-relations` | 获取批次关联列表 (分页) |
| GET | `/api/mobile/{factoryId}/batch-relations/production/{productionBatchId}` | 根据生产批次查询 |
| GET | `/api/mobile/{factoryId}/batch-relations/material/{materialBatchId}` | 根据原材料批次查询 |
| GET | `/api/mobile/{factoryId}/batch-relations/trace/forward/{materialBatchId}` | 正向追溯 (原料→成品) |
| GET | `/api/mobile/{factoryId}/batch-relations/trace/backward/{productionBatchId}` | 反向追溯 (成品→原料) |
| GET | `/api/mobile/{factoryId}/batch-relations/unverified` | 获取未验证关联 |
| GET | `/api/mobile/{factoryId}/batch-relations/{id}` | 获取关联详情 |
| POST | `/api/mobile/{factoryId}/batch-relations` | 创建批次关联 |
| PUT | `/api/mobile/{factoryId}/batch-relations/{id}` | 更新批次关联 |
| POST | `/api/mobile/{factoryId}/batch-relations/{id}/verify` | 验证批次关联 |
| DELETE | `/api/mobile/{factoryId}/batch-relations/{id}` | 删除批次关联 |
| ... | (共 11 个端点) | |

### 20. Work Order Controller (工单管理)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mobile/{factoryId}/work-orders` | 获取工单列表 (分页) |
| GET | `/api/mobile/{factoryId}/work-orders/stats` | 工单统计 |
| GET | `/api/mobile/{factoryId}/work-orders/overdue` | 逾期工单 |
| GET | `/api/mobile/{factoryId}/work-orders/my` | 我的工单 |
| GET | `/api/mobile/{factoryId}/work-orders/{id}` | 获取工单详情 |
| POST | `/api/mobile/{factoryId}/work-orders` | 创建工单 |
| PUT | `/api/mobile/{factoryId}/work-orders/{id}` | 更新工单 |
| POST | `/api/mobile/{factoryId}/work-orders/{id}/start` | 开始工单 |
| POST | `/api/mobile/{factoryId}/work-orders/{id}/complete` | 完成工单 |
| POST | `/api/mobile/{factoryId}/work-orders/{id}/cancel` | 取消工单 |
| POST | `/api/mobile/{factoryId}/work-orders/{id}/assign` | 分配工单 |
| DELETE | `/api/mobile/{factoryId}/work-orders/{id}` | 删除工单 |
| ... | (共 14 个端点) | |

---

## 附录

### 通用查询参数

| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码 (从 0 开始) |
| size | int | 每页数量 (默认 20) |
| sort | string | 排序字段 (如 createdAt,desc) |
| search | string | 搜索关键词 |

### 通用响应格式

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 分页响应格式

```json
{
  "success": true,
  "data": {
    "content": [...],
    "totalElements": 100,
    "totalPages": 5,
    "size": 20,
    "number": 0
  }
}
```

### 相关文档

- [测试计划](./TEST_PLAN.md)
- [测试结果](./TEST_RESULTS.md)
- [Bug 清单](./BUG_TRACKER.md)
