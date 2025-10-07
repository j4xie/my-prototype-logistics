# 白垩纪食品溯源系统 - 认证系统规划文档

**文档版本**: v1.0
**创建日期**: 2025-01-05
**实施周期**: 4周
**文档状态**: 待实施

---

## 📋 目录

1. [认证系统概述](#认证系统概述)
2. [角色权限体系](#角色权限体系)
3. [登录认证设计](#登录认证设计)
4. [注册流程设计](#注册流程设计)
5. [忘记密码/重置密码设计](#忘记密码重置密码设计)
6. [数据库设计](#数据库设计)
7. [API接口设计](#api接口设计)
8. [前端页面设计](#前端页面设计)
9. [实施计划](#实施计划)
10. [验收标准](#验收标准)

---

## 认证系统概述

### 1.1 系统定位

白垩纪食品溯源系统采用**简化的认证系统设计**，聚焦于实用性和安全性的平衡。

**设计原则**:
- 🎯 **简单实用**: 移除复杂的验证流程（短信验证码）
- 🔐 **安全可靠**: 基于白名单+安全问题的双重验证
- 📱 **移动优先**: 优化移动端用户体验
- 🏭 **多租户**: 支持多工厂独立运营

### 1.2 核心功能

**认证功能**:
- ✅ 统一登录（自动识别平台用户/工厂用户）
- ✅ 白名单注册（无需短信验证）
- ✅ 安全问题找回密码（3个安全问题验证）
- ✅ 自动用户名生成
- ✅ 7级角色权限体系

**移除的功能**（简化设计）:
- ❌ 生物识别登录（指纹/Face ID）- 不实现
- ❌ 短信验证码验证 - 使用白名单替代
- ❌ 邮箱输入 - 不需要
- ❌ 用户名手动输入 - 系统自动生成
- ❌ 设备绑定一键登录 - 不实现

### 1.3 技术架构

```
┌─────────────────────────────────────────┐
│            移动端 (React Native)          │
│  ┌──────────────────────────────────┐   │
│  │  LoginScreen (登录)              │   │
│  │  RegisterScreen (注册)           │   │
│  │  ForgotPasswordScreen (忘记密码) │   │
│  └──────────────────────────────────┘   │
└─────────────────┬───────────────────────┘
                  │ HTTPS/REST API
                  ↓
┌─────────────────────────────────────────┐
│          后端API (Node.js + Express)     │
│  ┌──────────────────────────────────┐   │
│  │  /api/mobile/auth/unified-login  │   │
│  │  /api/mobile/auth/register       │   │
│  │  /api/mobile/auth/verify-identity│   │
│  │  /api/mobile/auth/reset-password │   │
│  └──────────────────────────────────┘   │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│            数据库 (MySQL)                │
│  ┌──────────────────────────────────┐   │
│  │  users (用户表)                  │   │
│  │  platform_admins (平台管理员)    │   │
│  │  user_whitelist (白名单)         │   │
│  │  user_security_questions (安全问题)│   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## 角色权限体系

### 2.1 角色层级架构

```
┌──────────────────────────────────────────────┐
│              平台层 (Platform Layer)          │
│  ┌────────────────────────────────────────┐  │
│  │  platform_admin (平台管理员)            │  │
│  │  - 管理所有工厂                         │  │
│  │  - 管理所有用户                         │  │
│  │  - 平台级配置                           │  │
│  │  - 数据访问: 所有工厂所有数据           │  │
│  │  - 登录方式: 用户名+密码                │  │
│  │  - 登录后导航: PlatformScreen           │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
                      │
                      ↓
┌──────────────────────────────────────────────┐
│              工厂层 (Factory Layer)           │
│  ┌────────────────────────────────────────┐  │
│  │  factory_super_admin (工厂超级管理员)   │  │
│  │  - 工厂所有权限                         │  │
│  │  - 所有部门数据                         │  │
│  │  - 用户管理                             │  │
│  │  - 数据访问: 本工厂所有数据             │  │
│  │  - 登录方式: 用户名+密码                │  │
│  │  - 登录后导航: AdminScreen              │  │
│  └────────────────────────────────────────┘  │
│                      │                        │
│         ┌────────────┼────────────┐           │
│         ↓            ↓            ↓           │
│  ┌──────────┐ ┌─────────────┐ ┌──────────┐  │
│  │permission│ │ department  │ │ operator │  │
│  │  _admin  │ │   _admin    │ │          │  │
│  │权限管理员│ │ 部门管理员  │ │  操作员  │  │
│  │          │ │             │ │          │  │
│  │登录方式: │ │登录方式:    │ │登录方式: │  │
│  │用户名密码│ │用户名密码   │ │用户名密码│  │
│  │          │ │             │ │          │  │
│  │导航:     │ │导航:        │ │导航:     │  │
│  │User      │ │Department   │ │Processing│  │
│  │Management│ │Screen       │ │Screen    │  │
│  └──────────┘ └─────────────┘ └──────────┘  │
│         │                                    │
│         ↓                                    │
│    ┌──────┐                                  │
│    │viewer│                                  │
│    │查看者│                                  │
│    │      │                                  │
│    │登录: │                                  │
│    │用户名│                                  │
│    │密码  │                                  │
│    │      │                                  │
│    │导航: │                                  │
│    │Home  │                                  │
│    │Screen│                                  │
│    └──────┘                                  │
│         │                                    │
│         ↓                                    │
│  ┌────────────┐                              │
│  │unactivated │                              │
│  │  未激活    │                              │
│  │            │                              │
│  │登录: 禁止  │                              │
│  │            │                              │
│  │提示: 账号  │                              │
│  │未激活请联系│                              │
│  │管理员      │                              │
│  └────────────┘                              │
└──────────────────────────────────────────────┘
```

### 2.2 角色权限详细清单

#### **平台角色**

##### platform_admin (平台管理员)

**基本信息**:
| 属性 | 值 |
|-----|---|
| 权限级别 | 0 (最高) |
| 用户类型 | platform |
| 数据库表 | platform_admins |
| 登录方式 | 用户名 + 密码 |
| 登录后导航 | PlatformScreen |

**权限清单**:

**工厂管理**:
- ✅ create_factory - 创建新工厂
- ✅ delete_factory - 删除工厂
- ✅ manage_all_factories - 管理所有工厂
- ✅ view_factories - 查看工厂列表
- ✅ view_factory_details - 查看工厂详情
- ✅ factory_activation_control - 工厂启用/停用

**用户管理**:
- ✅ manage_all_users - 管理所有工厂的所有用户
- ✅ create_users - 创建用户
- ✅ delete_users - 删除用户
- ✅ activate_users - 激活用户
- ✅ assign_roles - 分配角色
- ✅ view_users - 查看用户列表

**白名单管理**:
- ✅ manage_whitelist - 管理所有工厂白名单
- ✅ add_whitelist_users - 添加白名单
- ✅ remove_whitelist_users - 删除白名单
- ✅ whitelist_bulk_import - 批量导入白名单

**平台管理**:
- ✅ platform_settings - 平台设置
- ✅ system_monitoring - 系统监控
- ✅ platform_backup - 平台数据备份
- ✅ manage_platform_admins - 管理其他平台管理员

**数据分析**:
- ✅ view_platform_analytics - 查看平台级分析
- ✅ export_platform_data - 导出平台数据
- ✅ cross_factory_reports - 跨工厂报表

**系统功能**:
- ✅ audit_all_logs - 查看所有审计日志
- ✅ global_notifications - 全局通知发送

**数据访问范围**:
- 所有工厂的所有数据
- 所有用户的所有信息
- 所有系统日志

---

#### **工厂角色**

##### factory_super_admin (工厂超级管理员)

**基本信息**:
| 属性 | 值 |
|-----|---|
| 权限级别 | 5 (工厂内最高) |
| 用户类型 | factory |
| 数据库表 | users |
| 登录方式 | 用户名 + 密码 |
| 登录后导航 | AdminScreen |
| 部门访问 | 所有部门 |

**权限清单**:

**用户管理**:
- ✅ manage_factory_users - 管理本工厂用户
- ✅ create_users - 创建用户
- ✅ delete_users - 删除用户
- ✅ activate_users - 激活用户
- ✅ assign_roles - 分配角色（除factory_super_admin外）

**白名单管理**:
- ✅ manage_factory_whitelist - 管理本工厂白名单
- ✅ add_whitelist_users - 添加白名单
- ✅ remove_whitelist_users - 删除白名单

**工厂管理**:
- ✅ factory_settings - 工厂设置
- ✅ manage_all_departments - 管理所有部门
- ✅ factory_configuration - 工厂配置

**业务功能（所有部门）**:
- ✅ processing_batch_create - 创建加工批次
- ✅ processing_batch_view_all - 查看所有批次
- ✅ processing_batch_edit - 编辑批次
- ✅ processing_batch_delete - 删除批次
- ✅ quality_inspection_submit - 提交质检
- ✅ quality_inspection_approve - 审批质检
- ✅ quality_inspection_view_all - 查看所有质检
- ✅ equipment_monitoring_view - 查看设备监控
- ✅ timeclock_view_all - 查看所有打卡记录
- ✅ dashboard_view_factory - 查看工厂仪表板

**数据管理**:
- ✅ view_all_factory_data - 查看工厂所有数据
- ✅ export_factory_data - 导出工厂数据
- ✅ delete_factory_data - 删除数据

**报表**:
- ✅ view_factory_reports - 查看工厂报表
- ✅ create_custom_reports - 创建自定义报表
- ✅ schedule_reports - 定时报表

**系统功能**:
- ✅ audit_factory_logs - 查看工厂审计日志
- ✅ factory_notifications - 工厂通知管理

**数据访问范围**:
- 本工厂所有数据
- 所有部门数据
- 所有用户数据

---

##### permission_admin (权限管理员)

**基本信息**:
| 属性 | 值 |
|-----|---|
| 权限级别 | 10 |
| 用户类型 | factory |
| 数据库表 | users |
| 登录方式 | 用户名 + 密码 |
| 登录后导航 | UserManagementScreen |
| 部门访问 | 所有部门（只读） |

**权限清单**:

**用户管理**:
- ✅ activate_users - 激活用户
- ✅ assign_roles - 分配角色（除factory_super_admin和permission_admin外）
- ✅ manage_permissions - 管理权限
- ✅ view_users - 查看用户列表

**白名单管理**:
- ✅ manage_whitelist - 管理白名单
- ✅ add_whitelist_users - 添加白名单
- ✅ remove_whitelist_users - 删除白名单
- ✅ whitelist_bulk_operations - 批量操作

**审核功能**:
- ✅ review_user_applications - 审核用户申请
- ✅ approve_user_registrations - 审批注册
- ✅ reject_user_applications - 拒绝申请

**报表**:
- ✅ view_user_reports - 查看用户报表
- ✅ view_permission_reports - 查看权限报表
- ✅ export_user_data - 导出用户数据

**审计**:
- ✅ view_user_logs - 查看用户日志
- ✅ permission_change_logs - 权限变更日志

**数据访问范围**:
- 本工厂所有用户数据（读写）
- 本工厂所有业务数据（只读）

**不允许的操作**:
- ❌ 不能创建factory_super_admin
- ❌ 不能创建permission_admin
- ❌ 不能删除factory_super_admin
- ❌ 不能修改业务数据

---

##### department_admin (部门管理员)

**基本信息**:
| 属性 | 值 |
|-----|---|
| 权限级别 | 15 |
| 用户类型 | factory |
| 数据库表 | users |
| 登录方式 | 用户名 + 密码 |
| 登录后导航 | DepartmentScreen（根据department） |
| 部门访问 | 仅本部门 |

**部门类型**:
- `farming` - 养殖部门
- `processing` - 加工部门
- `logistics` - 物流部门
- `quality` - 质量部门
- `management` - 管理部门

**权限清单**:

**部门用户管理**:
- ✅ manage_department_users - 管理本部门用户
- ✅ activate_department_users - 激活本部门用户
- ✅ assign_department_roles - 分配角色（仅operator和viewer）
- ✅ manage_department_whitelist - 管理本部门白名单

**部门数据管理**:
- ✅ department_data_management - 本部门数据管理
- ✅ view_department_data - 查看本部门数据
- ✅ edit_department_data - 编辑本部门数据
- ✅ export_department_data - 导出本部门数据

**业务功能（仅本部门）**:
- ✅ processing_batch_create - 创建批次（processing部门）
- ✅ processing_batch_view_department - 查看本部门批次
- ✅ processing_batch_edit - 编辑批次
- ✅ quality_inspection_submit - 提交质检（quality部门）
- ✅ quality_inspection_approve - 审批质检
- ✅ equipment_monitoring_view - 查看设备监控
- ✅ timeclock_view_department - 查看本部门打卡

**报表**:
- ✅ view_department_reports - 查看部门报表
- ✅ create_department_reports - 创建部门报表

**部门设置**:
- ✅ department_settings - 部门设置
- ✅ department_notifications - 部门通知

**数据访问范围**:
- 本部门所有数据
- 本部门用户信息

**不允许的操作**:
- ❌ 不能访问其他部门数据
- ❌ 不能管理其他部门用户
- ❌ 不能修改工厂配置

**导航示例**:
```
processing部门管理员 → ProcessingDashboardScreen
quality部门管理员 → QualityDashboardScreen
farming部门管理员 → FarmingDashboardScreen
```

---

##### operator (操作员)

**基本信息**:
| 属性 | 值 |
|-----|---|
| 权限级别 | 20 |
| 用户类型 | factory |
| 数据库表 | users |
| 登录方式 | 用户名 + 密码 |
| 登录后导航 | ProcessingScreen或其他业务页面 |
| 部门访问 | 仅本部门 |

**权限清单**:

**数据录入**:
- ✅ data_entry - 数据录入
- ✅ create_records - 创建记录
- ✅ update_records - 更新记录（仅本人创建）
- ✅ upload_files - 上传文件

**业务操作**:
- ✅ processing_batch_create - 创建批次
- ✅ processing_batch_view_own - 查看本人批次
- ✅ quality_inspection_submit - 提交质检
- ✅ timeclock_in_out - 打卡
- ✅ equipment_usage_record - 记录设备使用

**查看权限**:
- ✅ view_own_records - 查看本人记录
- ✅ view_department_data - 查看本部门数据（只读）
- ✅ basic_query - 基础查询

**数据访问范围**:
- 本人创建的数据（读写）
- 本部门数据（只读）

**不允许的操作**:
- ❌ 不能删除数据
- ❌ 不能编辑他人数据
- ❌ 不能访问其他部门数据
- ❌ 不能导出数据

---

##### viewer (查看者)

**基本信息**:
| 属性 | 值 |
|-----|---|
| 权限级别 | 30 |
| 用户类型 | factory |
| 数据库表 | users |
| 登录方式 | 用户名 + 密码 |
| 登录后导航 | HomeScreen（只读主页） |
| 部门访问 | 授权部门 |

**权限清单**:

**查看权限**:
- ✅ stats_view_basic - 查看基础统计
- ✅ view_authorized_data - 查看授权数据（只读）
- ✅ view_reports - 查看报表

**数据访问范围**:
- 授权数据（只读）
- 不能创建、编辑、删除任何数据

**不允许的操作**:
- ❌ 不能进行任何写操作
- ❌ 不能导出数据
- ❌ 不能上传文件

**典型使用场景**:
- 财务人员查看生产数据
- 高层领导查看报表
- 外部审计人员

---

##### unactivated (未激活)

**基本信息**:
| 属性 | 值 |
|-----|---|
| 权限级别 | 99 (最低) |
| 用户类型 | factory |
| 数据库表 | users |
| 登录方式 | 禁止登录 |
| 登录后导航 | N/A |

**状态说明**:
- 用户注册后的初始状态（如果后续需要管理员审批）
- 或管理员创建用户后的待激活状态

**登录行为**:
- 尝试登录时返回错误: "账号未激活，请联系管理员"
- 无法访问任何功能

**激活流程**:
```
管理员查看待激活用户列表
    ↓
选择用户 → 分配角色 → 分配部门 → 激活
    ↓
用户收到通知（如有通知系统）
    ↓
用户可以正常登录
```

---

### 2.3 权限矩阵表

| 功能模块 | platform_admin | factory_super_admin | permission_admin | department_admin | operator | viewer |
|---------|----------------|---------------------|------------------|------------------|----------|--------|
| **平台管理** | ✅ 完全 | ❌ | ❌ | ❌ | ❌ | ❌ |
| **工厂管理** | ✅ 所有工厂 | ✅ 本工厂 | ❌ | ❌ | ❌ | ❌ |
| **用户管理** | ✅ 所有用户 | ✅ 工厂所有用户 | ✅ 权限管理 | ✅ 部门用户 | ❌ | ❌ |
| **白名单管理** | ✅ 所有工厂 | ✅ 本工厂 | ✅ 本工厂 | ✅ 本部门 | ❌ | ❌ |
| **批次管理** | ✅ 所有工厂 | ✅ 所有部门 | 👁️ 只读 | ✅ 本部门 | ✅ 创建查看 | 👁️ 只读 |
| **质检管理** | ✅ 所有工厂 | ✅ 所有部门 | 👁️ 只读 | ✅ 本部门 | ✅ 提交 | 👁️ 只读 |
| **员工打卡** | ✅ 所有工厂 | ✅ 所有部门 | 👁️ 只读 | ✅ 本部门 | ✅ 打卡 | 👁️ 只读 |
| **设备监控** | ✅ 所有工厂 | ✅ 所有设备 | 👁️ 只读 | ✅ 本部门设备 | 👁️ 只读 | 👁️ 只读 |
| **成本分析** | ✅ 所有工厂 | ✅ 本工厂 | 👁️ 只读 | ✅ 本部门 | ❌ | 👁️ 只读 |
| **报表导出** | ✅ 所有数据 | ✅ 工厂数据 | ✅ 用户数据 | ✅ 部门数据 | ❌ | ❌ |
| **系统配置** | ✅ 平台配置 | ✅ 工厂配置 | ❌ | ❌ | ❌ | ❌ |

**图例**: ✅ 完全访问 | 👁️ 只读访问 | ❌ 无权访问

---

### 2.4 登录认证方式（统一）

**所有角色统一使用**: 用户名 + 密码

**登录流程**:
```
用户输入用户名和密码
    ↓
点击"登录"按钮
    ↓
前端调用: POST /api/mobile/auth/unified-login
    ↓
后端智能识别用户类型:
    优先级1: 在platform_admins表查找用户名
        ├─ 找到 → 平台用户登录
        └─ 未找到 → 继续查找
    优先级2: 在users表查找用户名
        ├─ 找到 → 工厂用户登录
        └─ 未找到 → 返回"用户不存在"
    ↓
验证密码（bcrypt对比）
    ├─ 密码错误 → 返回"密码错误"
    └─ 密码正确 → 继续
    ↓
检查用户状态
    ├─ isActive = false → 返回"账号未激活"
    └─ isActive = true → 继续
    ↓
生成JWT Token（accessToken + refreshToken）
    ↓
返回用户信息 + Token
    ↓
前端保存Token到SecureStore
    ↓
根据角色导航到对应页面
```

**自动登录**:
```
App启动
    ↓
检查本地Token
    ├─ 无Token → 显示登录页
    └─ 有Token → 验证Token有效性
            ├─ Token过期 → 尝试refreshToken
            │       ├─ 刷新成功 → 自动登录
            │       └─ 刷新失败 → 显示登录页
            └─ Token有效 → 自动登录成功
```

---

## 登录认证设计

### 3.1 统一登录流程

#### 登录界面设计

**EnhancedLoginScreen.tsx**

```typescript
界面布局:
┌─────────────────────────────────┐
│                                  │
│    [Logo] 白垩纪食品溯源系统     │
│                                  │
│  用户名: [___________]           │
│  密码:   [___________] [👁️]     │
│                                  │
│  [ ] 记住密码                     │
│                                  │
│       [登  录]                   │
│                                  │
│  [忘记密码]         [新用户注册]  │
│                                  │
└─────────────────────────────────┘
```

#### API接口

```javascript
POST /api/mobile/auth/unified-login

请求:
{
  username: string,    // 用户名（必填）
  password: string,    // 密码（必填）
  deviceInfo?: {       // 设备信息（可选）
    deviceId: string,
    deviceModel: string,
    platform: 'ios' | 'android',
    osVersion: string,
    appVersion: string
  }
}

响应（成功）:
{
  success: true,
  message: "登录成功",
  user: {
    id: number,
    username: string,
    fullName: string,
    phone: string,
    userType: 'platform' | 'factory',

    // 平台用户特有字段
    role?: 'platform_admin',

    // 工厂用户特有字段
    roleCode?: 'factory_super_admin' | 'permission_admin' | ...,
    factoryId?: string,
    department?: 'farming' | 'processing' | ...,

    permissions: {
      modules: { ... },
      features: [ ... ],
      role: string,
      userType: string,
      level: number
    }
  },
  tokens: {
    accessToken: string,
    refreshToken: string,
    expiresIn: number,    // 秒，默认86400（24小时）
    tokenType: 'Bearer'
  }
}

响应（失败）:
{
  success: false,
  message: string,      // 错误信息
  errorCode?: string    // 错误码
}
```

#### 错误处理（10种场景）

| 错误码 | 错误信息 | 场景 | 前端处理 |
|-------|---------|------|---------|
| INVALID_CREDENTIALS | 用户名或密码错误 | 用户名不存在或密码错误 | 提示用户检查输入 |
| USER_NOT_FOUND | 用户不存在 | 用户名不在数据库 | 提示"请检查用户名" |
| WRONG_PASSWORD | 密码错误 | 密码不正确 | 提示"密码错误，还剩X次机会" |
| ACCOUNT_NOT_ACTIVATED | 账号未激活，请联系管理员 | isActive=false | 提示联系管理员 |
| FACTORY_DISABLED | 所属工厂已停用 | factory.isActive=false | 提示联系平台管理员 |
| ACCOUNT_LOCKED | 账号已锁定 | 登录失败次数过多 | 提示30分钟后重试 |
| NETWORK_ERROR | 网络连接失败 | 网络异常 | 提示检查网络 |
| SERVER_ERROR | 服务器暂时不可用 | 服务器500错误 | 提示稍后重试 |
| TOKEN_EXPIRED | 登录已过期 | Token过期 | 自动刷新或重新登录 |
| INVALID_REQUEST | 请求参数错误 | 参数缺失或格式错误 | 提示输入完整 |

#### 前端错误处理实现

```typescript
// frontend/src/hooks/useLogin.ts
const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: '用户名或密码错误，请重试',
  USER_NOT_FOUND: '用户不存在，请检查用户名',
  WRONG_PASSWORD: '密码错误，请重新输入',
  ACCOUNT_NOT_ACTIVATED: '账号未激活，请联系管理员开通权限',
  FACTORY_DISABLED: '您所属的工厂已停用，请联系平台管理员',
  ACCOUNT_LOCKED: '账号已锁定，请30分钟后再试',
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  SERVER_ERROR: '服务器暂时不可用，请稍后重试',
  TOKEN_EXPIRED: '登录已过期，请重新登录',
  INVALID_REQUEST: '请输入完整的用户名和密码'
};

const handleLoginError = (error: any) => {
  const errorCode = error.code || 'UNKNOWN';
  const message = ERROR_MESSAGES[errorCode] || '登录失败，请重试';

  Alert.alert('登录失败', message, [
    { text: '重试', onPress: () => retry() },
    { text: '忘记密码', onPress: () => navigation.navigate('ForgotPassword') },
    { text: '取消', style: 'cancel' }
  ]);
};
```

### 3.2 登录后导航逻辑

```typescript
// frontend/src/utils/navigationHelper.ts
export const getPostLoginRoute = (user: User) => {
  // 平台用户
  if (user.userType === 'platform') {
    return 'PlatformScreen';
  }

  // 工厂用户 - 根据角色导航
  switch (user.roleCode) {
    case 'factory_super_admin':
      return 'AdminScreen';

    case 'permission_admin':
      return 'UserManagementScreen';

    case 'department_admin':
      // 根据部门导航
      switch (user.department) {
        case 'processing':
          return 'ProcessingDashboardScreen';
        case 'quality':
          return 'QualityDashboardScreen';
        case 'farming':
          return 'FarmingDashboardScreen';
        case 'logistics':
          return 'LogisticsScreen';
        default:
          return 'HomeScreen';
      }

    case 'operator':
      // 根据部门导航到对应操作页面
      switch (user.department) {
        case 'processing':
          return 'ProcessingScreen';
        case 'quality':
          return 'QualityScreen';
        default:
          return 'HomeScreen';
      }

    case 'viewer':
      return 'HomeScreen';

    default:
      return 'HomeScreen';
  }
};
```

---

## 注册流程设计

### 4.1 简化注册流程

#### 核心设计思路

**不使用短信验证码，改用白名单验证**:
- 管理员预先添加允许注册的手机号到白名单
- 用户注册时检查手机号是否在白名单
- 在白名单中即可注册，无需短信验证

**自动生成用户名**:
- 用户无需手动输入用户名
- 系统根据规则自动生成唯一用户名
- 格式: `{工厂代码}_{手机后4位}_{随机2位}`
- 示例: `FAC001_8000_AB`

**强制设置安全问题**:
- 注册时必须设置3个安全问题
- 用于后续找回密码
- 安全问题预设10个选项
- 答案加密存储（bcrypt）

#### 注册流程图

```
┌──────────────────────────────────────────────┐
│  Step 1: 白名单验证                          │
├──────────────────────────────────────────────┤
│  用户输入手机号                              │
│      ↓                                       │
│  点击"检查白名单"                            │
│      ↓                                       │
│  后端查询user_whitelist表                    │
│      ├─ 不在白名单 → 提示"未被授权注册"     │
│      └─ 在白名单 → 返回工厂信息              │
│              ↓                               │
│          展开注册表单                         │
└──────────────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────────────┐
│  Step 2: 填写基本信息                        │
├──────────────────────────────────────────────┤
│  显示:                                       │
│  - 工厂名称（只读，用户确认）                │
│  - 系统用户名（自动生成，只读）              │
│                                              │
│  用户输入:                                   │
│  - 真实姓名（必填）                          │
│  - 密码（必填，强度验证）                    │
│  - 确认密码（必填，一致性检查）              │
└──────────────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────────────┐
│  Step 3: 设置安全问题                        │
├──────────────────────────────────────────────┤
│  用户从预设问题库选择3个问题:                │
│  - 问题1: [下拉选择] 答案1: [输入框]        │
│  - 问题2: [下拉选择] 答案2: [输入框]        │
│  - 问题3: [下拉选择] 答案3: [输入框]        │
│                                              │
│  验证规则:                                   │
│  - 3个问题不能重复                           │
│  - 每个答案至少2个字符                       │
└──────────────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────────────┐
│  Step 4: 提交注册                            │
├──────────────────────────────────────────────┤
│  用户勾选用户协议                            │
│      ↓                                       │
│  点击"注册并登录"                            │
│      ↓                                       │
│  后端处理:                                   │
│  1. 自动生成用户名                           │
│  2. 密码加密（bcrypt）                       │
│  3. 安全问题答案加密（bcrypt）               │
│  4. 创建用户（默认roleCode: viewer）         │
│  5. 创建安全问题记录                         │
│  6. 更新白名单状态为REGISTERED               │
│  7. 生成Token                               │
│      ↓                                       │
│  返回用户信息+Token                          │
│      ↓                                       │
│  前端自动登录                                │
│      ↓                                       │
│  根据角色跳转到对应主页                      │
└──────────────────────────────────────────────┘
```

### 4.2 注册页面设计

#### RegisterScreen.tsx - 界面详细设计

```typescript
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

// 预设安全问题库
const SECURITY_QUESTIONS = [
  { id: 1, question: '您母亲的姓名是什么？' },
  { id: 2, question: '您出生的城市是哪里？' },
  { id: 3, question: '您小学班主任的姓名是什么？' },
  { id: 4, question: '您最喜欢的食物是什么？' },
  { id: 5, question: '您的第一个宠物叫什么名字？' },
  { id: 6, question: '您配偶的生日是几月几号？' },
  { id: 7, question: '您的工号是多少？' },
  { id: 8, question: '您入职的年份是哪一年？' },
  { id: 9, question: '您最喜欢的颜色是什么？' },
  { id: 10, question: '您的身份证后6位是什么？' }
];

export const RegisterScreen = ({ navigation }) => {
  // === State管理 ===
  const [step, setStep] = useState(1); // 当前步骤: 1=白名单验证, 2=填写信息

  // Step 1: 白名单验证
  const [phoneNumber, setPhoneNumber] = useState('');
  const [checkingWhitelist, setCheckingWhitelist] = useState(false);
  const [whitelistVerified, setWhitelistVerified] = useState(false);
  const [factoryInfo, setFactoryInfo] = useState(null);
  const [generatedUsername, setGeneratedUsername] = useState('');

  // Step 2: 基本信息
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Step 3: 安全问题
  const [question1, setQuestion1] = useState(null);
  const [answer1, setAnswer1] = useState('');
  const [question2, setQuestion2] = useState(null);
  const [answer2, setAnswer2] = useState('');
  const [question3, setQuestion3] = useState(null);
  const [answer3, setAnswer3] = useState('');

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // === 密码强度计算 ===
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }

    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 25;

    setPasswordStrength(strength);
  }, [password]);

  // === 检查白名单 ===
  const handleCheckWhitelist = async () => {
    if (!phoneNumber || !/^1[3-9]\d{9}$/.test(phoneNumber)) {
      Alert.alert('提示', '请输入正确的手机号');
      return;
    }

    setCheckingWhitelist(true);

    try {
      const result = await authService.checkWhitelist(phoneNumber);

      if (result.success && result.isInWhitelist) {
        // 白名单验证通过
        setWhitelistVerified(true);
        setFactoryInfo(result.factories[0]); // 取第一个工厂

        // 预览生成的用户名
        const username = await authService.previewUsername(
          result.factories[0].factoryId,
          phoneNumber
        );
        setGeneratedUsername(username);

        setStep(2); // 进入填写信息步骤
      } else {
        Alert.alert('提示', '您的手机号未被授权注册，请联系管理员添加白名单');
      }
    } catch (error) {
      Alert.alert('错误', error.message || '检查白名单失败');
    } finally {
      setCheckingWhitelist(false);
    }
  };

  // === 表单验证 ===
  const validateForm = () => {
    // 真实姓名验证
    if (!fullName || fullName.length < 2) {
      Alert.alert('提示', '请输入真实姓名（至少2个字符）');
      return false;
    }

    // 密码强度验证
    if (passwordStrength < 75) {
      Alert.alert('提示', '密码强度不足，请包含大小写字母和数字，至少8位');
      return false;
    }

    // 确认密码验证
    if (password !== confirmPassword) {
      Alert.alert('提示', '两次输入的密码不一致');
      return false;
    }

    // 安全问题验证
    if (!question1 || !question2 || !question3) {
      Alert.alert('提示', '请选择3个安全问题');
      return false;
    }

    // 检查问题不重复
    if (question1 === question2 || question1 === question3 || question2 === question3) {
      Alert.alert('提示', '安全问题不能重复');
      return false;
    }

    // 答案验证
    if (!answer1 || answer1.length < 2) {
      Alert.alert('提示', '请输入安全问题1的答案（至少2个字符）');
      return false;
    }
    if (!answer2 || answer2.length < 2) {
      Alert.alert('提示', '请输入安全问题2的答案（至少2个字符）');
      return false;
    }
    if (!answer3 || answer3.length < 2) {
      Alert.alert('提示', '请输入安全问题3的答案（至少2个字符）');
      return false;
    }

    // 用户协议
    if (!agreedToTerms) {
      Alert.alert('提示', '请阅读并同意用户协议');
      return false;
    }

    return true;
  };

  // === 提交注册 ===
  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    setIsRegistering(true);

    try {
      const result = await authService.register({
        phoneNumber,
        fullName,
        password,
        confirmPassword,
        securityQuestions: [
          { questionId: question1.id, question: question1.question, answer: answer1 },
          { questionId: question2.id, question: question2.question, answer: answer2 },
          { questionId: question3.id, question: question3.question, answer: answer3 }
        ]
      });

      if (result.success) {
        // 注册成功，自动登录
        Alert.alert('注册成功', `您的用户名是: ${result.user.username}\n请妥善保管`, [
          {
            text: '开始使用',
            onPress: () => {
              // 已经自动登录，直接导航
              const route = getPostLoginRoute(result.user);
              navigation.replace(route);
            }
          }
        ]);
      }
    } catch (error) {
      Alert.alert('注册失败', error.message || '注册失败，请重试');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>新用户注册</Text>

        {/* Step 1: 白名单验证 */}
        {step === 1 && (
          <View style={styles.section}>
            <Text style={styles.stepTitle}>第一步：验证白名单</Text>

            <View style={styles.formField}>
              <Text style={styles.label}>手机号 *</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="请输入11位手机号"
                  keyboardType="phone-pad"
                  maxLength={11}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  editable={!whitelistVerified}
                />
                <TouchableOpacity
                  style={styles.checkButton}
                  onPress={handleCheckWhitelist}
                  disabled={checkingWhitelist || whitelistVerified}
                >
                  {checkingWhitelist ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.checkButtonText}>
                      {whitelistVerified ? '✓ 已验证' : '检查'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Step 2 & 3: 填写信息（白名单验证通过后显示） */}
        {whitelistVerified && step === 2 && (
          <View>
            {/* 工厂信息展示 */}
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>✓ 您已被授权注册</Text>
              <Text style={styles.infoText}>
                工厂名称: {factoryInfo.factoryName}
              </Text>
              <Text style={styles.infoText}>
                系统用户名: {generatedUsername}
              </Text>
              <Text style={styles.infoNote}>
                （请记住您的用户名，登录时需要使用）
              </Text>
            </View>

            {/* 基本信息 */}
            <View style={styles.section}>
              <Text style={styles.stepTitle}>第二步：填写基本信息</Text>

              <View style={styles.formField}>
                <Text style={styles.label}>真实姓名 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="请输入您的真实姓名"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.label}>密码 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="至少8位，包含大小写字母和数字"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                {/* 密码强度指示器 */}
                <View style={styles.strengthIndicator}>
                  <View style={styles.strengthBar}>
                    <View
                      style={[
                        styles.strengthFill,
                        { width: `${passwordStrength}%` },
                        passwordStrength < 50 && styles.strengthWeak,
                        passwordStrength >= 50 && passwordStrength < 75 && styles.strengthMedium,
                        passwordStrength >= 75 && styles.strengthStrong
                      ]}
                    />
                  </View>
                  <Text style={styles.strengthText}>
                    {passwordStrength === 0 && ''}
                    {passwordStrength > 0 && passwordStrength < 50 && '弱'}
                    {passwordStrength >= 50 && passwordStrength < 75 && '中等'}
                    {passwordStrength >= 75 && '强'}
                  </Text>
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.label}>确认密码 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="请再次输入密码"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>
            </View>

            {/* 安全问题 */}
            <View style={styles.section}>
              <Text style={styles.stepTitle}>第三步：设置安全问题（用于找回密码）</Text>

              {/* 安全问题1 */}
              <View style={styles.formField}>
                <Text style={styles.label}>安全问题 1 *</Text>
                <Picker
                  selectedValue={question1?.id}
                  onValueChange={(itemValue) => {
                    const q = SECURITY_QUESTIONS.find(q => q.id === itemValue);
                    setQuestion1(q);
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="请选择安全问题" value={null} />
                  {SECURITY_QUESTIONS.map(q => (
                    <Picker.Item
                      key={q.id}
                      label={q.question}
                      value={q.id}
                      enabled={q.id !== question2?.id && q.id !== question3?.id}
                    />
                  ))}
                </Picker>
                <TextInput
                  style={styles.input}
                  placeholder="请输入答案"
                  value={answer1}
                  onChangeText={setAnswer1}
                  editable={!!question1}
                />
              </View>

              {/* 安全问题2 */}
              <View style={styles.formField}>
                <Text style={styles.label}>安全问题 2 *</Text>
                <Picker
                  selectedValue={question2?.id}
                  onValueChange={(itemValue) => {
                    const q = SECURITY_QUESTIONS.find(q => q.id === itemValue);
                    setQuestion2(q);
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="请选择安全问题" value={null} />
                  {SECURITY_QUESTIONS.map(q => (
                    <Picker.Item
                      key={q.id}
                      label={q.question}
                      value={q.id}
                      enabled={q.id !== question1?.id && q.id !== question3?.id}
                    />
                  ))}
                </Picker>
                <TextInput
                  style={styles.input}
                  placeholder="请输入答案"
                  value={answer2}
                  onChangeText={setAnswer2}
                  editable={!!question2}
                />
              </View>

              {/* 安全问题3 */}
              <View style={styles.formField}>
                <Text style={styles.label}>安全问题 3 *</Text>
                <Picker
                  selectedValue={question3?.id}
                  onValueChange={(itemValue) => {
                    const q = SECURITY_QUESTIONS.find(q => q.id === itemValue);
                    setQuestion3(q);
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="请选择安全问题" value={null} />
                  {SECURITY_QUESTIONS.map(q => (
                    <Picker.Item
                      key={q.id}
                      label={q.question}
                      value={q.id}
                      enabled={q.id !== question1?.id && q.id !== question2?.id}
                    />
                  ))}
                </Picker>
                <TextInput
                  style={styles.input}
                  placeholder="请输入答案"
                  value={answer3}
                  onChangeText={setAnswer3}
                  editable={!!question3}
                />
              </View>
            </View>

            {/* 用户协议 */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
            >
              <View style={styles.checkbox}>
                {agreedToTerms && <Text>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                我已阅读并同意<Text style={styles.link}>《用户协议》</Text>
              </Text>
            </TouchableOpacity>

            {/* 注册按钮 */}
            <TouchableOpacity
              style={[styles.registerButton, isRegistering && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isRegistering}
            >
              {isRegistering ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.registerButtonText}>注册并登录</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 返回登录 */}
        <TouchableOpacity
          style={styles.backToLogin}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.backToLoginText}>已有账号？返回登录</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
```

### 4.3 用户名生成规则

#### 生成算法

```javascript
// backend/src/utils/usernameGenerator.js

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * 生成唯一用户名
 * 格式: {工厂代码}_{手机号后4位}_{随机2位大写字母}
 * 示例: FAC001_8000_AB
 */
export const generateUsername = async (factoryId, phoneNumber) => {
  try {
    // 1. 获取工厂代码
    const factory = await prisma.factory.findUnique({
      where: { id: factoryId },
      select: { id: true }
    });

    if (!factory) {
      throw new Error('工厂不存在');
    }

    const factoryCode = factory.id; // "FAC001"

    // 2. 提取手机号后4位
    const phoneLast4 = phoneNumber.slice(-4); // "8000"

    // 3. 生成随机2位大写字母
    const getRandomLetters = () => {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      return letters[Math.floor(Math.random() * 26)] +
             letters[Math.floor(Math.random() * 26)];
    };

    // 4. 尝试生成唯一用户名（最多尝试10次）
    let username;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const randomPart = getRandomLetters();
      username = `${factoryCode}_${phoneLast4}_${randomPart}`;

      // 检查用户名是否已存在
      const existingUser = await prisma.user.findFirst({
        where: { username }
      });

      if (!existingUser) {
        return username; // 找到唯一用户名，返回
      }

      attempts++;
    }

    // 5. 如果10次都重复，使用时间戳后4位
    const timestamp = Date.now().toString().slice(-4);
    username = `${factoryCode}_${phoneLast4}_${timestamp}`;

    return username;
  } catch (error) {
    console.error('生成用户名失败:', error);
    throw error;
  }
};

/**
 * 预览用户名（注册页面实时显示）
 * 不检查唯一性，只生成预览
 */
export const previewUsername = (factoryId, phoneNumber) => {
  const factoryCode = factoryId;
  const phoneLast4 = phoneNumber.slice(-4);
  return `${factoryCode}_${phoneLast4}_XX`;
};
```

**用户名示例**:
| 工厂代码 | 手机号 | 生成用户名 |
|---------|-------|-----------|
| FAC001 | 13800138000 | FAC001_8000_AB |
| FAC002 | 13912345678 | FAC002_5678_CD |
| FAC003 | 15800001111 | FAC003_1111_EF |

### 4.4 后端注册API设计

#### API接口

```javascript
// backend/src/routes/mobile.js

// 1. 检查白名单（独立接口）
router.post('/auth/check-whitelist', async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    const { checkWhitelistStatus } = await import('../controllers/authController.js');
    const result = await checkWhitelistStatus(phoneNumber);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '检查白名单失败' });
  }
});

// 2. 预览用户名（辅助接口）
router.post('/auth/preview-username', async (req, res) => {
  const { factoryId, phoneNumber } = req.body;

  try {
    const { previewUsername } = await import('../utils/usernameGenerator.js');
    const username = previewUsername(factoryId, phoneNumber);
    res.json({ success: true, username });
  } catch (error) {
    res.status(500).json({ success: false, message: '生成用户名失败' });
  }
});

// 3. 注册接口（单接口完成整个注册流程）
router.post('/auth/register', async (req, res) => {
  const {
    phoneNumber,
    fullName,
    password,
    confirmPassword,
    securityQuestions
  } = req.body;

  try {
    const { registerUser } = await import('../controllers/authController.js');
    const result = await registerUser({
      phoneNumber,
      fullName,
      password,
      confirmPassword,
      securityQuestions
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '注册失败' });
  }
});
```

#### Controller实现

```javascript
// backend/src/controllers/authController.js

import { generateUsername } from '../utils/usernameGenerator.js';

/**
 * 用户注册（完整流程）
 */
export const registerUser = async (data) => {
  const {
    phoneNumber,
    fullName,
    password,
    confirmPassword,
    securityQuestions
  } = data;

  try {
    // 1. 验证密码一致性
    if (password !== confirmPassword) {
      return { success: false, message: '两次输入的密码不一致' };
    }

    // 2. 验证密码强度
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return { success: false, message: passwordValidation.errors.join('；') };
    }

    // 3. 检查白名单
    const whitelist = await prisma.userWhitelist.findFirst({
      where: {
        phoneNumber,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      },
      include: { factory: true }
    });

    if (!whitelist) {
      return { success: false, message: '手机号未在白名单中或白名单已过期' };
    }

    const factoryId = whitelist.factoryId;

    // 4. 检查手机号是否已注册
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: phoneNumber },
          { factoryId, fullName } // 同工厂同姓名也视为重复
        ]
      }
    });

    if (existingUser) {
      return { success: false, message: '该手机号已被注册或姓名重复' };
    }

    // 5. 生成唯一用户名
    const username = await generateUsername(factoryId, phoneNumber);

    // 6. 加密密码
    const passwordHash = await hashPassword(password);

    // 7. 加密安全问题答案
    const answer1Hash = await hashPassword(securityQuestions[0].answer);
    const answer2Hash = await hashPassword(securityQuestions[1].answer);
    const answer3Hash = await hashPassword(securityQuestions[2].answer);

    // 8. 创建用户（使用事务）
    const result = await prisma.$transaction(async (tx) => {
      // 创建用户
      const newUser = await tx.user.create({
        data: {
          factoryId,
          username,
          passwordHash,
          phone: phoneNumber,
          fullName,
          isActive: true,     // 白名单用户自动激活
          roleCode: 'viewer', // 默认角色
          lastLogin: new Date()
        },
        include: {
          factory: {
            select: {
              id: true,
              name: true,
              industry: true
            }
          }
        }
      });

      // 创建安全问题记录
      await tx.userSecurityQuestion.create({
        data: {
          userId: newUser.id,
          question1: securityQuestions[0].question,
          answer1Hash,
          question2: securityQuestions[1].question,
          answer2Hash,
          question3: securityQuestions[2].question,
          answer3Hash
        }
      });

      // 更新白名单状态
      await tx.userWhitelist.update({
        where: { id: whitelist.id },
        data: { status: 'REGISTERED' }
      });

      return newUser;
    });

    // 9. 生成Token（自动登录）
    const tokens = await generateAuthTokens(result, factoryId);

    // 10. 生成用户权限
    const permissions = generateUserPermissions(result);

    // 11. 返回完整用户信息（含Token）
    return {
      success: true,
      message: '注册成功',
      user: {
        id: result.id,
        username: result.username,
        phone: result.phone,
        fullName: result.fullName,
        factoryId: result.factoryId,
        factory: result.factory,
        roleCode: result.roleCode,
        isActive: result.isActive,
        userType: 'factory',
        permissions,
        createdAt: result.createdAt.toISOString()
      },
      tokens
    };
  } catch (error) {
    console.error('注册失败:', error);
    return { success: false, message: '注册失败，请稍后重试' };
  }
};
```

---

## 忘记密码/重置密码设计

### 5.1 设计思路

**不使用短信验证码，改用安全问题验证**:
- 用户通过"真实姓名+手机号"找回账号
- 回答注册时设置的3个安全问题
- 验证通过后才能重置密码
- 重置密码后撤销所有旧Token（强制重新登录）

**忘记密码 = 重置密码**:
- 只有一个入口"忘记密码"
- 合并为统一流程

### 5.2 重置密码流程图

```
┌──────────────────────────────────────────────┐
│  Step 1: 身份验证                            │
├──────────────────────────────────────────────┤
│  用户输入:                                   │
│  - 真实姓名                                  │
│  - 手机号                                    │
│      ↓                                       │
│  点击"下一步"                                │
│      ↓                                       │
│  后端查询users表:                            │
│  WHERE fullName = ? AND phone = ?            │
│      ├─ 未找到 → 提示"用户不存在或信息不匹配"│
│      └─ 找到用户 → 查询安全问题              │
│              ↓                               │
│          返回3个安全问题（不返回答案）        │
│              ↓                               │
│          生成临时resetToken（5分钟有效）     │
└──────────────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────────────┐
│  Step 2: 回答安全问题                        │
├──────────────────────────────────────────────┤
│  显示用户名（提醒用户）                      │
│  显示3个安全问题                             │
│      ↓                                       │
│  用户输入3个答案                             │
│      ↓                                       │
│  点击"验证答案"                              │
│      ↓                                       │
│  后端验证答案（bcrypt对比）                  │
│      ├─ 任一答案错误 → 提示"安全问题答案错误"│
│      └─ 全部正确 → 生成passwordResetToken    │
│                    （10分钟有效）            │
└──────────────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────────────┐
│  Step 3: 设置新密码                          │
├──────────────────────────────────────────────┤
│  用户输入:                                   │
│  - 新密码（强度验证）                        │
│  - 确认新密码                                │
│      ↓                                       │
│  点击"重置密码"                              │
│      ↓                                       │
│  后端处理:                                   │
│  1. 验证passwordResetToken                   │
│  2. 验证密码强度                             │
│  3. 更新用户密码（bcrypt加密）               │
│  4. 撤销所有已有Token（sessions表）          │
│  5. 标记tempToken为已使用                    │
│      ↓                                       │
│  提示"密码重置成功，请重新登录"              │
│      ↓                                       │
│  跳转到登录页                                │
└──────────────────────────────────────────────┘
```

### 5.3 前端页面设计

#### ForgotPasswordScreen.tsx - 忘记密码页

```typescript
export const ForgotPasswordScreen = ({ navigation }) => {
  const [step, setStep] = useState(1); // 1=身份验证, 2=安全问题, 3=设置新密码

  // Step 1 数据
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Step 2 数据
  const [username, setUsername] = useState(''); // 显示用户名
  const [securityQuestions, setSecurityQuestions] = useState([]);
  const [answer1, setAnswer1] = useState('');
  const [answer2, setAnswer2] = useState('');
  const [answer3, setAnswer3] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [verifyingAnswers, setVerifyingAnswers] = useState(false);

  // Step 3 数据
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordResetToken, setPasswordResetToken] = useState('');
  const [resetting, setResetting] = useState(false);

  // === Step 1: 验证身份 ===
  const handleVerifyIdentity = async () => {
    if (!fullName || !phoneNumber) {
      Alert.alert('提示', '请输入真实姓名和手机号');
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
      Alert.alert('提示', '手机号格式不正确');
      return;
    }

    setVerifying(true);

    try {
      const result = await authService.verifyIdentity({
        fullName,
        phoneNumber
      });

      if (result.success) {
        setUsername(result.username);
        setSecurityQuestions(result.securityQuestions);
        setResetToken(result.resetToken);
        setStep(2); // 进入安全问题验证
      } else {
        Alert.alert('提示', result.message || '用户不存在或信息不匹配');
      }
    } catch (error) {
      Alert.alert('错误', error.message || '验证失败');
    } finally {
      setVerifying(false);
    }
  };

  // === Step 2: 验证安全问题 ===
  const handleVerifyAnswers = async () => {
    if (!answer1 || !answer2 || !answer3) {
      Alert.alert('提示', '请回答所有安全问题');
      return;
    }

    setVerifyingAnswers(true);

    try {
      const result = await authService.verifySecurityAnswers({
        resetToken,
        answers: [answer1, answer2, answer3]
      });

      if (result.success) {
        setPasswordResetToken(result.passwordResetToken);
        setStep(3); // 进入设置新密码
      } else {
        Alert.alert('提示', result.message || '安全问题答案错误');
      }
    } catch (error) {
      Alert.alert('错误', error.message || '验证失败');
    } finally {
      setVerifyingAnswers(false);
    }
  };

  // === Step 3: 重置密码 ===
  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('提示', '请输入新密码');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('提示', '两次输入的密码不一致');
      return;
    }

    // 密码强度验证
    const strength = calculatePasswordStrength(newPassword);
    if (strength < 75) {
      Alert.alert('提示', '密码强度不足，请包含大小写字母和数字，至少8位');
      return;
    }

    setResetting(true);

    try {
      const result = await authService.resetPassword({
        passwordResetToken,
        newPassword,
        confirmPassword
      });

      if (result.success) {
        Alert.alert('成功', '密码重置成功，请使用新密码登录', [
          {
            text: '去登录',
            onPress: () => navigation.navigate('Login')
          }
        ]);
      }
    } catch (error) {
      Alert.alert('错误', error.message || '重置密码失败');
    } finally {
      setResetting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container}>
      <ScrollView>
        {/* 步骤指示器 */}
        <View style={styles.stepIndicator}>
          <StepDot active={step >= 1} completed={step > 1} label="1" />
          <StepLine completed={step > 1} />
          <StepDot active={step >= 2} completed={step > 2} label="2" />
          <StepLine completed={step > 2} />
          <StepDot active={step >= 3} completed={false} label="3" />
        </View>

        {/* Step 1: 身份验证 */}
        {step === 1 && (
          <View style={styles.section}>
            <Text style={styles.title}>找回密码</Text>
            <Text style={styles.subtitle}>请输入注册时的信息</Text>

            <TextInput
              style={styles.input}
              placeholder="真实姓名"
              value={fullName}
              onChangeText={setFullName}
            />

            <TextInput
              style={styles.input}
              placeholder="手机号"
              keyboardType="phone-pad"
              maxLength={11}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleVerifyIdentity}
              disabled={verifying}
            >
              {verifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>下一步</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: 回答安全问题 */}
        {step === 2 && (
          <View style={styles.section}>
            <Text style={styles.title}>回答安全问题</Text>
            <Text style={styles.subtitle}>
              用户名: {username}
            </Text>

            <View style={styles.questionBlock}>
              <Text style={styles.questionText}>
                问题1: {securityQuestions[0]}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="请输入答案"
                value={answer1}
                onChangeText={setAnswer1}
              />
            </View>

            <View style={styles.questionBlock}>
              <Text style={styles.questionText}>
                问题2: {securityQuestions[1]}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="请输入答案"
                value={answer2}
                onChangeText={setAnswer2}
              />
            </View>

            <View style={styles.questionBlock}>
              <Text style={styles.questionText}>
                问题3: {securityQuestions[2]}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="请输入答案"
                value={answer3}
                onChangeText={setAnswer3}
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleVerifyAnswers}
              disabled={verifyingAnswers}
            >
              {verifyingAnswers ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>验证答案</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep(1)}
            >
              <Text style={styles.backButtonText}>返回上一步</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: 设置新密码 */}
        {step === 3 && (
          <View style={styles.section}>
            <Text style={styles.title}>设置新密码</Text>

            <TextInput
              style={styles.input}
              placeholder="新密码（至少8位）"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />

            {/* 密码强度指示器 */}
            <PasswordStrengthIndicator password={newPassword} />

            <TextInput
              style={styles.input}
              placeholder="确认新密码"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleResetPassword}
              disabled={resetting}
            >
              {resetting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>重置密码</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
```

### 5.4 后端API设计

```javascript
// 1. 验证身份
POST /api/mobile/auth/verify-identity
{
  fullName: "张三",
  phoneNumber: "13800138000"
}

响应:
{
  success: true,
  userId: 123,
  username: "FAC001_8000_AB",  // 返回用户名，提醒用户
  securityQuestions: [
    "您母亲的姓名是什么？",
    "您出生的城市是哪里？",
    "您的工号是多少？"
  ],
  resetToken: "temp_reset_abc123"  // 5分钟有效
}

// 2. 验证安全问题答案
POST /api/mobile/auth/verify-security-answers
{
  resetToken: "temp_reset_abc123",
  answers: ["李梅", "北京", "001"]
}

响应:
{
  success: true,
  message: "验证通过，请设置新密码",
  passwordResetToken: "pwd_reset_xyz789"  // 10分钟有效
}

// 3. 重置密码
POST /api/mobile/auth/reset-password
{
  passwordResetToken: "pwd_reset_xyz789",
  newPassword: "NewPassword@123",
  confirmPassword: "NewPassword@123"
}

响应:
{
  success: true,
  message: "密码重置成功，请使用新密码登录"
}
```

#### Controller实现

```javascript
// backend/src/controllers/authController.js

/**
 * 验证身份（真实姓名+手机号）
 */
export const verifyIdentity = async (req, res, next) => {
  try {
    const { fullName, phoneNumber } = req.body;

    // 查找用户
    const user = await prisma.user.findFirst({
      where: {
        fullName,
        phone: phoneNumber,
        isActive: true  // 只能重置已激活用户的密码
      }
    });

    if (!user) {
      throw new NotFoundError('用户不存在或信息不匹配');
    }

    // 查询安全问题
    const securityQuestions = await prisma.userSecurityQuestion.findUnique({
      where: { userId: user.id },
      select: {
        question1: true,
        question2: true,
        question3: true
        // 注意：不返回答案的Hash
      }
    });

    if (!securityQuestions) {
      throw new BusinessLogicError('该账户未设置安全问题，请联系管理员重置密码');
    }

    // 生成临时重置token（5分钟有效）
    const resetToken = await generateTempToken(
      'PASSWORD_RESET',
      user.factoryId,
      phoneNumber,
      { userId: user.id },
      5 // 5分钟
    );

    res.json(createSuccessResponse({
      userId: user.id,
      username: user.username,
      securityQuestions: [
        securityQuestions.question1,
        securityQuestions.question2,
        securityQuestions.question3
      ],
      resetToken
    }, '身份验证成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 验证安全问题答案
 */
export const verifySecurityAnswers = async (req, res, next) => {
  try {
    const { resetToken, answers } = req.body;

    // 验证answers是数组且有3个元素
    if (!Array.isArray(answers) || answers.length !== 3) {
      throw new ValidationError('请回答所有安全问题');
    }

    // 验证resetToken
    const tokenData = await verifyAndUseTempToken(resetToken, 'PASSWORD_RESET');
    const userId = tokenData.data.userId;

    // 获取安全问题记录
    const securityQuestions = await prisma.userSecurityQuestion.findUnique({
      where: { userId }
    });

    if (!securityQuestions) {
      throw new NotFoundError('安全问题记录不存在');
    }

    // 验证3个答案（bcrypt对比）
    const isAnswer1Valid = await verifyPassword(answers[0], securityQuestions.answer1Hash);
    const isAnswer2Valid = await verifyPassword(answers[1], securityQuestions.answer2Hash);
    const isAnswer3Valid = await verifyPassword(answers[2], securityQuestions.answer3Hash);

    if (!isAnswer1Valid || !isAnswer2Valid || !isAnswer3Valid) {
      throw new AuthenticationError('安全问题答案错误');
    }

    // 生成密码重置token（10分钟有效）
    const passwordResetToken = await generateTempToken(
      'PASSWORD_RESET_VERIFIED',
      tokenData.factoryId,
      tokenData.phoneNumber,
      { userId },
      10 // 10分钟
    );

    res.json(createSuccessResponse({
      passwordResetToken
    }, '验证通过，请设置新密码'));
  } catch (error) {
    next(error);
  }
};

/**
 * 重置密码
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { passwordResetToken, newPassword, confirmPassword } = req.body;

    // 验证密码一致性
    if (newPassword !== confirmPassword) {
      throw new ValidationError('两次输入的密码不一致');
    }

    // 验证密码强度
    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors.join('；'));
    }

    // 验证resetToken
    const tokenData = await verifyAndUseTempToken(passwordResetToken, 'PASSWORD_RESET_VERIFIED');
    const userId = tokenData.data.userId;

    // 更新密码
    const newPasswordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });

    // 撤销该用户所有已有的token（强制重新登录）
    await revokeUserTokens(userId, tokenData.factoryId);

    res.json(createSuccessResponse(null, '密码重置成功，请使用新密码登录'));
  } catch (error) {
    next(error);
  }
};
```

---

## 数据库设计

### 6.1 新增数据表

#### user_security_questions - 用户安全问题表

```sql
CREATE TABLE user_security_questions (
  id VARCHAR(36) PRIMARY KEY,
  user_id INT NOT NULL,

  -- 安全问题1
  question_1 VARCHAR(500) NOT NULL,
  answer_1_hash VARCHAR(255) NOT NULL,  -- bcrypt加密

  -- 安全问题2
  question_2 VARCHAR(500) NOT NULL,
  answer_2_hash VARCHAR(255) NOT NULL,

  -- 安全问题3
  question_3 VARCHAR(500) NOT NULL,
  answer_3_hash VARCHAR(255) NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_questions (user_id),
  INDEX idx_user (user_id)
);
```

**字段说明**:
- `user_id`: 关联users表
- `question_1/2/3`: 安全问题文本
- `answer_1/2/3_hash`: 答案的bcrypt Hash（不存储明文）
- `created_at`: 创建时间
- `updated_at`: 更新时间（用户可以修改安全问题）

**Prisma Schema**:

```prisma
model UserSecurityQuestion {
  id        String   @id @default(uuid())
  userId    Int      @unique @map("user_id")

  question1    String @map("question_1") @db.VarChar(500)
  answer1Hash  String @map("answer_1_hash")

  question2    String @map("question_2") @db.VarChar(500)
  answer2Hash  String @map("answer_2_hash")

  question3    String @map("question_3") @db.VarChar(500)
  answer3Hash  String @map("answer_3_hash")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_security_questions")
}
```

### 6.2 修改现有表

#### users表修改

```sql
-- 邮箱改为可选（不强制要求）
ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL;
```

**Prisma Schema修改**:

```prisma
model User {
  // ...其他字段
  email        String?  // 改为可选

  // 新增关联
  securityQuestions UserSecurityQuestion?

  // ...
}
```

---

## API接口设计

### 7.1 认证相关API汇总

#### 登录相关（1个接口）

```javascript
POST /api/mobile/auth/unified-login
// 统一登录接口（平台用户+工厂用户智能识别）
```

#### 注册相关（3个接口）

```javascript
POST /api/mobile/auth/check-whitelist
// 检查手机号是否在白名单

POST /api/mobile/auth/preview-username
// 预览生成的用户名（辅助接口）

POST /api/mobile/auth/register
// 用户注册（单接口完成整个流程）
```

#### 忘记密码相关（3个接口）

```javascript
POST /api/mobile/auth/verify-identity
// 验证身份（真实姓名+手机号）

POST /api/mobile/auth/verify-security-answers
// 验证安全问题答案

POST /api/mobile/auth/reset-password
// 重置密码
```

#### 辅助接口（已有）

```javascript
POST /api/mobile/auth/refresh-token
// 刷新Token

POST /api/mobile/auth/logout
// 登出

GET  /api/mobile/auth/profile
// 获取当前用户信息
```

### 7.2 完整API文档

详见 [backend/API_DOCUMENTATION.md](../../backend/API_DOCUMENTATION.md)

---

## 前端页面设计

### 8.1 页面清单

#### 已有页面（1个）:
- ✅ `EnhancedLoginScreen.tsx` - 登录页面

#### 需要新建页面（2个）:
- 🆕 `RegisterScreen.tsx` - 注册页面
- 🆕 `ForgotPasswordScreen.tsx` - 忘记密码页面

#### 需要删除的页面:
- ❌ `RegisterPhaseOneScreen.tsx` - 删除（改为单页面注册）
- ❌ `RegisterPhaseTwoScreen.tsx` - 删除（改为单页面注册）
- ❌ `ActivationScreen.tsx` - 删除（如果存在）

### 8.2 组件库设计

#### 通用表单组件

```
frontend/CretasFoodTrace/src/components/auth/
├── FormField.tsx                    # 表单字段容器
├── PhoneInput.tsx                   # 手机号输入
├── PasswordInput.tsx                # 密码输入（带显示/隐藏）
├── PasswordStrengthIndicator.tsx    # 密码强度指示器
├── SecurityQuestionPicker.tsx       # 安全问题选择器
├── StepIndicator.tsx                # 步骤指示器
├── LoadingButton.tsx                # 加载按钮
└── ErrorMessage.tsx                 # 错误消息组件
```

**复用性设计**:
- 所有表单组件在登录、注册、重置密码页面中复用
- 统一的样式和交互逻辑
- 统一的验证规则

---

## 实施计划

### 9.1 时间规划（4周）

#### Week 1: 清理Mock代码 + 权限梳理

**Day 1-2**: 清理Mock代码
- [ ] 删除 `backend/src/routes/mobile.js` 第60-114行（Mock登录）
- [ ] 优化 `backend/src/controllers/activationController.js`（从数据库读取激活码）
- [ ] 删除 `frontend/src/services/biometricManager.ts`（生物识别相关）
- [ ] 删除 `frontend/src/hooks/useLogin.ts` 中的生物识别逻辑

**Day 3-5**: 权限梳理与文档
- [ ] 创建 `docs/prd/角色权限完整清单.md`
- [ ] 完善 `backend/src/config/permissions.js`
- [ ] 创建 `backend/src/services/permissionCache.js`（权限缓存）
- [ ] 测试所有角色的权限配置

**交付物**:
- 清理后的代码（无Mock残留）
- 角色权限完整清单文档

---

#### Week 2: 注册页面开发

**Day 1-2**: 后端API开发
- [ ] 创建 `backend/src/utils/usernameGenerator.js`
- [ ] 实现 `registerUser()` controller
- [ ] 实现白名单检查优化
- [ ] 添加用户名预览接口

**Day 3-4**: 前端页面开发
- [ ] 创建 `RegisterScreen.tsx`
- [ ] 创建表单组件（PhoneInput, PasswordInput等）
- [ ] 实现表单验证逻辑
- [ ] 实现安全问题选择

**Day 5**: 测试与优化
- [ ] 测试注册流程
- [ ] 优化UI/UX
- [ ] Bug修复

**交付物**:
- `RegisterScreen.tsx`（完整注册页面）
- 表单组件库
- 注册API

---

#### Week 3: 忘记密码功能

**Day 1-2**: 后端API开发
- [ ] 实现 `verifyIdentity()` controller
- [ ] 实现 `verifySecurityAnswers()` controller
- [ ] 实现 `resetPassword()` controller
- [ ] 添加临时token管理（PASSWORD_RESET类型）

**Day 3**: 数据库迁移
- [ ] 添加 `UserSecurityQuestion` 模型到schema.prisma
- [ ] 运行数据库迁移
- [ ] 为现有用户生成默认安全问题（数据迁移脚本）

**Day 4**: 前端页面开发
- [ ] 创建 `ForgotPasswordScreen.tsx`
- [ ] 实现3步流程（身份验证 → 安全问题 → 新密码）
- [ ] 创建StepIndicator组件

**Day 5**: 测试与优化
- [ ] 测试完整流程
- [ ] 测试错误场景
- [ ] Bug修复

**交付物**:
- `ForgotPasswordScreen.tsx`
- 忘记密码API（3个接口）
- 数据库迁移脚本

---

#### Week 4: 用户体验优化

**Day 1-2**: 登录体验优化
- [ ] 优化错误提示（10种错误场景）
- [ ] 添加加载动画
- [ ] 优化自动登录逻辑
- [ ] 添加"记住密码"功能（本地存储用户名）

**Day 3**: 注册体验优化
- [ ] 实时表单验证
- [ ] 密码强度可视化
- [ ] 安全问题不重复校验
- [ ] 优化用户引导

**Day 4**: 忘记密码体验优化
- [ ] 步骤指示器优化
- [ ] 支持返回上一步
- [ ] 友好的错误提示

**Day 5**: 整体测试
- [ ] 端到端测试（登录、注册、重置密码）
- [ ] 权限测试（7个角色）
- [ ] 性能测试
- [ ] Bug修复

**交付物**:
- 优化后的所有认证页面
- 完整测试报告

---

### 9.2 人力需求

| 角色 | 工作量 | 说明 |
|-----|-------|------|
| 后端开发 | 2人周 | API开发、数据库迁移 |
| 前端开发 | 4人周 | 页面开发、组件开发 |
| UI设计 | 0.6人周 | 注册页面、忘记密码页面设计 |
| 测试 | 1人周 | 功能测试、回归测试 |

**总计**: 7.6人周

---

## 验收标准

### 10.1 功能完整性

#### 必须完成的功能:
- [ ] 统一登录可用（平台+工厂用户）
- [ ] 7个角色权限清晰定义
- [ ] 注册流程完整（白名单检查 → 填写信息 → 自动登录）
- [ ] 忘记密码流程完整（身份验证 → 安全问题 → 重置密码）
- [ ] 所有Mock代码已删除
- [ ] 自动用户名生成可用
- [ ] 安全问题验证可用

#### 必须删除的代码:
- [ ] Mock登录接口已删除
- [ ] 生物识别代码已删除
- [ ] 短信验证码代码已删除
- [ ] 两阶段注册旧代码已删除

---

### 10.2 用户体验

#### 登录体验:
- [ ] 登录成功率>99%
- [ ] 错误提示友好（10种场景）
- [ ] 加载状态明显
- [ ] 自动登录流畅
- [ ] 响应时间<2秒

#### 注册体验:
- [ ] 注册流程清晰（3步可视化）
- [ ] 表单验证实时提示
- [ ] 密码强度可视化
- [ ] 用户名生成预览
- [ ] 完成时间<3分钟

#### 重置密码体验:
- [ ] 步骤指示器清晰（1/3, 2/3, 3/3）
- [ ] 可返回上一步
- [ ] 错误提示友好
- [ ] 安全问题答案提示（不区分大小写）

---

### 10.3 安全性

#### 密码安全:
- [ ] 密码强度验证（至少8位，大小写字母+数字）
- [ ] 密码bcrypt加密（12轮）
- [ ] 重置密码后撤销所有旧Token

#### 安全问题:
- [ ] 答案bcrypt加密存储
- [ ] 3个问题不能重复
- [ ] 答案不能为空（至少2个字符）

#### Token安全:
- [ ] accessToken有效期24小时
- [ ] refreshToken有效期7天
- [ ] 临时token有效期5-10分钟
- [ ] Token存储在SecureStore

#### 防暴力破解:
- [ ] 登录失败5次锁定30分钟（待实现）
- [ ] 安全问题答案错误3次锁定（待实现）
- [ ] 临时token过期自动失效

---

### 10.4 性能指标

| 指标 | 目标值 | 说明 |
|-----|-------|------|
| 登录响应时间 | <2秒 | 从点击登录到返回结果 |
| 注册响应时间 | <3秒 | 从提交注册到自动登录 |
| 白名单检查 | <1秒 | 检查手机号是否在白名单 |
| 权限检查 | <100ms | 使用缓存后的权限验证 |
| Token刷新 | <1秒 | refreshToken换取新accessToken |

---

### 10.5 代码质量

#### 代码规范:
- [ ] TypeScript类型完整（前端）
- [ ] 函数注释完整（后端）
- [ ] 错误处理完善
- [ ] 无console.log残留

#### 测试覆盖:
- [ ] 单元测试>80%覆盖率
- [ ] 集成测试覆盖主要流程
- [ ] 端到端测试覆盖完整业务流程

---

## 附录

### A. 预设安全问题库

```javascript
// frontend/src/constants/securityQuestions.ts
export const SECURITY_QUESTIONS = [
  { id: 1, question: '您母亲的姓名是什么？', category: 'family' },
  { id: 2, question: '您出生的城市是哪里？', category: 'personal' },
  { id: 3, question: '您小学班主任的姓名是什么？', category: 'education' },
  { id: 4, question: '您最喜欢的食物是什么？', category: 'preference' },
  { id: 5, question: '您的第一个宠物叫什么名字？', category: 'personal' },
  { id: 6, question: '您配偶的生日是几月几号？', category: 'family' },
  { id: 7, question: '您的工号是多少？', category: 'work' },
  { id: 8, question: '您入职的年份是哪一年？', category: 'work' },
  { id: 9, question: '您最喜欢的颜色是什么？', category: 'preference' },
  { id: 10, question: '您的身份证后6位是什么？', category: 'personal' }
];
```

### B. 错误码定义

```javascript
// backend/src/constants/errorCodes.js
export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    message: '用户名或密码错误',
    httpStatus: 401
  },
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    message: '用户不存在',
    httpStatus: 404
  },
  WRONG_PASSWORD: {
    code: 'WRONG_PASSWORD',
    message: '密码错误',
    httpStatus: 401
  },
  ACCOUNT_NOT_ACTIVATED: {
    code: 'ACCOUNT_NOT_ACTIVATED',
    message: '账号未激活，请联系管理员',
    httpStatus: 403
  },
  FACTORY_DISABLED: {
    code: 'FACTORY_DISABLED',
    message: '所属工厂已停用',
    httpStatus: 403
  },
  WHITELIST_NOT_FOUND: {
    code: 'WHITELIST_NOT_FOUND',
    message: '手机号未在白名单中',
    httpStatus: 403
  },
  PHONE_ALREADY_REGISTERED: {
    code: 'PHONE_ALREADY_REGISTERED',
    message: '该手机号已被注册',
    httpStatus: 409
  },
  SECURITY_ANSWER_WRONG: {
    code: 'SECURITY_ANSWER_WRONG',
    message: '安全问题答案错误',
    httpStatus: 401
  },
  PASSWORD_STRENGTH_LOW: {
    code: 'PASSWORD_STRENGTH_LOW',
    message: '密码强度不足',
    httpStatus: 400
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    message: 'Token已过期',
    httpStatus: 401
  }
};
```

### C. 数据迁移脚本

```javascript
// backend/scripts/migrate-security-questions.js
// 为现有用户生成默认安全问题

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';

const prisma = new PrismaClient();

async function migrateSecurityQuestions() {
  // 查找没有安全问题的用户
  const usersWithoutQuestions = await prisma.user.findMany({
    where: {
      securityQuestions: null
    }
  });

  console.log(`找到${usersWithoutQuestions.length}个用户需要设置默认安全问题`);

  for (const user of usersWithoutQuestions) {
    // 生成默认安全问题（使用用户信息）
    const defaultAnswer = `${user.fullName}_${user.id}`;
    const answerHash = await hashPassword(defaultAnswer);

    await prisma.userSecurityQuestion.create({
      data: {
        userId: user.id,
        question1: '您母亲的姓名是什么？',
        answer1Hash: answerHash,
        question2: '您出生的城市是哪里？',
        answer2Hash: answerHash,
        question3: '您的工号是多少？',
        answer3Hash: answerHash
      }
    });

    console.log(`已为用户 ${user.username} 设置默认安全问题`);
  }

  console.log('迁移完成');
}

migrateSecurityQuestions().catch(console.error).finally(() => prisma.$disconnect());
```

---

**文档结束**

*此文档为白垩纪食品溯源系统认证模块的完整规划，包含所有细节和实施步骤*
