# 生产加工模块数据结构 - VS Code使用指南

> **目标**：在VS Code环境下，用多种格式的文档提供比纯Markdown更好的可视化和交互体验

## 📁 文件结构总览

```
docs/processing/
├── README-vscode-guide.md          # 本文件 - 使用指南
├── field-definitions.csv           # 🔥 字段定义表 (推荐)
├── template-schema.json           # 🔥 模板Schema定义 (推荐)
├── workflow-config.yaml           # 🔥 工作流配置 (推荐)
├── templates/
│   ├── meat-processing-template.json    # 肉类加工模板示例
│   ├── seafood-processing-template.json # 水产加工模板示例
│   └── grain-processing-template.json   # 粮食加工模板示例
└── 生产加工模块数据结构说明.md          # 汇总文档 (发布用)
```

## 🛠️ VS Code插件推荐

### ⭐⭐⭐⭐⭐ 必装插件

| 插件名称 | 用途 | 处理文件类型 |
|---------|------|-------------|
| **Excel Viewer** | 以表格形式查看CSV | `.csv` 字段定义 |
| **Edit csv** | 像Excel一样编辑表格 | `.csv` 数据修改 |
| **Rainbow CSV** | CSV语法高亮+列对齐 | `.csv` 可读性增强 |

### ⭐⭐⭐⭐ 强烈推荐

| 插件名称 | 用途 | 处理文件类型 |
|---------|------|-------------|
| **JSON Editor** | 可视化JSON编辑 | `.json` 模板定义 |
| **YAML Language Support** | YAML语法高亮+校验 | `.yaml` 工作流配置 |
| **Markdown Preview Mermaid Support** | 图表预览 | `.md` 中的Mermaid图 |

### ⭐⭐⭐ 锦上添花

| 插件名称 | 用途 | 处理文件类型 |
|---------|------|-------------|
| **JSON Schema Store** | JSON自动补全 | `.json` 编辑体验 |
| **Table Editor** | 可视化表格编辑 | Markdown表格 |

## 🎯 不同场景的最佳文件选择

### 👀 **查看字段结构** → 使用 `field-definitions.csv`

**为什么比Markdown表格更好**：
- ✅ Excel样式表格，一目了然
- ✅ 可以快速排序、筛选
- ✅ 支持冻结列标题
- ✅ 可导出给非技术同事

**使用方法**：
1. 安装 `Excel Viewer` 插件
2. 直接点击 `field-definitions.csv`
3. VS Code会自动以表格模式打开

**高级用法**：
```bash
# 筛选特定表的字段
按表名列筛选: production_batches

# 查看所有JSON类型字段
按数据类型列筛选: JSON

# 查看必填字段
按是否必填列筛选: 是
```

### ⚙️ **配置动态字段** → 使用 `template-schema.json`

**为什么比YAML更适合**：
- ✅ VS Code原生支持JSON编辑
- ✅ 实时语法校验和错误提示
- ✅ 智能代码补全
- ✅ 可以直接复制到代码中使用

**使用方法**：
1. 打开 `template-schema.json`
2. 修改 `rawMaterialFields` 等章节
3. 保存时自动校验JSON格式

**实际配置示例**：
```json
// 新增一个水产加工的字段
"catchMethod": {
  "title": "捕捞方式",
  "type": "enum",
  "enum": ["野生捕捞", "人工养殖"],
  "required": true,
  "category": "basic"
}
```

### 🔄 **定义业务流程** → 使用 `workflow-config.yaml`

**为什么选择YAML**：
- ✅ 层级结构清晰，适合复杂配置
- ✅ 注释支持，便于说明业务逻辑
- ✅ 比JSON更易读，比XML更简洁

**使用方法**：
1. 安装 `YAML Language Support` 插件
2. 编辑状态转换、权限控制等配置
3. 实时语法检查和格式美化

### 📊 **汇总展示** → 使用 `生产加工模块数据结构说明.md`

**适用场景**：
- ✅ 向客户/领导展示方案
- ✅ 发布到文档网站
- ✅ 项目交付文档

## 🚀 实际操作演示

### 场景1：产品经理要查看所有字段定义

