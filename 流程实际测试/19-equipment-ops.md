# 19. 设备管理 (CRUD/维修/告警)

> **🟡 R18 QA Medium-Deep (2026-04-17 06:58, test 139:8097)**: POST /F001/equipment/6/maintenance (EQ001 速冻隧道机) 首次返回 500 NPE → 查 log `Cannot invoke Integer.intValue() because current is null` at `VersionGeneration.increment` → 定位 **Bug #257 Hibernate @Version NPE on legacy NULL rows**. 修复: SQL backfill `UPDATE equipment_maintenance/batch_equipment_usage/equipment_alerts SET version=0 WHERE version IS NULL` (3698 rows test) + 并行 session 加 Flyway `V20260420_01/02` entity-level default + NOT NULL. 再 POST 200 ✅ + 批次回写 lastMaintenanceDate=2026-04-17 + nextMaintenanceDate=2026-05-07 + updatedAt 刷新. **Rule 4 caveat**: UI 无"新建维护"按钮, 创建走 fetch POST 非真 locator → 标 medium-deep. commit `b1637219e` + `263fa7e7e`.
>
> **🟡 R18 UI 修复**: /equipment/list 的"添加设备"+"编辑"按钮改为 disabled + tooltip "V2 版本上线"(之前空吐"开发中"toast). 前端 list/index.vue 修.
>
> **🟡 QA Smoke (2026-04-17 上午 legacy)**: /equipment/list 15 records 显示 (电子秤 x11, 真空包装机 VP-1000, 速冻隧道机 SD-5000), 子菜单 3 项 (设备列表/维护记录/告警管理) 加载.

**涉及角色**: equipment (主) / admin / foreman (工厂车间)
**耗时**: 15 min

---

## 19.1 模块总览

| 模块 | URL |
|------|-----|
| 设备列表 | `/equipment/list` |
| 维修单 | `/equipment/maintenance` |
| 告警 | `/equipment/alerts` |
| 设备类型/规格 | `/equipment/categories` (可选) |

---

## 19.2 设备列表 CRUD (`/equipment/list`)

### 19.2.1 新建设备
1. equipment 账号进 `/equipment/list`
2. 点 "新建设备"
3. 字段:
   - 设备编号 assetCode (必填): `EQ-001`
   - 设备名 name (必填): `灌装机-1号线`
   - 类别 category (下拉): 灌装 / 混合 / 烘焙 / 冷链
   - 规格型号 specification: `KRY-500L`
   - 供应商 supplier: `XX 设备公司`
   - 采购日期 purchaseDate
   - 使用年限 usefulLife (年)
   - 车间 workshop / 工位 station
   - 状态 status: 运行中 / 维修中 / 停用 / 报废
   - 备注
4. 保存

### 19.2.2 搜索 + 筛选
- 按编号/名称关键字
- 按类别/状态/车间筛选

### 19.2.3 编辑 / 删除 / 查看
- 行级操作

### 19.2.4 状态切换
- 点 "**停用**" / "**报废**" / "**启用**"
- 需填原因

### 19.2.5 设备详情
- 点 "查看" 进详情
- Tab "基本信息" / "维修记录" / "保养记录" / "告警历史"

### 19.2.6 二维码生成 (可选)
- 每设备 QR 码, 扫码进维修页

---

## 19.3 维修单 (`/equipment/maintenance`)

### 19.3.1 故障上报
**账号**: operator / foreman
1. 进 `/equipment/maintenance` → "**故障上报**"
2. 字段:
   - 设备 equipmentId (下拉, 必填): 选
   - 故障描述 (必填, 多行): `电机异响, 停机`
   - 故障时间: 自动 now (可改)
   - 严重程度: 低/中/高/紧急
   - 上报人: 自动填
3. 提交

### ✅ PASS
- Toast "故障已上报"
- 状态 `PENDING_REPAIR`
- 如严重度为紧急, **同时生成告警**

### 19.3.2 分配维修
**账号**: equipment
- 维修单列表找 PENDING_REPAIR
- 点 "**分配**" → 选维修人 → 确定
- 状态变 `ASSIGNED`

### 19.3.3 维修执行
- 维修人点 "**开始维修**"
- 状态 `IN_PROGRESS`

### 19.3.4 完成维修
- 维修人填:
  - 故障原因 cause
  - 维修方法 solution
  - 更换部件 parts (列表)
  - 维修费用 cost
  - 维修耗时 duration (小时)
- 点 "**完成**"
- 状态 `COMPLETED`

### 19.3.5 验收
**账号**: operator / foreman (报修人)
- 点 "**验收通过**" / "**不合格**"
- 合格 → `ACCEPTED`, 设备状态回 "运行中"
- 不合格 → 返回维修

---

## 19.4 告警管理 (`/equipment/alerts`)

### 19.4.1 告警列表
- 自动生成: 传感器数据异常 / 故障上报 / 维护到期
- 字段: 设备 / 告警类型 / 严重度 / 时间 / 状态 (未处理/处理中/已解决/已忽略)

### 19.4.2 筛选
- 按严重度 (低/中/高/紧急)
- 按状态
- 按日期范围

### 19.4.3 处理告警
1. 列表点告警行 "**处理**"
2. 弹框:
   - 处理人: 自动
   - 处理动作 (下拉): 修复 / 调整 / 忽略
   - 处理备注
3. 确定
✅ 状态变 "处理中" / "已解决"

### 19.4.4 一键忽略
- 点 "**忽略**"
- 填忽略原因 (如 "误报")
- 状态 `IGNORED`

### 19.4.5 批量操作
- 多选告警 + 批量处理 / 批量忽略

---

## 19.5 保养计划 (可选, 如果有)

### 19.5.1 保养计划 CRUD
- 每设备配保养周期 (每月/每季/每年)
- 到期自动生成告警 + 待办

### 19.5.2 执行保养
- 保养记录录入: 执行人/时间/操作/备注/照片

---

## 19.6 本节 Checklist (16 项)

| # | 项目 | 账号 | 勾选 |
|---|------|------|------|
| 1 | 19.2.1 新建设备 | equipment | ☐ |
| 2 | 19.2.2 搜索筛选 | equipment | ☐ |
| 3 | 19.2.4 状态切换 | equipment | ☐ |
| 4 | 19.2.5 详情 Tab 切换 | equipment | ☐ |
| 5 | 19.3.1 故障上报 | operator | ☐ ⭐ |
| 6 | 19.3.1 紧急故障自动生成告警 | operator | ☐ |
| 7 | 19.3.2 分配维修人 | equipment | ☐ |
| 8 | 19.3.3 开始维修 | equipment | ☐ |
| 9 | 19.3.4 完成维修 (含费用/部件) | equipment | ☐ |
| 10 | 19.3.5 验收通过 | operator | ☐ |
| 11 | 19.3.5 验收不合格返修 | operator | ☐ |
| 12 | 19.4.1 告警列表加载 | equipment | ☐ |
| 13 | 19.4.2 筛选工作 | equipment | ☐ |
| 14 | 19.4.3 处理告警 | equipment | ☐ |
| 15 | 19.4.4 忽略告警 (带原因) | equipment | ☐ |
| 16 | 19.4.5 批量处理 | equipment | ☐ |
