# API文档目录

<!-- updated for: Phase-3技术栈现代化 - API文档与客户端封装同步优化 -->
<!-- authority: docs/api/api-specification.md - API接口详细规范的权威来源 -->
<!-- last-sync: 2025-01-22 -->

本目录包含食品溯源系统的完整API文档。基于Mock API环境整理，为真实API接入做准备。

## 📋 文档结构

### 🎯 核心规范（权威来源）
- **[`api-specification.md`](./api-specification.md)** - **完整API接口规范**（权威文档）
  - 11个核心API接口定义
  - TypeScript类型定义
  - Mock环境配置
  - 后端开发规范

### 📖 概览和指南
- [`overview.md`](./overview.md) - API总览与通用约定
- [`authentication.md`](./authentication.md) - 认证与授权机制
- **[`mock-api-guide.md`](./mock-api-guide.md)** - **Mock API完整使用指南** ⭐
- **[`mock-api-status.md`](./mock-api-status.md)** - **Mock API测试状态报告** 🧪

### 📊 数据定义
- [`data-models.md`](./data-models.md) - 统一数据模型定义

### 🌾 业务模块API
- [`farming.md`](./farming.md) - 农业模块API
- [`processing.md`](./processing.md) - 加工模块API
- [`logistics.md`](./logistics.md) - 物流模块API
- [`trace.md`](./trace.md) - 溯源模块API

### 🧠 AI智能分析API
- **[`ai-analytics.md`](./ai-analytics.md)** - **AI数据分析API接口规范** ⭐ **MVP核心功能**

### 👥 管理功能API
- [`admin.md`](./admin.md) - 管理模块API
- [`profile.md`](./profile.md) - 用户中心API

## 🚀 快速开始

1. **查看完整API规范**: [`api-specification.md`](./api-specification.md)
2. **Mock API使用指南**: [`mock-api-guide.md`](./mock-api-guide.md) - 包含完整使用说明
3. **API客户端使用**: 参考api-specification.md中的技术实现方案

## 🔧 开发环境设置

### Mock API启动
```bash
cd web-app-next
npm run dev
```

访问地址：`http://localhost:3000`

### 测试账户
```typescript
// 管理员账户
{ username: 'admin', password: 'admin123', role: 'admin' }

// 普通用户
{ username: 'user', password: 'user123', role: 'user' }
```

## 📝 文档说明

- **权威来源**: [`api-specification.md`](./api-specification.md) 是所有API接口信息的权威来源
- **Mock环境**: [`mock-api-guide.md`](./mock-api-guide.md) 提供完整的Mock API使用说明
- **其他文档**: 提供特定主题的详细说明和背景信息
- **开发指导**: 基于Mock API环境，为真实API接入做准备

## ✅ 当前状态

- ✅ **Mock API**: 完全可用，支持18个核心接口（含7个AI接口）
- ✅ **API客户端**: TypeScript封装完整，支持环境切换
- ✅ **AI分析功能**: Hook系统完整，支持MVP核心需求
- ✅ **文档体系**: 权威来源明确，去重完成
- ✅ **开发环境**: 可直接开始功能开发

---

**文档职责**: 目录导航和快速引导  
**权威来源**: api-specification.md  
**维护责任**: 前端团队 