```bash
# 传统方式 - 阅读Markdown表格 😰
问题：表格太长，需要上下滚动
解决：field-definitions.csv + Excel Viewer 😍

步骤：
1. 点击 field-definitions.csv
2. 自动以表格形式打开
3. 可以按表名筛选：raw_material_inbound
4. 一屏看完所有字段
```

### 场景2：前端开发需要了解表单验证规则

```bash
# 传统方式 - 猜测JSON结构 😰
问题：不知道字段类型、枚举值、校验规则
解决：template-schema.json + JSON Editor 😍

步骤：
1. 打开 templates/meat-processing-template.json
2. 查看 rawMaterialFields.breed.enum 获取枚举值
3. 查看 required 了解必填字段
4. 直接复制JSON结构到前端代码
```

### 场景3：后端开发需要实现状态机

```bash
# 传统方式 - 文档和代码不一致 😰
问题：业务逻辑变更，文档更新不及时
解决：workflow-config.yaml 作为权威配置 😍

步骤：
1. 打开 workflow-config.yaml
2. 查看 state_transitions 配置
3. 直接解析YAML文件生成状态机代码
4. 保证文档和代码一致性
```

## 🔗 协作工作流建议

### 开发阶段工作流

```mermaid
graph LR
    A[需求分析] --> B[编辑CSV定义字段]
    B --> C[配置JSON模板]
    C --> D[定义YAML工作流]
    D --> E[代码开发]
    E --> F[生成MD汇总文档]
    F --> G[交付]

    style B fill:#e1f5fe
    style C fill:#e8f5e8
    style D fill:#fff3e0
```

### 文件维护责任

| 文件类型 | 维护人员 | 更新频率 | 同步要求 |
|---------|----------|----------|----------|
| **CSV字段定义** | 架构师+DBA | 需求变更时 | 立即同步到代码 |
| **JSON模板** | 前端+后端 | 业务规则变更时 | 立即更新对应业务模块 |
| **YAML工作流** | 产品经理+后端 | 流程调整时 | 同步到状态机代码 |
| **MD汇总文档** | 产品经理 | 版本发布时 | 自动从其他文件生成 |

## 💡 进阶使用技巧

### 1. 自动化脚本

```bash
# 从CSV生成SQL建表语句
node scripts/csv-to-sql.js docs/processing/field-definitions.csv

# 从JSON模板生成前端表单组件
node scripts/json-to-form.js docs/processing/templates/

# 从YAML配置生成状态机代码
node scripts/yaml-to-state-machine.js docs/processing/workflow-config.yaml
```

### 2. 版本控制最佳实践

```bash
# 结构化文件的Git提交规范
git add docs/processing/field-definitions.csv
git commit -m "feat(processing): 新增水产加工温度字段"

git add docs/processing/templates/seafood-processing-template.json
git commit -m "config(processing): 更新水产加工质检标准"
```

### 3. 团队协作建议

- **CSV字段定义**：使用Git分支管理，避免冲突
- **JSON模板**：按行业分离文件，并行开发
- **YAML工作流**：分阶段配置，逐步完善

## 🆚 对比总结：VS Code结构化方案 vs 纯Markdown

| 维度 | 纯Markdown方案 | VS Code结构化方案 |
|------|---------------|------------------|
| **阅读体验** | 😰 需要上下滚动查看长表格 | 😍 Excel样式表格，一屏看全 |
| **编辑效率** | 😰 手动对齐表格，容易出错 | 😍 表格编辑器，像Excel一样 |
| **类型安全** | 😰 字段类型全靠注释说明 | 😍 JSON Schema自动校验 |
| **代码集成** | 😰 需要手动转换成代码 | 😍 直接解析JSON/YAML配置 |
| **团队协作** | 😰 格式冲突，难以merge | 😍 结构化数据，冲突少 |
| **维护成本** | 😰 文档和代码容易不一致 | 😍 配置即文档，强制同步 |

---

## 🎯 总结

通过这套VS Code结构化文档方案，我们实现了：

1. **更好的可视化**：CSV表格 > Markdown表格
2. **更强的类型安全**：JSON Schema > 文档注释
3. **更高的开发效率**：配置文件 > 手工编码
4. **更强的一致性**：单一数据源 > 多处维护

这样，您在VS Code中就能获得接近于专业数据库设计工具的体验，同时保持了纯文本文件的版本控制友好性。
