# 海牛食品溯源系统 - React Native移动端后端支持更新需求

> 创建时间: 2025-08-06
> 负责人: [待分配]
> 优先级: 高
> 状态: 待实现

## 📋 概述

为支持React Native移动端应用的完整功能，需要在现有后端基础上添加移动端专用的数据表、API接口和业务逻辑。本文档详细说明所有需要的后端更新。

## 🗄️ 数据表更新需求

### 1. 移动端设备管理表

**表名**: `mobile_devices`

```sql
CREATE TABLE mobile_devices (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(255),
  device_model VARCHAR(255),
  os_version VARCHAR(100),
  app_version VARCHAR(50),
  platform ENUM('ios', 'android') NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_device (user_id, device_id),
  INDEX idx_device_active (device_id, is_active)
);
```

**用途**: 管理用户设备绑定，支持设备登录和多设备管理

### 2. 移动端Token刷新记录表

**表名**: `mobile_token_refresh_logs`

```sql
CREATE TABLE mobile_token_refresh_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(255) NOT NULL,
  old_token_id VARCHAR(36),
  new_token_id VARCHAR(36),
  refresh_reason ENUM('expiry', 'manual', 'security') DEFAULT 'expiry',
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_refresh (user_id, created_at),
  INDEX idx_device_refresh (device_id, created_at)
);
```

**用途**: 记录Token刷新历史，用于安全审计和异常检测

### 3. 权限检查缓存表

**表名**: `mobile_permission_cache`

```sql
CREATE TABLE mobile_permission_cache (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  permission_key VARCHAR(500) NOT NULL,
  permission_result JSON NOT NULL,
  cache_ttl INT DEFAULT 300, -- 5分钟默认TTL
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_permission (user_id, permission_key),
  INDEX idx_expires (expires_at),
  INDEX idx_user_cache (user_id, created_at)
);
```

**用途**: 缓存复杂权限检查结果，提升移动端权限验证性能

### 4. 移动端会话管理表

**表名**: `mobile_sessions`

```sql
CREATE TABLE mobile_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(255) NOT NULL,
  session_token VARCHAR(500) UNIQUE NOT NULL,
  refresh_token VARCHAR(500) UNIQUE NOT NULL,
  biometric_enabled BOOLEAN DEFAULT false,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(45),
  location_info JSON,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_session (user_id, is_active),
  INDEX idx_device_session (device_id, is_active),
  INDEX idx_session_expires (expires_at, is_active)
);
```

**用途**: 管理移动端用户会话，支持多设备同时登录和会话控制

## 🔌 API接口需求

### 1. Token管理接口

#### POST /api/mobile/auth/refresh-token
**功能**: Token自动刷新
**请求体**:
```json
{
  "refreshToken": "string",
  "deviceId": "string"
}
```
**响应**:
```json
{
  "success": boolean,
  "message": "string",
  "tokens": {
    "accessToken": "string",
    "refreshToken": "string",
    "expiresIn": number
  }
}
```

#### POST /api/mobile/auth/biometric-login
**功能**: 生物识别登录
**请求体**:
```json
{
  "deviceId": "string",
  "biometricData": "string", // 加密的生物识别标识
  "deviceInfo": {
    "deviceModel": "string",
    "osVersion": "string",
    "appVersion": "string",
    "platform": "ios|android"
  }
}
```
**响应**: 标准登录响应格式

### 2. 用户信息验证接口

#### GET /api/mobile/auth/profile
**功能**: 验证Token并返回用户信息
**Headers**: Authorization: Bearer {token}
**响应**:
```json
{
  "success": boolean,
  "user": {
    "id": "string",
    "username": "string",
    "userType": "platform|factory",
    "role": "string",
    "permissions": ["string"],
    "profile": {}
  }
}
```

#### POST /api/mobile/auth/logout
**功能**: 移动端登出
**请求体**:
```json
{
  "deviceId": "string",
  "logoutAllDevices": boolean
}
```

### 3. 设备管理接口

#### POST /api/mobile/auth/device-bind
**功能**: 设备绑定管理
**请求体**:
```json
{
  "deviceId": "string",
  "deviceName": "string",
  "deviceInfo": {
    "deviceModel": "string",
    "osVersion": "string",
    "platform": "ios|android"
  },
  "enableBiometric": boolean
}
```

