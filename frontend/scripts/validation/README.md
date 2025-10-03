# 验证脚本目录结构说明

本目录包含项目的所有验证脚本，按照**基于任务ID的组织原则**进行管理。

## 🎯 组织原则

### 核心理念
- **任务导向**: 每个验证脚本都明确关联到具体的任务ID
- **可追溯性**: 从验证脚本名称就能直接知道验证的任务
- **职责明确**: 避免验证脚本职责重叠和冲突
- **统一标准**: 所有验证脚本遵循相同的模板和规范

### 符合Cursor Rule
本组织结构严格遵循 `.cursor/rules/test-validation-standards-agent.mdc` 规范。

## 📁 目录结构

```
scripts/validation/
├── task-p2-001/                           # TASK-P2-001 移动端UI适配
│   ├── mobile-adaptation-validation.js    # 移动端适配功能验证
│   ├── performance-validation.js          # 性能指标验证
│   ├── accessibility-validation.js        # 可访问性验证
│   ├── comprehensive-validation.js        # 综合验证（统筹所有子验证）
│   └── reports/                           # 该任务的验证报告
│       ├── task-p2-001-mobile-adaptation-report.json
│       ├── task-p2-001-performance-report.json
│       ├── task-p2-001-accessibility-report.json
│       ├── task-p2-001-comprehensive-report.json
│       └── task-p2-001-status-summary.md   # 任务状态摘要
├── task-p2-002/                           # TASK-P2-002 UI组件梳理（待创建）
├── task-p3-001/                           # TASK-P3-001 React迁移（待创建）
├── common/                                # 通用工具和setup脚本
│   └── setup.ps1                         # PowerShell环境配置
└── README.md                              # 本说明文档
```

## 🚀 使用方法

### 运行单个验证
```bash
# 切换到任务目录
cd scripts/validation/task-p2-001

# 运行特定验证
node mobile-adaptation-validation.js
node performance-validation.js
node accessibility-validation.js
```

### 运行综合验证
```bash
# 运行任务的所有验证并生成综合报告
cd scripts/validation/task-p2-001
node comprehensive-validation.js
```

### 查看验证结果
```bash
# 查看任务状态摘要
cat scripts/validation/task-p2-001/reports/task-p2-001-status-summary.md

# 查看详细JSON报告
cat scripts/validation/task-p2-001/reports/task-p2-001-comprehensive-report.json
```

## 📊 验证脚本规范

### 文件命名规范
- 格式：`{验证类型}-validation.js`
- 示例：`mobile-adaptation-validation.js`、`performance-validation.js`

### 脚本内容标准
每个验证脚本必须包含：

```javascript
/**
 * TASK-{任务ID} {任务描述} - {验证类型}验证
 * 
 * @task TASK-P2-001
 * @module 移动端UI适配问题修复
 * @validation-type mobile-adaptation
 * @description 验证描述
 * @reports-to refactor/phase-2/progress-reports/
 */

// 验证脚本元数据
const VALIDATION_META = {
  taskId: 'TASK-P2-001',
  validationType: 'mobile-adaptation',
  module: '移动端UI适配问题修复',
  reportPath: 'refactor/phase-2/progress-reports/',
  version: '1.0.0'
};

// 验证配置
const VALIDATION_CONFIG = {
  name: 'TASK-P2-001-移动端适配验证',
  targetFiles: [...],
  checkpoints: [...],
  thresholds: {...}
};

// 必需函数
async function runValidation() { /* ... */ }
async function generateReport(results) { /* ... */ }

// 模块导出
module.exports = { runValidation, VALIDATION_CONFIG, VALIDATION_META };
```

### 报告命名规范
- 格式：`task-{任务ID}-{验证类型}-report.json`
- 示例：`task-p2-001-mobile-adaptation-report.json`

## 📈 当前状态

### TASK-P2-001 移动端UI适配问题修复
- **验证模块**: 3个（移动端适配、性能、可访问性）
- **当前状态**: IN_PROGRESS
- **整体得分**: 62%
- **验收就绪**: ❌ NO

#### 模块得分详情
- ✅ 移动端适配功能验证: 100%
- ❌ 性能指标验证: 60%
- ❌ 可访问性验证: 14%

#### 主要问题
1. 性能优化模式不完整
2. 可访问性ARIA属性缺失
3. 键盘导航支持不足

## 🔧 维护指南

### 添加新任务验证
1. 创建任务目录：`mkdir scripts/validation/task-p2-002`
2. 创建reports子目录：`mkdir scripts/validation/task-p2-002/reports`
3. 复制并修改现有验证脚本模板
4. 更新本README文档

### 添加新验证类型
1. 在相应任务目录下创建新的验证脚本
2. 按照标准模板编写验证逻辑
3. 在comprehensive-validation.js中添加新模块配置
4. 更新权重分配

### 规则合规性
所有验证脚本的创建和修改都应遵循：
- `.cursor/rules/test-validation-standards-agent.mdc`
- 任务导向的组织原则
- 统一的命名和结构规范

---
*文档更新时间: 2025-05-27*
*遵循规则: test-validation-standards-agent.mdc* 