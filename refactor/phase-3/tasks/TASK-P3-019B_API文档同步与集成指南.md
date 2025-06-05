# TASK-P3-019B: API文档同步与集成指南

<!-- created: 2025-02-02 -->
<!-- authority: Phase-3技术栈现代化 - API文档体系完善任务 -->
<!-- workflow: development-management-unified 3阶段流程 -->

## 📋 任务基本信息

**任务ID**: TASK-P3-019B
**任务名称**: API文档同步与集成指南 [范围扩展]
**优先级**: P1 (高优先级 - 后端集成准备)
**分配给**: AI助手
**创建日期**: 2025-02-02
**预计完成**: 2025-02-10
**当前状态**: 📋 待开始 → **依赖P3-019A完成**
**完成度**: 0%
**预估工时**: 3个工作日 (扩展后)
**新依赖**: TASK-P3-019A (Mock API业务模块扩展)
**遵循规范**: development-management-unified.mdc, refactor-management-unified.mdc

## 📖 **必读参考文档** (Day 1开始前强制阅读)

### **权威Schema文件** (来自TASK-P3-018)
- **`docs/api/openapi.yaml`** → **REST API权威Schema** (由P3-018创建和冻结)
  - **API文档更新基础** → 所有API文档必须与此Schema保持同步
  - **后端集成对接标准** → 真实API开发的接口规范参考
  - **版本管理依据** → API变更和版本升级的权威依据
  - **使用要求**: Day 1开始前必须基于此Schema更新所有API文档

- **`docs/api/async-api.yaml`** → **消息队列API规范** (由P3-018创建和冻结)
  - **实时API集成指南** → WebSocket、消息队列等实时接口的集成文档基础
  - **事件驱动架构文档** → 异步业务流程的后端集成策略
  - **使用要求**: Day 2实施时必须参考此规范编写实时API集成指南

### **Mock API架构文档** (来自TASK-P3-017B)
- **`docs/architecture/mock-api-architecture.md`**
  - **第1节：统一架构概述** → API文档同步的整体策略指导
  - **第2节：中央Mock服务架构** → P3-018B实现的服务文档化基础
  - **第3节：Schema版本管理** → 版本控制体系的文档化要求
  - **第4节：环境切换机制** → Mock到真实API切换的文档规范

### **Schema版本管理策略** (来自TASK-P3-017B)
- **`docs/api/schema-version-management.md`**
  - **版本控制规范** → API文档的版本管理标准
  - **变更跟踪机制** → 接口变更的文档记录方法
  - **兼容性策略** → 向后兼容的文档维护原则

### **Mock API实施成果** (来自TASK-P3-019A)
- **中央Mock服务状态** → 156个接口的实现情况统计
- **业务模块覆盖** → 农业、加工、物流、管理4模块的API完整性
- **权限和错误模拟** → 权限控制和错误处理的Mock实现

### **⚠️ 重要说明：本任务创建的文档将被后续任务强制引用**
**本任务将创建的关键文档**：
- `web-app-next/docs/api-integration-guide.md` → **后端集成的权威指南**
- `web-app-next/docs/backend-integration-checklist.md` → **集成验收的标准清单**
- `scripts/deployment/api-switch.sh` → **环境切换的自动化工具**

**后续任务必须引用本任务成果**：
- P3-021至P3-024的页面迁移任务必须参考集成指南进行API调用
- 部署和运维相关任务必须使用本任务创建的切换脚本和检查清单

## 任务描述

**原任务范围**: 同步更新API文档体系，建立后端集成指南
**扩展后范围**: 基于Mock API架构重组成果，建立完整的OpenAPI+AsyncAPI双Schema文档体系，提供无缝的Mock-to-Real API切换支撑。

### 🎯 核心目标 [扩展更新]

1. **权威Schema文档化**: 基于P3-018确立的Schema，建立OpenAPI+AsyncAPI完整文档体系
2. **中央Mock服务文档**: 为P3-018B实现的中央Mock服务提供使用和维护文档
3. **Hook层集成文档**: 配合P3-018C的Hook层统一改造，提供开发者使用指南
4. **环境切换策略**: 建立Mock环境到真实API的渐进式迁移方案
5. **版本管理体系**: 建立Schema版本控制和API变更管理规范
6. **监控预警系统**: 实现API健康监控和自动化切换触发机制

## 实施步骤

### Day 1: API文档状态全面更新
- [ ] **Mock API状态文档更新** [3小时]
  - [ ] 更新 `docs/api/mock-api-status.md`
    - [ ] 完成度统计: 27% → 100%
    - [ ] 156个接口实现状态记录
    - [ ] 按模块分类的功能说明
    - [ ] Mock数据示例和最佳实践
  - [ ] 更新接口覆盖度统计表
  - [ ] 添加各业务模块的完整性验证报告

- [ ] **Mock API使用指南完善** [3小时]
  - [ ] 更新 `docs/api/mock-api-guide.md`
    - [ ] 使用说明和快速入门
    - [ ] 业务模块API调用示例
    - [ ] 错误处理和响应格式规范
    - [ ] 性能优化和缓存策略
  - [ ] 添加权限模拟使用说明
  - [ ] 补充错误和延迟模拟启用方法