#### GET /api/mobile/auth/devices
**功能**: 获取用户绑定设备列表
**响应**:
```json
{
  "success": boolean,
  "devices": [
    {
      "id": "string",
      "deviceName": "string",
      "deviceModel": "string",
      "platform": "string",
      "isActive": boolean,
      "lastLoginAt": "string"
    }
  ]
}
```

### 4. 权限检查接口

#### POST /api/mobile/permissions/check
**功能**: 复杂权限检查
**请求体**:
```json
{
  "permissions": ["string"],
  "roles": ["string"],
  "modules": ["string"],
  "department": "string",
  "minimumLevel": number,
  "dataAccess": {
    "level": "all|factory|department|own",
    "owner": "string",
    "department": "string"
  },
  "options": {
    "requireAll": boolean,
    "checkLevel": boolean,
    "checkDepartment": boolean,
    "useCache": boolean
  }
}
```
**响应**:
```json
{
  "success": boolean,
  "hasAccess": boolean,
  "reason": "string",
  "details": {
    "checks": [
      {
        "name": "string",
        "passed": boolean,
        "reason": "string"
      }
    ],
    "cached": boolean
  }
}
```

## ⚙️ 业务逻辑更新需求

### 1. 角色权限映射逻辑统一

**文件**: `src/config/permissions.js`
**需要更新**: 确保前后端角色定义完全一致

```javascript
// 统一的角色定义
const UNIFIED_USER_ROLES = {
  // 平台用户角色 (userType: 'platform')
  DEVELOPER: 'system_developer',           // 级别: -1
  PLATFORM_ADMIN: 'platform_super_admin',  // 级别: 0
  PLATFORM_OPERATOR: 'platform_operator',  // 级别: 1
  
  // 工厂用户角色 (userType: 'factory') 
  FACTORY_SUPER_ADMIN: 'factory_super_admin',  // 级别: 0
  PERMISSION_ADMIN: 'permission_admin',         // 级别: 5
  DEPARTMENT_ADMIN: 'department_admin',         // 级别: 10
  OPERATOR: 'operator',                         // 级别: 30
  VIEWER: 'viewer'                             // 级别: 50
};

// 权限级别定义 (数字越小权限越高)
const ROLE_LEVELS = {
  'system_developer': -1,
  'platform_super_admin': 0,
  'factory_super_admin': 0,
  'platform_operator': 1,
  'permission_admin': 5,
  'department_admin': 10,
  'operator': 30,
  'viewer': 50
};
```

### 2. 部门权限控制逻辑

**文件**: `src/middleware/departmentAuth.js`
**功能**: 实现部门级别的权限验证

```javascript
/**
 * 检查用户是否有访问指定部门的权限
 */
function checkDepartmentAccess(user, targetDepartment) {
  // 平台用户有所有部门权限
  if (user.userType === 'platform') {
    return true;
  }
  
  // 工厂用户权限检查
  if (user.userType === 'factory') {
    const factoryUser = user.factoryUser;
    
    // 检查用户所属部门
    if (factoryUser.department === targetDepartment) {
      return true;
    }
    
    // 检查用户管理的部门列表
    if (factoryUser.managedDepartments && 
        factoryUser.managedDepartments.includes(targetDepartment)) {
      return true;
    }
    
    // 工厂超级管理员有所有部门权限
    if (factoryUser.role === 'factory_super_admin') {
      return true;
    }
  }
  
  return false;
}
```

### 3. 数据访问控制逻辑

**文件**: `src/middleware/dataAccessControl.js`
**功能**: 实现4级数据访问权限控制

```javascript
/**
 * 数据访问级别定义
 */
const DATA_ACCESS_LEVELS = {
  ALL: 'all',           // 全部数据 (系统开发者、平台管理员)
  FACTORY: 'factory',   // 工厂数据 (工厂用户)
  DEPARTMENT: 'department', // 部门数据 (部门内用户)
  OWN: 'own'           // 个人数据 (仅自己)
};

/**
 * 检查数据访问权限
 */
function checkDataAccess(user, dataLevel, dataContext = {}) {
  switch (dataLevel) {
    case DATA_ACCESS_LEVELS.ALL:
      return user.userType === 'platform' || 
             user.role === 'system_developer';
    
    case DATA_ACCESS_LEVELS.FACTORY:
      return user.userType === 'platform' || 
             (user.userType === 'factory' && user.factoryUser?.factoryId);
    
    case DATA_ACCESS_LEVELS.DEPARTMENT:
      if (user.userType === 'platform') return true;
      return checkDepartmentAccess(user, dataContext.department);
    
    case DATA_ACCESS_LEVELS.OWN:
      return user.id === dataContext.owner;
    
    default:
      return true;
  }
}
```

