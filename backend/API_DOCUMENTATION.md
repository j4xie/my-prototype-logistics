# 黑牛食品溯源系统 API 文档

## 系统概述

黑牛食品溯源系统后端API基于Node.js + Express + Prisma + MySQL构建，提供多租户架构和完整的认证权限管理功能。

## 服务信息

服务地址: http://localhost:3001
数据库: MySQL 8.0.42 (heiniu_db)
认证方式: JWT + Session管理
架构模式: 多租户 + 角色权限控制

## 核心功能模块

### 1. 认证模块 (Authentication)
负责用户登录、注册、权限验证等核心认证功能

### 2. 白名单管理 (Whitelist)
支持白名单前置注册机制，管理员可预先添加允许注册的手机号

### 3. 用户管理 (User Management)
管理工厂内部用户，包括角色分配、权限设置、用户激活等

### 4. 平台管理 (Platform Management)
平台级别的管理功能，包括工厂管理、平台管理员等

## API端点详情

### 健康检查
端点: GET /health
功能: 检查服务器运行状态
请求: 无需参数
响应: 服务器状态、运行时间、内存使用情况

### 认证相关接口

#### 工厂用户登录
端点: POST /api/auth/login
功能: 工厂用户登录认证
请求参数:
- factoryId: 工厂ID (必需)
- username: 用户名 (必需)
- password: 密码 (必需)
响应: 用户信息、工厂信息、JWT令牌

#### 平台管理员登录
端点: POST /api/auth/platform-login
功能: 平台管理员登录认证
请求参数:
- username: 用户名 (必需)
- password: 密码 (必需)
响应: 管理员信息、JWT令牌

#### 手机号验证
端点: POST /api/auth/verify-phone
功能: 验证手机号是否在白名单中
请求参数:
- phoneNumber: 手机号码 (必需)
- factoryId: 工厂ID (必需)
响应: 验证结果、临时令牌

#### 用户注册
端点: POST /api/auth/register
功能: 完成用户注册
请求参数:
- phoneNumber: 手机号码 (必需)
- username: 用户名 (必需)
- password: 密码 (必需)
- email: 邮箱 (必需)
- fullName: 真实姓名 (必需)
- tempToken: 临时验证令牌 (必需)
响应: 注册结果、用户ID

#### 用户登出
端点: POST /api/auth/logout
功能: 用户登出，撤销会话
请求: 需要认证
响应: 登出结果

#### 获取当前用户信息
端点: GET /api/auth/user
功能: 获取当前登录用户信息
请求: 需要认证
响应: 用户详细信息、工厂信息

#### 刷新令牌
端点: POST /api/auth/refresh
功能: 刷新JWT令牌
请求参数:
- refreshToken: 刷新令牌 (必需)
响应: 新的JWT令牌

#### 修改密码
端点: PUT /api/auth/password
功能: 修改用户密码
请求参数:
- oldPassword: 旧密码 (必需)
- newPassword: 新密码 (必需)
响应: 修改结果

#### 认证状态检查
端点: GET /api/auth/status
功能: 检查当前认证状态
请求: 可选认证
响应: 认证状态、用户类型

### 白名单管理接口

#### 获取白名单列表
端点: GET /api/whitelist
功能: 获取工厂的白名单列表
请求: 需要认证
响应: 白名单列表、分页信息

#### 添加白名单
端点: POST /api/whitelist
功能: 添加手机号到白名单
请求参数:
- phoneNumber: 手机号码 (必需)
- expiresAt: 过期时间 (可选)
响应: 添加结果

#### 删除白名单
端点: DELETE /api/whitelist/:id
功能: 删除白名单条目
请求: 需要认证
响应: 删除结果

### 用户管理接口

#### 获取用户列表
端点: GET /api/users
功能: 获取工厂的用户列表
请求: 需要认证
响应: 用户列表、分页信息

#### 获取待激活用户
端点: GET /api/users/pending
功能: 获取待激活的用户列表
请求: 需要认证
响应: 待激活用户列表

