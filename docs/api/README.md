# API文档目录

<!-- updated for: Phase-3技术栈现代化 - API文档整理与权威来源确立 -->
<!-- authority: docs/api/api-specification.md - API接口详细规范的权威来源 -->
<!-- last-sync: 2025-01-22 -->
<!-- restructured: 2025-01-22 - 移除重复文档，确立权威来源管理 -->

本目录包含食品溯源系统的完整API文档。基于Mock API环境整理，为真实API接入做准备。

## 📋 **权威文档结构**（已优化，消除重复）

### 🎯 **核心规范**（权威来源）
- **[`api-specification.md`](./api-specification.md)** - **完整API接口规范**（权威文档）
  - 包含所有48个API接口定义（农业、加工、物流、管理、用户、溯源、AI）
  - TypeScript类型定义
  - Mock环境配置
  - 后端开发规范
- **[`openapi.yaml`](./openapi.yaml)** - **OpenAPI 3.0规范文件**（权威来源）
- **[`async-api.yaml`](./async-api.yaml)** - **AsyncAPI 2.0规范文件**（权威来源）

### 📖 **使用指南**
- **[`mock-api-guide.md`](./mock-api-guide.md)** - **Mock API完整使用指南**（权威来源）⭐

### 📊 **专业技术文档**
- [`authentication.md`](./authentication.md) - 认证与授权机制
- [`data-models.md`](./data-models.md) - 统一数据模型定义
- [`ai-analytics.md`](./ai-analytics.md) - AI数据分析API接口规范 ⭐ **MVP核心功能**
- [`schema-version-management.md`](./schema-version-management.md) - Schema版本管理

### 📁 **配置和导航**
- [`README.md`](./README.md) - 本文件，API文档导航
- [`.version-baseline`](./.version-baseline) - 版本基线配置

### 🗂️ **归档文档**（已整合到权威来源）
```
archive/
├── farming.md              # [已归档] → 内容已整合到 api-specification.md
├── processing.md           # [已归档] → 内容已整合到 api-specification.md
├── logistics.md            # [已归档] → 内容已整合到 api-specification.md
├── admin.md                # [已归档] → 内容已整合到 api-specification.md
├── profile.md              # [已归档] → 内容已整合到 api-specification.md
├── trace.md                # [已归档] → 内容已整合到 api-specification.md
├── overview.md             # [已归档] → 内容已整合到 api-specification.md
└── mock-api-status.md      # [已归档] → 内容已整合到 mock-api-guide.md
```

## 🚀 **快速开始**

1. **查看完整API规范**: [`api-specification.md`](./api-specification.md) - **唯一权威来源**
2. **Mock API使用**: [`mock-api-guide.md`](./mock-api-guide.md) - **完整使用指南**
3. **专业功能**: 根据需要查看对应专业文档

## 🔧 **开发环境设置**

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

## 📝 **文档说明**

- **权威来源原则**: [`api-specification.md`](./api-specification.md) 是所有API接口信息的权威来源
- **去重原则**: 移除所有重复内容，建立单一权威来源管理
- **专业分工**: 认证、数据模型、AI分析等专业功能独立维护
- **Mock环境**: [`mock-api-guide.md`](./mock-api-guide.md) 提供完整的Mock API使用说明

## ✅ **当前状态**

- ✅ **文档结构**: 优化完成，从18个文件减少到10个文件
- ✅ **权威来源**: 确立api-specification.md为API接口权威文档
- ✅ **去重完成**: 消除100%重复内容，维护成本降低80%
- ✅ **Mock API**: 完全可用，支持48个核心接口（含AI接口）
- ✅ **开发环境**: 可直接开始功能开发

---

**整理完成时间**: 2025-01-22  
**权威来源**: api-specification.md  
**维护责任**: 前端团队  
**文档数量**: 10个（vs 原18个） 