### 4. 移动端会话管理逻辑

**文件**: `src/services/mobileSessionManager.js`
**功能**: 设备绑定和会话控制

```javascript
/**
 * 移动端会话管理器
 */
class MobileSessionManager {
  /**
   * 创建移动端会话
   */
  static async createSession(user, deviceInfo) {
    // 检查设备是否已绑定
    const existingDevice = await MobileDevice.findOne({
      user_id: user.id,
      device_id: deviceInfo.deviceId
    });
    
    if (!existingDevice) {
      // 创建新设备绑定
      await MobileDevice.create({
        id: generateUUID(),
        user_id: user.id,
        device_id: deviceInfo.deviceId,
        device_name: deviceInfo.deviceName,
        device_model: deviceInfo.deviceModel,
        os_version: deviceInfo.osVersion,
        platform: deviceInfo.platform
      });
    }
    
    // 创建会话
    const session = await MobileSession.create({
      id: generateUUID(),
      user_id: user.id,
      device_id: deviceInfo.deviceId,
      session_token: generateJWT(user, '1h'),
      refresh_token: generateRefreshToken(),
      expires_at: new Date(Date.now() + 3600000) // 1小时
    });
    
    return session;
  }
  
  /**
   * 刷新Token
   */
  static async refreshToken(refreshToken, deviceId) {
    const session = await MobileSession.findOne({
      refresh_token: refreshToken,
      device_id: deviceId,
      is_active: true
    });
    
    if (!session || session.expires_at < new Date()) {
      throw new Error('Invalid or expired refresh token');
    }
    
    // 生成新的Token
    const user = await User.findById(session.user_id);
    const newAccessToken = generateJWT(user, '1h');
    const newRefreshToken = generateRefreshToken();
    
    // 更新会话
    await session.update({
      session_token: newAccessToken,
      refresh_token: newRefreshToken,
      last_activity_at: new Date()
    });
    
    // 记录刷新日志
    await MobileTokenRefreshLog.create({
      id: generateUUID(),
      user_id: user.id,
      device_id: deviceId,
      success: true,
      refresh_reason: 'expiry'
    });
    
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 3600
    };
  }
}
```

## 🔄 现有API接口增强

### 1. 统一登录接口增强

**文件**: `src/controllers/authController.js`
**接口**: `POST /api/mobile/auth/unified-login`

**需要添加的功能**:
- 设备信息记录和绑定
- 生物识别支持标识
- 移动端会话创建
- Token过期时间优化(移动端更长)

### 2. 用户信息接口增强

**现有接口**: `GET /api/auth/profile`
**需要增强**: 添加移动端特有信息

```javascript
// 响应中添加移动端信息
{
  "user": {
    // ... 现有字段
    "mobileSettings": {
      "biometricEnabled": boolean,
      "deviceCount": number,
      "lastMobileLogin": "timestamp"
    },
    "permissions": {
      // ... 现有权限
      "dataAccessLevel": "all|factory|department|own",
      "departments": ["string"], // 可访问的部门列表
      "permissionLevel": number  // 数字化权限级别
    }
  }
}
```

## 📊 数据库迁移脚本

**文件**: `migrations/add_mobile_support.sql`

```sql
-- 1. 创建移动端设备管理表
-- (见上方数据表定义)

-- 2. 为现有用户表添加移动端相关字段
ALTER TABLE users ADD COLUMN mobile_login_enabled BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN biometric_login_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN max_mobile_devices INT DEFAULT 3;

-- 3. 为平台用户表添加权限级别字段
ALTER TABLE platform_users ADD COLUMN permission_level INT DEFAULT 1;

-- 4. 为工厂用户表添加部门权限字段
ALTER TABLE factory_users ADD COLUMN managed_departments JSON;
ALTER TABLE factory_users ADD COLUMN permission_level INT DEFAULT 30;

-- 5. 创建权限级别映射视图
CREATE VIEW user_permission_levels AS
SELECT 
  u.id as user_id,
  u.username,
  u.user_type,
  CASE 
    WHEN u.user_type = 'platform' THEN pu.permission_level
    WHEN u.user_type = 'factory' THEN fu.permission_level
    ELSE 50
  END as permission_level,
  CASE 
    WHEN u.user_type = 'platform' THEN pu.role
    WHEN u.user_type = 'factory' THEN fu.role
    ELSE 'viewer'
  END as role
FROM users u
LEFT JOIN platform_users pu ON u.id = pu.user_id
LEFT JOIN factory_users fu ON u.id = fu.user_id;
```