- [ ] **API规范文档更新** [2小时]
  - [ ] 更新 `docs/api/api-specification.md`
    - [ ] 整体API架构更新
    - [ ] 完整的156个接口清单
    - [ ] 版本信息和变更历史
    - [ ] 技术规范和标准说明
  - [ ] 更新 `docs/api/README.md`
    - [ ] API文档导航优化
    - [ ] Mock API使用快速入门
    - [ ] 后端集成准备检查清单

### Day 2: 后端集成指南和策略文档
- [ ] **API集成指南创建** [4小时]
  - [ ] 创建 `web-app-next/docs/api-integration-guide.md`
    - [ ] Mock API到真实API迁移步骤
    - [ ] 环境配置和切换策略详解
    - [ ] 分阶段迁移计划和时间表
    - [ ] 回滚预案和应急处理
    - [ ] 测试验证检查清单
  - [ ] 技术架构对比分析
  - [ ] 数据格式映射和字段对照

- [ ] **后端集成检查清单** [2小时]
  - [ ] 创建 `web-app-next/docs/backend-integration-checklist.md`
    - [ ] 后端API规范对齐检查
    - [ ] 数据格式和字段映射
    - [ ] 认证和权限集成方案
    - [ ] 错误处理和监控接入
  - [ ] 环境变量配置模板
  - [ ] API健康检查和监控设置

- [ ] **部署切换脚本和工具** [2小时]
  - [ ] 创建 `scripts/deployment/api-switch.sh`
    - [ ] 环境变量切换脚本
    - [ ] 健康检查和回滚机制
    - [ ] 部署验证自动化
  - [ ] API配置管理工具
  - [ ] 切换状态监控和报告

## 验收标准

### 文档质量标准
- [ ] 文档完整性: 所有新建/更新文档内容完整无遗漏
- [ ] 格式规范: 遵循项目markdown规范和模板要求
- [ ] 链接有效: 所有内部文档链接可访问，外部引用准确
- [ ] 示例可用: API调用示例实际可执行，代码片段语法正确
- [ ] 版本一致: 文档版本信息与实际实现状态完全对应

### 实用性标准
- [ ] 操作清晰: 集成指南步骤明确，可按步骤执行
- [ ] 场景覆盖: 涵盖开发、测试、生产环境的典型场景
- [ ] 问题解决: 提供常见问题的解决方案和故障排除
- [ ] 维护便利: 建立文档更新和维护的标准流程

### 技术准确性标准
- [ ] 接口描述: API接口描述与实际实现100%匹配
- [ ] 配置正确: 环境配置和部署脚本经过验证可用
- [ ] 兼容性确认: 切换策略与现有技术栈完全兼容

## 变更记录

| 文件路径 | 变更类型 | 变更说明 | 日期 |
|---------|---------|---------|------|
| docs/api/mock-api-status.md | 更新 | Mock API完成度27%→100% | Day 1 |
| docs/api/mock-api-guide.md | 更新 | 使用指南和最佳实践 | Day 1 |
| docs/api/api-specification.md | 更新 | 156个接口规范更新 | Day 1 |
| docs/api/README.md | 更新 | 导航和快速入门优化 | Day 1 |
| web-app-next/docs/api-integration-guide.md | 新增 | 后端集成完整指南 | Day 2 |
| web-app-next/docs/backend-integration-checklist.md | 新增 | 集成检查清单 | Day 2 |
| scripts/deployment/api-switch.sh | 新增 | 自动化切换脚本 | Day 2 |

## 依赖任务

- TASK-P3-019A: Mock API业务模块扩展 (必须完成 - 提供156个接口实现状态)

## 技术实现方案

### 1. API文档状态同步架构
```markdown
# docs/api/mock-api-status.md 更新结构

## Mock API完整度统计
| 模块 | 接口数量 | 实现状态 | 覆盖率 | 最后更新 |
|------|---------|---------|--------|----------|
| 认证模块 | 4 | ✅ 已完成 | 100% | 2025-01-15 |
| 用户模块 | 22 | ✅ 已完成 | 100% | 2025-02-08 |
| 农业模块 | 25 | ✅ 已完成 | 100% | 2025-02-08 |
| 加工模块 | 28 | ✅ 已完成 | 100% | 2025-02-08 |
| 物流模块 | 30 | ✅ 已完成 | 100% | 2025-02-08 |
| 管理模块 | 35 | ✅ 已完成 | 100% | 2025-02-08 |
| AI分析模块 | 7 | ✅ 已完成 | 100% | 2025-01-31 |
| 溯源模块 | 5 | ✅ 已完成 | 100% | 2025-01-15 |
| **总计** | **156** | **✅ 已完成** | **100%** | **2025-02-08** |

## 业务场景覆盖度
- 🌾 农业生产全流程: 田地管理 → 作物种植 → 收获记录
- 🏭 加工生产链条: 原料采购 → 生产加工 → 质量检测 → 产品包装
- 🚛 物流配送体系: 运输调度 → 实时追踪 → 温度监控 → 配送完成
- 👥 用户权限管理: 角色分配 → 权限控制 → 审计日志
- 🔍 溯源查询系统: 产品溯源 → 批次追踪 → 公开查询
- 🤖 AI智能分析: 生产洞察 → 质量预测 → 效率优化
```