#### 激活用户
端点: PUT /api/users/:id/activate
功能: 激活用户账户
请求参数:
- roleCode: 角色代码 (必需)
- roleLevel: 角色等级 (必需)
- department: 部门 (可选)
- position: 职位 (可选)
- permissions: 权限列表 (可选)
响应: 激活结果

#### 更新用户信息
端点: PUT /api/users/:id
功能: 更新用户信息
请求参数:
- fullName: 真实姓名 (可选)
- email: 邮箱 (可选)
- department: 部门 (可选)
- position: 职位 (可选)
- permissions: 权限列表 (可选)
响应: 更新结果

#### 重置用户密码
端点: PUT /api/users/:id/reset-password
功能: 重置用户密码
请求: 需要管理员权限
响应: 重置结果

### 平台管理接口

#### 获取工厂列表
端点: GET /api/platform/factories
功能: 获取平台所有工厂
请求: 需要平台管理员权限
响应: 工厂列表、统计信息

#### 创建工厂
端点: POST /api/platform/factories
功能: 创建新工厂
请求参数:
- name: 工厂名称 (必需)
- industry: 所属行业 (可选)
- address: 工厂地址 (可选)
- contactName: 联系人姓名 (可选)
- contactPhone: 联系电话 (可选)
- contactEmail: 联系邮箱 (可选)
响应: 创建结果、工厂信息

#### 创建工厂超级管理员
端点: POST /api/platform/factories/:factoryId/admin
功能: 为工厂创建超级管理员
请求参数:
- username: 用户名 (必需)
- password: 密码 (必需)
- email: 邮箱 (必需)
- fullName: 真实姓名 (必需)
响应: 创建结果

## 数据库结构

### 工厂表 (factories)
存储工厂基本信息，支持多租户架构

### 平台管理员表 (platform_admins)
存储平台级别管理员信息

### 用户表 (users)
存储工厂内部用户信息，包含权限配置

### 用户白名单表 (user_whitelist)
存储允许注册的手机号列表

### 会话表 (sessions)
存储用户登录会话信息

### 临时令牌表 (temp_tokens)
存储临时验证令牌，用于手机验证等场景

## 认证机制

### JWT令牌结构
包含用户ID、工厂ID、用户名、角色、权限等信息

### 会话管理
每次登录在数据库中创建会话记录，支持会话撤销

### 权限验证
基于角色和权限的多层次验证机制

## 错误处理

### 标准错误响应格式
所有API错误都返回统一的错误格式，包含错误码、消息、时间戳等信息

### 常见错误码
- VALIDATION_ERROR: 数据验证失败
- AUTHENTICATION_ERROR: 认证失败
- AUTHORIZATION_ERROR: 权限不足
- NOT_FOUND_ERROR: 资源不存在
- CONFLICT_ERROR: 数据冲突
- DATABASE_ERROR: 数据库操作失败

## 测试账户

### 平台管理员
用户名: platform_admin
密码: Admin@123456
权限: 平台全部权限

### 工厂超级管理员
用户名: factory_admin
密码: SuperAdmin@123
工厂ID: TEST_2024_001
权限: 工厂全部权限

### 部门管理员
养殖管理员: farming_admin / DeptAdmin@123
加工管理员: processing_admin / DeptAdmin@123
物流管理员: logistics_admin / DeptAdmin@123

## 部署信息

### 环境变量配置
需要配置数据库连接、JWT密钥、CORS设置等环境变量

### 依赖要求
Node.js 18+, MySQL 8.0+, NPM包管理器

### 启动命令
开发环境: npm run dev
生产环境: npm start

## 安全考虑

### 密码加密
使用bcrypt进行密码哈希存储

### JWT安全
设置合理的过期时间，支持令牌刷新

### 数据验证
所有输入数据都进行严格的格式和内容验证

### 会话管理
支持会话撤销，防止令牌泄露风险

本文档涵盖了黑牛食品溯源系统后端API的核心功能和使用方法，所有功能都已通过MySQL数据库验证测试。