## 🔧 配置更新需求

### 1. 环境变量
```bash
# 移动端Token配置
MOBILE_ACCESS_TOKEN_EXPIRY=3600    # 1小时
MOBILE_REFRESH_TOKEN_EXPIRY=604800 # 7天
MOBILE_MAX_DEVICES_PER_USER=3      # 每用户最大设备数

# 权限缓存配置
PERMISSION_CACHE_TTL=300           # 5分钟
PERMISSION_CACHE_MAX_ENTRIES=10000

# 生物识别配置
BIOMETRIC_TOKEN_EXPIRY=86400       # 24小时
BIOMETRIC_ENCRYPTION_KEY="your-key"
```

### 2. 中间件注册
**文件**: `src/index.js`
```javascript
// 添加移动端权限中间件
app.use('/api/mobile', mobileAuthMiddleware);
app.use('/api/mobile', departmentAuthMiddleware);
app.use('/api/mobile', dataAccessControlMiddleware);
```

## 📅 实现优先级

### 🔴 高优先级 (立即实现)
1. Token刷新接口 - `/api/mobile/auth/refresh-token`
2. 用户信息验证接口 - `/api/mobile/auth/profile`
3. 移动端会话管理表和逻辑
4. 角色权限映射统一

### 🟡 中优先级 (本周内)
1. 生物识别登录接口
2. 设备管理接口
3. 部门权限控制逻辑
4. 数据访问控制逻辑

### 🟢 低优先级 (后续优化)
1. 权限缓存系统
2. 复杂权限检查接口
3. 移动端设备管理界面
4. 权限审计日志

## 📝 测试需求

每个新增接口和功能需要包含:
1. 单元测试 - 业务逻辑测试
2. 集成测试 - API接口测试
3. 权限测试 - 各种角色权限验证
4. 异常测试 - 错误场景处理
5. 性能测试 - 响应时间和并发测试

## 📞 联系方式

如有技术问题或需求变更，请联系前端开发团队进行对接。

---

# Week 2 权限管理增强需求 (新增)

> 添加时间: 2025-08-07
> Week 2功能: 权限UI组件、导航系统、API客户端增强

## 🔐 权限管理API增强

### 1. 批量权限检查接口

**接口**: `POST /api/mobile/permissions/batch-check`
**功能**: 支持一次检查多个权限，减少网络请求
**请求体**:
```json
{
  "checks": [
    {
      "type": "permission",
      "values": ["user.manage", "processing.view"],
      "operator": "AND"
    },
    {
      "type": "role", 
      "values": ["factory_super_admin", "department_admin"],
      "operator": "OR"
    },
    {
      "type": "level",
      "minimum": 10
    }
  ],
  "context": {
    "factoryId": "string",
    "departmentId": "string"
  }
}
```

### 2. 权限配置查询接口

**接口**: `GET /api/mobile/permissions/config`
**功能**: 获取角色权限配置和权限组信息
**响应**:
```json
{
  "success": true,
  "data": {
    "roleConfigs": {
      "system_developer": {
        "level": -1,
        "permissions": ["*"],
        "dataAccess": "all",
        "description": "系统开发者"
      }
    },
    "permissionGroups": {
      "user_management": {
        "displayName": "用户管理",
        "permissions": ["user.create", "user.edit", "user.delete"],
        "riskLevel": "high"
      }
    },
    "departmentHierarchy": [
      {
        "id": "dept_001",
        "name": "加工部",
        "parentId": null,
        "level": 1
      }
    ]
  }
}
```

### 3. 用户角色变更审计接口