### 2. 后端集成策略设计
```typescript
// web-app-next/src/config/api-environment.ts
export interface ApiEnvironmentConfig {
  name: 'development' | 'staging' | 'production';
  baseURL: string;
  enableMock: boolean;
  timeout: number;
  retryAttempts: number;
  healthCheckPath: string;
}

export const API_ENVIRONMENTS: Record<string, ApiEnvironmentConfig> = {
  development: {
    name: 'development',
    baseURL: '/api',              // Next.js API Routes (Mock)
    enableMock: true,
    timeout: 5000,
    retryAttempts: 3,
    healthCheckPath: '/api/health'
  },
  staging: {
    name: 'staging',
    baseURL: process.env.NEXT_PUBLIC_STAGING_API_URL!,
    enableMock: false,            // 真实API
    timeout: 10000,
    retryAttempts: 5,
    healthCheckPath: '/health'
  },
  production: {
    name: 'production',
    baseURL: process.env.NEXT_PUBLIC_API_URL!,
    enableMock: false,
    timeout: 15000,
    retryAttempts: 3,
    healthCheckPath: '/health'
  }
};

// 渐进式切换配置
export const GRADUAL_MIGRATION_CONFIG = {
  auth: { useReal: true },        // 已切换到真实API
  farming: { useReal: false },    // 仍使用Mock API
  processing: { useReal: false },
  logistics: { useReal: false },
  admin: { useReal: false },
  ai: { useReal: true }           // AI分析已切换
};
```

### 3. 自动化切换脚本架构
```bash
#!/bin/bash
# scripts/deployment/api-switch.sh

# API切换主脚本
function switch_api_environment() {
  local TARGET_ENV=$1
  local MODULE=$2

  echo "🔄 开始切换 ${MODULE} 模块到 ${TARGET_ENV} 环境..."

  # 1. 备份当前配置
  backup_current_config

  # 2. 更新环境变量
  update_environment_variables $TARGET_ENV $MODULE

  # 3. 健康检查
  if ! health_check $TARGET_ENV; then
    echo "❌ 健康检查失败，执行回滚..."
    rollback_configuration
    exit 1
  fi

  # 4. 功能验证
  if ! functional_test $MODULE; then
    echo "❌ 功能测试失败，执行回滚..."
    rollback_configuration
    exit 1
  fi

  echo "✅ ${MODULE} 模块成功切换到 ${TARGET_ENV} 环境"
}

# 使用示例:
# ./api-switch.sh staging farming
# ./api-switch.sh production all
```

### 4. 文档维护自动化
```typescript
// scripts/docs/update-api-docs.ts
interface ApiDocumentationUpdater {
  updateMockApiStatus(): Promise<void>;
  validateDocumentationLinks(): Promise<boolean>;
  generateApiChangelog(): Promise<void>;
  synchronizeWithImplementation(): Promise<void>;
}

class AutomatedDocUpdater implements ApiDocumentationUpdater {
  async updateMockApiStatus() {
    // 扫描 web-app-next/src/app/api/ 目录
    const implementedApis = await this.scanImplementedApis();

    // 与 docs/api/*.md 对比
    const documentedApis = await this.parseDocumentedApis();

    // 生成状态报告
    await this.generateStatusReport(implementedApis, documentedApis);
  }

  async validateDocumentationLinks() {
    // 检查所有 markdown 文件中的链接有效性
    // 验证代码示例的语法正确性
    // 确认API端点的响应格式匹配
    return true;
  }
}
```

## 风险控制和应急预案

### 文档质量风险
- [ ] 内容审核: 每个文档完成后进行同行审核
- [ ] 版本控制: 文档变更使用Git进行版本管理
- [ ] 定期更新: 建立季度文档审核和更新机制
- [ ] 反馈收集: 建立用户反馈和问题报告渠道

### 技术兼容性风险
- [ ] 环境验证: 在多个环境中验证配置脚本的有效性
- [ ] 向后兼容: 确保新的配置不破坏现有功能
- [ ] 监控告警: 建立API切换过程的实时监控
- [ ] 快速回滚: 15分钟内完成问题配置的回滚

## 后续计划

### 与Phase-3任务衔接
- [ ] 为TASK-P3-020页面迁移提供完整API使用文档
- [ ] 支持TASK-P3-021核心页面迁移的API集成需求
- [ ] 协调后续真实API对接的技术验证工作

### 长期维护规划
- [ ] 建立API文档的持续集成更新机制
- [ ] 开发文档与代码同步性验证工具
- [ ] 制定团队API文档维护培训计划

---

**Done 标记**: 待完成
**任务总结**: 待完成后添加总结

<!-- 遵循 task-management-manual.mdc 规范完成 -->
