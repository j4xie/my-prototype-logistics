# 🎯 Cursor Rules 目录索引

> **最后更新**: 2025-02-02  
> **文件数量**: 19个 (重构后，包含3个管理文档 + 1个统一主控规则 + 3个专业模块 + 12个专业规则)  
> **维护状态**: ✅ 活跃维护 - **已完成规则融合重构**

## 🆕 **重构更新说明**
- **融合完成**: 已将 `project-management-auto` + `comprehensive-development-workflow-auto` + `development-principles-always` 融合为统一主控规则
- **新架构**: 主控规则 + 专业模块引用的层次化架构
- **删除文件**: 移除了4个重复/冗余规则文件
- **向后兼容**: 所有功能保持，使用体验优化

## 📚 **快速导航**

### **🚀 常用规则** (重构后)
- [**统一开发管理规则**](#1-核心统一规则) - **新主控规则，开始任务时首选**
- [5层验证标准](#2-验证测试规则) - 验证任务完成时使用  
- [API开发指导](#3-api开发规则) - API相关开发时使用
- [使用场景指导](#4-使用指导规则) - 不确定用哪个规则时参考

### **🎨 设计开发规则**
- [UI设计系统](#5-ui设计规则) - 前端界面开发时使用

### **⚙️ 项目管理规则**
- [任务管理](#6-项目管理规则) - 任务创建和管理时使用
- [文档阅读指导](#6-项目管理规则) - 开始任务前参考

---

## 📋 **分类详细目录**

### **1. 核心统一规则** (Unified Core Rules) 🆕

#### `development-management-unified.mdc` ⭐ **统一开发管理规则**
- **类型**: 主控规则 (融合3个原规则)
- **大小**: 5.8KB, 193行
- **用途**: 智能层次化开发管理
- **融合来源**: 
  - ✅ `project-management-auto.mdc` (已删除)
  - ✅ `comprehensive-development-workflow-auto.mdc` (已删除)
  - ✅ `development-principles-always.mdc` (已删除)
- **核心功能**:
  - 🎯 快速场景决策路由 (30秒内确定适用层级)
  - 📚 4层智能引用架构
  - 🧭 智能引用导航系统
  - 📋 沟通规范速查
- **使用场景**: 
  - ✅ 开始新的开发任务 (第1-3层)
  - ✅ 项目质量问题 (第2层)
  - ✅ 验证任务 (第3层)
  - ✅ 特定场景深度指引 (第4层)

#### **专业模块** (development-modules/)
- `core-principles-detailed.mdc` - 核心开发原则详细指导
- `project-management-detailed.mdc` - 项目管理与质量控制详细规范  
- `workflow-procedures-detailed.mdc` - 标准开发工作流程详细规范

---

### **2. 验证测试规则** (Validation & Testing)

#### `comprehensive-regression-testing-agent.mdc` 🎯 **权威验证标准**
- **类型**: Agent规则
- **大小**: 5.8KB, 195行
- **用途**: 5层验证标准的权威技术定义
- **使用场景**:
  - ✅ 验证任务完成
  - ✅ 检查回归问题
  - ✅ 用户质疑项目状态
- **核心功能**:
  - 强制性5层验证标准详细定义
  - Mock机制验证和防护
  - 状态评估防过度乐观技术标准
  - 回归测试具体执行机制

#### `refactor-phase3-validation-agent.mdc` 🔧 **Phase-3专用验证**
- **类型**: Agent规则
- **大小**: 14KB, 494行
- **用途**: Phase-3技术栈现代化的专用验证
- **关系**: 扩展了comprehensive-regression-testing的标准
- **特色功能**:
  - Phase-3特定的文档结构指导
  - 核心组件特别验证规则
  - useApi Hook深度验证
  - 技术栈现代化验证标准

#### `test-validation-standards-agent.mdc` 📝 **验证脚本标准**
- **类型**: Agent规则
- **大小**: 3.8KB, 97行
- **用途**: 任务导向验证脚本创建标准
- **核心功能**: 
  - 验证脚本结构规范
  - 任务ID关联机制
  - 验证报告生成要求

---

### **3. API开发规则** (API Development)

#### `api-integration-agent.mdc` 🔌 **API集成**
- **类型**: Agent规则
- **大小**: 13KB, 527行
- **用途**: API调用实现和问题修复
- **使用场景**: 实现API调用、修复API问题

#### `api-interface-design-agent.mdc` 🎨 **API接口设计**
- **类型**: Agent规则
- **大小**: 6.9KB, 248行
- **用途**: API接口设计和文档更新
- **使用场景**: 设计API接口、更新API文档

#### `api-rules-usage-guide-manual.mdc` 🎯 **API开发统一管理** (子主控规则)
- **类型**: Manual规则
- **大小**: 4.9KB, 174行
- **用途**: API任务规则选择指导
- **核心功能**: 帮助选择正确的API相关规则

---

### **4. UI设计规则** (UI Design)

#### `ui-design-system-auto.mdc` 🎨 **UI设计系统**
- **类型**: Auto规则
- **大小**: 4.5KB, 159行
- **用途**: Neo Minimal iOS-Style Admin UI标准
- **适用范围**: 所有UI组件开发
- **核心标准**:
  - 布局规范: max-w-[390px] mx-auto
  - 卡片设计: bg-white rounded-lg shadow-sm p-4
  - 交互效果: hover:shadow-md hover:scale-[1.03]
  - 无障碍设计: aria-label, tabindex等

---

### **5. 重构专用规则** (Refactor Phase)

#### `refactor-management-unified.mdc` 🔄 **重构管理统一规则** (子主控规则) 🆕
- **类型**: 子主控规则
- **大小**: 约15KB, 400+行
- **用途**: 重构领域统一管理，智能路由到具体重构流程
- **整合来源**: 
  - ✅ `refactor-phase2-agent.mdc` (已整合)
  - ✅ `refactor-phase3-agent.mdc` (已整合)
  - ✅ `refactor-phase3-core-agent.mdc` (已整合)
  - ✅ `refactor-phase3-validation-agent.mdc` (已整合)
- **核心功能**:
  - 🎯 重构任务智能路由 (10秒内确定适用流程)
  - 📚 重构核心原则 (渐进式重构、验证优先)
  - 🔄 重构标准工作流程 (4阶段完整流程)
  - 🛠️ Phase-2专用流程 (代码优化与模块化)
  - 🚀 Phase-3管理流程 (技术栈现代化管理)
  - 🏗️ Phase-3核心变更流程 (架构重构与升级)
  - ✅ Phase-3验证流程 (任务验证与功能测试)
- **使用场景**: 
  - ✅ 任何重构相关工作 (统一入口)
  - ✅ Phase-2代码优化 (专用流程)
  - ✅ Phase-3技术栈现代化 (完整管理)
  - ✅ 重构验证和质疑响应 (深度验证)

#### `refactor-phase3-validation-agent.mdc` ✅ **Phase-3验证** (保留)
- **类型**: Agent规则
- **大小**: 14KB, 499行
- **用途**: Phase-3专用深度验证流程
- **关系**: 被 refactor-management-unified 引用，提供详细验证指导
- **保留原因**: 验证流程复杂，需要独立的详细指导

---

### **6. 使用指导规则** (Usage Guides)

#### `comprehensive-rules-usage-guide-manual.mdc` 📋 **综合规则选择指导**
- **类型**: Manual规则
- **大小**: 9.5KB, 约300行
- **用途**: 选择comprehensive开发工作流或回归测试规则
- **核心功能**:
  - 规则选择指导表
  - 典型使用场景说明
  - 职责分工明确
  - 快速判断方法

---

### **6. 项目管理规则** (Project Management)

#### `task-management-manual.mdc` 📝 **任务管理**
- **类型**: Manual规则
- **大小**: 3.0KB, 115行
- **用途**: 任务创建和管理规范
- **核心功能**: 任务标准化创建流程

#### `docs-reading-guide-agent.mdc` 📚 **文档阅读指导**
- **类型**: Agent规则
- **大小**: 6.6KB, 202行
- **用途**: 开始任务前的文档阅读指导
- **核心功能**: 
  - docs目录结构与阅读时机
  - 阅读优先级指导
  - 工作流程中的docs阅读检查清单

---

### **7. 系统规则** (System)

#### `cursor-rules.mdc` ⚙️ **规则格式规范**
- **类型**: 系统规则
- **大小**: 5.1KB, 114行
- **用途**: Cursor Rule规则格式规范和文件组织指南
- **核心内容**:
  - 规则文件模板结构
  - 命名规范和必需字段
  - 文件组织方式

#### `interactive-final-review-always.mdc` 🔍 **最终审查**
- **类型**: Always规则
- **大小**: 12KB, 132行
- **用途**: 交互式最终审查流程
- **适用范围**: 所有重要任务完成前

---

### **8. 管理文档** (Management Documents)

#### `RULES_INDEX.md` 📚 **本索引文件**
- **类型**: 管理文档
- **大小**: 约10KB
- **用途**: Rules目录完整索引和使用指导
- **核心功能**: 规则分类、快速导航、使用指南

#### `RULES_DIRECTORY_CLEANUP_PLAN.md` 🧹 **清理计划**
- **类型**: 管理文档  
- **大小**: 6.1KB, 160行
- **用途**: Rules目录整理计划和执行记录
- **状态**: ✅ 已完成清理

#### `PHASE3-RULES-REFERENCE-VERIFICATION.md` 🔍 **Phase3引用验证**
- **类型**: 验证文档
- **大小**: 约8KB
- **用途**: 验证cursor rules和phase3文件间引用关系
- **验证结果**: 🟢 引用关系基本正确
- **引用质量评分**: 95/100

---

## 🔗 **规则间引用关系图**

```
development-management-unified.mdc (统一主控规则) ⭐新架构⭐
├── 层级1-3 基础指导 (所有开发活动)
├── 引用 → development-modules/core-principles-detailed.mdc (详细原则)
├── 引用 → development-modules/project-management-detailed.mdc (管理规范)  
├── 引用 → development-modules/workflow-procedures-detailed.mdc (工作流程)
└── 层级4 特定场景引用 → 现有专业规则

comprehensive-regression-testing-agent.mdc (权威验证)
└── 被引用 ← development-modules/workflow-procedures-detailed.mdc
└── 扩展 ← refactor-phase3-validation-agent.mdc

api-rules-usage-guide-manual.mdc (API开发统一管理-子主控)
├── 指向 → api-interface-design-agent.mdc
└── 指向 → api-integration-agent.mdc

refactor-management-unified.mdc (重构管理统一-子主控) 🆕
├── 整合 → Phase-2专用流程 (原refactor-phase2-agent)
├── 整合 → Phase-3管理流程 (原refactor-phase3-agent)
├── 整合 → Phase-3核心变更流程 (原refactor-phase3-core-agent)
├── 整合 → Phase-3验证流程 (原refactor-phase3-validation-agent部分)
└── 引用 → refactor-phase3-validation-agent.mdc (详细验证指导)

comprehensive-rules-usage-guide-manual.mdc (综合指导)
├── 指向 → development-management-unified.mdc (新架构)
└── 指向 → comprehensive-regression-testing-agent.mdc
```

---

## 🎯 **快速使用指南**

### **我要开始新任务**
1. 首先使用: `development-management-unified.mdc` ⭐(新统一主控规则)
2. 根据需要深入: `development-modules/` 下的详细模块
3. 如果是API任务: 参考 `api-rules-usage-guide-manual.mdc` (API子主控规则)
4. 如果是重构任务: 参考 `refactor-management-unified.mdc` (重构子主控规则) 🆕

### **我要验证任务完成**
1. 主要使用: `comprehensive-regression-testing-agent.mdc`
2. 如果是Phase-3: 同时参考 `refactor-phase3-validation-agent.mdc`
3. 创建验证脚本: 参考 `test-validation-standards-agent.mdc`

### **我要开发UI组件**
1. 遵循: `ui-design-system-auto.mdc`
2. 工作流程: `development-management-unified.mdc`

### **我不确定使用哪个规则**
1. 查看: `comprehensive-rules-usage-guide-manual.mdc`
2. 对于API任务: 查看 `api-rules-usage-guide-manual.mdc` (API子主控规则)

---

## 📊 **统计信息**

### **文件类型分布**
- **Agent规则**: 9个 (用于特定目的)
- **Auto规则**: 2个 (自动应用，包含1个统一主控规则)
- **Manual规则**: 3个 (手动选择使用)
- **Always规则**: 1个 (全局生效)
- **详细模块**: 3个 (development-modules/ 专业模块)
- **管理文档**: 1个 (RULES_INDEX.md 等)

### **按大小排序**
1. `refactor-management-unified.mdc` (15KB) - 重构管理统一规则 🆕
2. `refactor-phase3-validation-agent.mdc` (14KB)
3. `api-integration-agent.mdc` (13KB)
4. `interactive-final-review-always.mdc` (12KB)
5. `development-management-unified.mdc` (8KB) - 统一开发管理规则

### **最后重构记录**
- **重构时间**: 2025-02-02
- **重构内容**: 规则融合统一架构
- **删除文件**: 4个重复/冗余文件
- **新增架构**: 1个主控规则 + 3个专业模块
- **结果**: 从23个文件优化到19个文件，引入层次化智能引用架构

---

## 🔄 **维护指南**

### **添加新规则时**
1. 遵循命名规范: `name-{type}.mdc`
2. 更新本索引文件
3. 检查是否与现有规则重复
4. 建立适当的引用关系

### **修改现有规则时**
1. 检查依赖此规则的其他文件
2. 更新引用关系
3. 测试规则有效性
4. 更新相关文档

### **定期维护**
- **月度检查**: 查找重复内容和过时规则
- **季度整理**: 重新评估规则分类和引用关系
- **年度清理**: 全面清理和重构规则体系

---

**📞 需要帮助？**
- 查看具体规则的description字段了解详细用途
- 参考本索引的"快速使用指南"部分
- 查看规则间的引用关系图 