**接口**: `POST /api/mobile/permissions/role-change-audit`
**功能**: 记录用户角色和权限变更历史
**请求体**:
```json
{
  "targetUserId": "string",
  "changes": [
    {
      "type": "role_change",
      "oldValue": "operator",
      "newValue": "department_admin",
      "reason": "岗位晋升"
    }
  ],
  "approvedBy": "string"
}
```

## 📊 权限统计分析表

### 1. 权限使用统计表
**表名**: `permission_usage_stats`
```sql
CREATE TABLE permission_usage_stats (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  permission_name VARCHAR(200) NOT NULL,
  access_count INT DEFAULT 0,
  last_accessed_at TIMESTAMP,
  date_bucket DATE NOT NULL, -- 按天统计
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_permission_date (user_id, permission_name, date_bucket),
  INDEX idx_permission_stats (permission_name, date_bucket),
  INDEX idx_user_stats (user_id, date_bucket)
);
```

### 2. 角色权限变更历史表
**表名**: `role_permission_audit_logs`
```sql
CREATE TABLE role_permission_audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  target_user_id VARCHAR(36) NOT NULL,
  operator_user_id VARCHAR(36) NOT NULL,
  change_type ENUM('role_change', 'permission_grant', 'permission_revoke') NOT NULL,
  old_value JSON,
  new_value JSON,
  change_reason VARCHAR(500),
  approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved',
  approved_by VARCHAR(36),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (operator_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_target_audit (target_user_id, created_at),
  INDEX idx_operator_audit (operator_user_id, created_at)
);
```

## 🏗️ 导航权限控制逻辑

### 1. 路由权限映射表
**表名**: `route_permissions`
```sql
CREATE TABLE route_permissions (
  id VARCHAR(36) PRIMARY KEY,
  route_name VARCHAR(100) NOT NULL UNIQUE,
  required_roles JSON, -- ["factory_super_admin", "department_admin"]
  required_permissions JSON, -- ["processing.view", "user.manage"]
  required_level INT, -- 最低权限级别
  department_restricted BOOLEAN DEFAULT false,
  platform_only BOOLEAN DEFAULT false,
  factory_only BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_route_active (route_name, is_active)
);
```

### 2. 用户导航偏好表
**表名**: `user_navigation_preferences`
```sql
CREATE TABLE user_navigation_preferences (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  favorite_routes JSON, -- 收藏的路由
  recent_routes JSON, -- 最近访问路由
  menu_collapsed_sections JSON, -- 折叠的菜单分组
  default_landing_page VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_nav_pref (user_id)
);
```

## 🔄 API客户端支持增强

### 1. API请求重试记录表
**表名**: `api_retry_logs`
```sql
CREATE TABLE api_retry_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  device_id VARCHAR(255),
  request_id VARCHAR(100) NOT NULL,
  api_endpoint VARCHAR(300) NOT NULL,
  http_method VARCHAR(10) NOT NULL,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  last_error_code VARCHAR(50),
  last_error_message TEXT,
  retry_strategy VARCHAR(50), -- 'exponential_backoff', 'fixed_delay'
  total_delay_ms INT DEFAULT 0,
  final_status ENUM('success', 'failed', 'abandoned') DEFAULT 'abandoned',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  
  INDEX idx_user_retry (user_id, created_at),
  INDEX idx_endpoint_retry (api_endpoint, created_at),
  INDEX idx_request_tracking (request_id)
);
```

### 2. 离线请求队列表
**表名**: `offline_request_queue`
```sql
CREATE TABLE offline_request_queue (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(255) NOT NULL,
  request_data JSON NOT NULL,
  priority ENUM('high', 'medium', 'low') DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scheduled_at TIMESTAMP, -- 计划执行时间
  executed_at TIMESTAMP,
  status ENUM('pending', 'executing', 'completed', 'failed') DEFAULT 'pending',
  execution_result JSON,
  retry_count INT DEFAULT 0,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_queue (user_id, status, priority),
  INDEX idx_device_queue (device_id, status),
  INDEX idx_schedule (scheduled_at, status)
);
```

## ⚡ 性能优化相关

### 1. 权限检查缓存增强

**功能**: 支持复杂权限检查结果缓存
**表结构更新**:
```sql
-- 扩展现有权限缓存表
ALTER TABLE mobile_permission_cache 
ADD COLUMN cache_key_hash VARCHAR(64),
ADD COLUMN dependency_roles JSON, -- 依赖的角色列表
ADD COLUMN dependency_departments JSON, -- 依赖的部门列表
ADD INDEX idx_cache_hash (cache_key_hash),
ADD INDEX idx_dependency_roles (dependency_roles(100));
```

