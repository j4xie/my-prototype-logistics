# Cretas食品溯源系统 - API文档中心

**最后更新**: 2025-01-XX
**API版本**: v1.0
**服务器**: http://47.251.121.76:10010/

---

## 🔄 最新变更（2025-01-XX）

### ✅ 认证API去重和标准化完成

为了提高API的清晰度和前后端的开发效率，已完成以下优化:

- **删除**: 7个重复的Web端认证API和2个废弃的移动端接口
- **标准化**: 4个移动端认证API的命名（添加标准别名）
- **新增**: `POST /api/mobile/auth/verify-code` 验证验证码接口

**详细说明**: 📋 [API清理报告](./API_CLEANUP_REPORT.md)

**影响范围**:
- 前端需要更新authService.ts使用新的标准化API
- 查看[API清理报告](./API_CLEANUP_REPORT.md)的"前端需要调整"部分

---

## 🎯 MVP开发（推荐）

### 核心文档

| 文档 | 说明 | API数量 | 适用人员 |
|------|------|---------|---------|
| **[MVP API参考](./mvp-api-reference.md)** | 155个核心API，基于PRD精选 | 155 | 🔴 React Native开发必读 |
| **[MVP数据模型](./mvp-models.md)** | 80个核心数据模型 | 80 | 🔴 前端开发必读 |
| **[API清理报告](./API_CLEANUP_REPORT.md)** | API去重优化说明，前端迁移指南 | - | 🟡 前端开发参考 |
| **[PRD-API映射表](./prd-api-mapping.md)** | API与PRD需求对照 | - | 产品/开发 |
| **[快速开始指南](./quick-start-mvp.md)** | 5分钟上手 | - | 新手必读 |

### 推荐阅读顺序

**我是React Native开发者**:
1. [快速开始指南](./quick-start-mvp.md) - 了解API基础
2. [MVP API参考](./mvp-api-reference.md) - 查阅API详情
3. [MVP数据模型](./mvp-models.md) - TypeScript类型定义

**我是产品经理**:
1. [PRD-API映射表](./prd-api-mapping.md) - 需求与API对照
2. [MVP API参考](./mvp-api-reference.md) - 了解API功能

---

## 📊 MVP API统计

| Phase | 模块数 | API数量 | 开发周期 |
|-------|--------|---------|---------|
| **Phase 1** | 4个 | 28个 | Week 1-3 |
| **Phase 2** | 7个 | 78个 | Week 4-8 |
| **Phase 2-3** | 7个 | 49个 | Week 9 |
| **总计** | **18个** | **155个** | **9周** |

### Phase 1 - 基础功能（28个）

- 🔐 认证与授权：7个
- 📱 设备激活：3个
- 👤 用户管理：14个
- 📋 白名单管理：4个

### Phase 2 - 核心业务（78个）

- 🏭 生产加工：12个
- 🌾 原材料批次：14个
- 📋 生产计划：12个
- 🔄 转换率：10个
- 👥 供应商：8个
- 👤 客户：8个
- ⏰ 考勤工时：14个

### Phase 2-3 - 配置管理（49个）

- ⚙️ 工厂设置：8个
- 📦 产品类型：12个
- 🌾 原料类型：13个
- 🔧 工作类型：10个
- 📤 文件上传：1个
- 🔄 数据同步：3个
- 📊 系统监控：2个

---

## 📚 完整参考（后续版本）

| 文档 | 说明 | API数量 |
|------|------|---------|
| [完整API参考](./reference/swagger-api-reference.md) | 所有278个移动端API | 278 |
| [完整数据模型](./reference/api-models.md) | 所有222个数据模型 | 222 |

**包含的高级功能**:
- 设备管理（24个API）
- 报表统计（19个API）
- 高级财务分析
- 批量导入导出
- 详细统计和趋势分析

---

## 🔗 相关文档

### PRD文档
- [PRD-完整业务流程](../prd/PRD-完整业务流程与界面设计.md)
- [PRD-生产模块规划](../prd/PRD-生产模块规划.md)
- [PRD-系统产品需求](../prd/PRD-系统产品需求文档.md)

### 开发指南
- [CLAUDE.md](../../CLAUDE.md) - 项目开发策略
- [导航架构实现](../prd/导航架构实现指南.md)
- [角色权限速查表](../prd/角色权限和页面访问速查表.md)

### 外部资源
- [Swagger UI](http://47.251.121.76:10010/swagger-ui.html) - 在线API浏览
- [API服务器](http://47.251.121.76:10010/) - 开发环境

---

## ❓ 常见问题

### Q1: MVP版本和完整版有什么区别？

**A**: MVP版本(155个API)聚焦核心业务流程，移除了：
- 过度设计的统计分析API（约40个）
- 批量导入导出功能（约20个）
- 设备管理模块（24个API）
- 高级财务分析（约20个）
- 报表生成模块（19个API）

### Q2: 如何知道应该实现哪个API？

**A**: 查看[PRD-API映射表](./prd-api-mapping.md)，了解每个API对应的PRD需求和Phase优先级。

### Q3: API开发顺序是什么？

**A**:
1. Phase 1 (Week 1-3): 认证、用户、设备（28个）
2. Phase 2 (Week 4-6): 生产、原材料、计划（38个）
3. Phase 2 (Week 7-8): 转换率、供应商、客户、考勤（40个）
4. Phase 3 (Week 9): 配置管理（49个）

### Q4: 如果需要完整版API怎么办？

**A**: 查看[完整API参考](./reference/swagger-api-reference.md)，包含所有278个移动端API。

---

## 📞 联系方式

- **技术支持**: support@cretas.com
- **文档反馈**: docs@cretas.com
- **API问题**: api@cretas.com

---

**快速链接**:
- 📱 [React Native代码](../../frontend/CretasFoodTrace/)
- 🔧 [后端代码](../../backend/)
- 📊 [数据库Schema](../../backend/prisma/schema.prisma)