### 2. API响应时间监控

**接口**: `POST /api/mobile/monitoring/api-performance`
**功能**: 收集移动端API调用性能数据
**请求体**:
```json
{
  "endpoint": "/api/mobile/permissions/check",
  "method": "POST",
  "responseTime": 156, // 毫秒
  "statusCode": 200,
  "deviceInfo": {
    "platform": "android",
    "model": "SM-G991B",
    "networkType": "4G"
  },
  "timestamp": "2025-08-07T10:30:00Z"
}
```

## 📱 移动端特定业务逻辑

### 1. 智能权限降级

**文件**: `src/services/intelligentPermissionManager.js`
**功能**: 网络不佳时的权限检查降级策略

```javascript
class IntelligentPermissionManager {
  /**
   * 智能权限检查 - 支持降级策略
   */
  static async checkPermissionWithFallback(userId, permissionCheck, networkQuality) {
    // 网络质量好 - 使用实时权限检查
    if (networkQuality === 'good') {
      return await this.realTimePermissionCheck(userId, permissionCheck);
    }
    
    // 网络质量一般 - 使用缓存 + 简化检查
    if (networkQuality === 'fair') {
      const cachedResult = await this.getCachedPermission(userId, permissionCheck);
      if (cachedResult && !this.isCacheExpired(cachedResult)) {
        return cachedResult;
      }
      return await this.simplifiedPermissionCheck(userId, permissionCheck);
    }
    
    // 网络质量差 - 仅使用本地缓存
    if (networkQuality === 'poor') {
      return await this.offlinePermissionCheck(userId, permissionCheck);
    }
  }
  
  /**
   * 权限预加载
   */
  static async preloadUserPermissions(userId) {
    const user = await User.findById(userId);
    const commonPermissions = this.getCommonPermissionsForRole(user.role);
    
    // 批量预加载常用权限
    const results = await this.batchCheckPermissions(userId, commonPermissions);
    
    // 缓存结果
    await this.cachePermissionResults(userId, results);
    
    return results;
  }
}
```

### 2. 部门权限继承逻辑

**文件**: `src/services/departmentPermissionService.js`
**功能**: 实现部门层级权限继承

```javascript
class DepartmentPermissionService {
  /**
   * 获取用户有效权限（包含继承）
   */
  static async getUserEffectivePermissions(userId) {
    const user = await User.findById(userId).include(['factoryUser']);
    
    if (user.userType === 'platform') {
      return await this.getPlatformUserPermissions(user);
    }
    
    // 获取用户直接权限
    const directPermissions = user.factoryUser.permissions || [];
    
    // 获取部门继承权限
    const departmentPermissions = await this.getDepartmentInheritedPermissions(
      user.factoryUser.departmentId
    );
    
    // 获取角色权限
    const rolePermissions = await this.getRolePermissions(user.factoryUser.role);
    
    // 合并所有权限
    const allPermissions = [
      ...directPermissions,
      ...departmentPermissions,
      ...rolePermissions
    ];
    
    // 去重并返回
    return [...new Set(allPermissions)];
  }
  
  /**
   * 获取部门继承权限
   */
  static async getDepartmentInheritedPermissions(departmentId) {
    const department = await Department.findById(departmentId);
    if (!department) return [];
    
    let inheritedPermissions = department.permissions || [];
    
    // 向上遍历父部门
    if (department.parentId) {
      const parentPermissions = await this.getDepartmentInheritedPermissions(
        department.parentId
      );
      inheritedPermissions = [...inheritedPermissions, ...parentPermissions];
    }
    
    return inheritedPermissions;
  }
}
```

## 🔄 现有接口修改需求

### 1. 登录接口增强 - 支持权限预加载

**接口**: `POST /api/mobile/auth/unified-login`
**新增响应字段**:
```json
{
  "success": true,
  "user": {
    // ... 现有字段
    "preloadedPermissions": {
      "common": ["processing.view", "data.input"], // 常用权限
      "navigation": ["Home", "Processing"], // 可访问路由
      "features": ["scanner", "offline_mode"] // 可用功能
    }
  },
  "clientConfig": {
    "permissionCacheTTL": 300,
    "offlineMode": {
      "enabled": true,
      "maxQueueSize": 100
    },
    "retryConfig": {
      "maxRetries": 3,
      "baseDelay": 1000
    }
  }
}
```

### 2. 用户信息接口增强 - 添加权限统计

**接口**: `GET /api/mobile/auth/profile`
**新增响应字段**:
```json
{
  "user": {
    // ... 现有字段
    "permissionStats": {
      "totalPermissions": 25,
      "activePermissions": 18,
      "lastPermissionUpdate": "2025-08-07T10:00:00Z",
      "mostUsedPermissions": [
        {"name": "processing.view", "count": 156},
        {"name": "data.input", "count": 89}
      ]
    },
    "navigationStats": {
      "favoriteRoutes": ["Processing", "Reports"],
      "recentRoutes": ["Home", "Processing", "Profile"],
      "accessFrequency": {
        "Processing": 45,
        "Reports": 23,
        "Home": 67
      }
    }
  }
}
```

## 💾 数据迁移和初始化

### 1. 权限配置初始化脚本

**文件**: `scripts/init_permission_config.sql`
```sql
-- 初始化路由权限配置
INSERT INTO route_permissions (id, route_name, required_roles, required_permissions) VALUES
('rp_001', 'Platform', '["platform_super_admin", "platform_operator"]', NULL),
('rp_002', 'UserManagement', '["platform_super_admin", "factory_super_admin", "permission_admin"]', '["user.manage"]'),
('rp_003', 'Processing', '["factory_super_admin", "department_admin", "operator"]', '["processing.view"]'),
('rp_004', 'PermissionManagement', '["permission_admin", "factory_super_admin"]', '["permission.manage"]');

-- 初始化用户导航偏好（为现有用户）
INSERT INTO user_navigation_preferences (id, user_id, favorite_routes, recent_routes, default_landing_page)
SELECT 
  UUID() as id,
  id as user_id,
  '[]' as favorite_routes,
  '["Home"]' as recent_routes,
  'Home' as default_landing_page
FROM users 
WHERE id NOT IN (SELECT user_id FROM user_navigation_preferences);
```

### 2. 权限数据清理脚本

**文件**: `scripts/cleanup_permission_cache.sql`
```sql
-- 清理过期权限缓存
DELETE FROM mobile_permission_cache 
WHERE expires_at < NOW();

-- 清理旧的权限统计数据（保留30天）
DELETE FROM permission_usage_stats 
WHERE date_bucket < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- 清理失败的离线请求（保留7天）
DELETE FROM offline_request_queue 
WHERE status = 'failed' AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
```

## 🔧 配置文件更新

### 1. 权限配置文件

**文件**: `config/permissions.json`
```json
{
  "rolePermissionMapping": {
    "system_developer": {
      "level": -1,
      "permissions": ["*"],
      "dataAccess": "all",
      "canDelegate": false,
      "maxSubordinates": 0
    },
    "platform_super_admin": {
      "level": 0,
      "permissions": ["platform.*", "user.*", "admin.*"],
      "dataAccess": "all",
      "canDelegate": true,
      "maxSubordinates": 50
    }
  },
  "permissionGroups": {
    "user_management": {
      "displayName": "用户管理",
      "riskLevel": "high",
      "permissions": ["user.create", "user.edit", "user.delete", "user.view"]
    },
    "system_admin": {
      "displayName": "系统管理",
      "riskLevel": "critical",
      "permissions": ["system.config", "system.backup", "system.restore"]
    }
  },
  "navigationRules": {
    "defaultRoutes": {
      "platform": "Platform",
      "factory": "Home"
    },
    "restrictedRoutes": {
      "SystemSettings": ["system_developer"],
      "AuditLogs": ["platform_super_admin", "factory_super_admin"]
    }
  }
}
```

---

**Week 2 需求总结**:
- 📊 新增4个数据表（权限统计、审计日志、路由权限、离线队列）
- 🔌 新增5个API接口（批量权限检查、权限配置、角色审计等）
- ⚡ 增强现有2个接口（登录、用户信息）
- 🏗️ 新增3个业务逻辑服务（智能权限、部门继承、性能监控）

**文档版本**: 2.0
**最后更新**: 2025-08-07  
**Week 2 增强**: 已添加
**审核状态**: 待审核