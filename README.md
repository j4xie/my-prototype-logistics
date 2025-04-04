# 食品溯源系统

一个基于网页的食品溯源系统，用于跟踪农产品从农场到餐桌的整个过程。

## 目录结构

```
.
├── assets/                # 静态资源文件
├── pages/                 # 各个功能页面
├── scripts/               # 实用工具脚本
│   ├── git/               # Git操作快捷脚本
│   ├── debug/             # 调试工具脚本
│   └── validation/        # 验证脚本迁移工具
├── validation/            # 验证测试
│   ├── scripts/           # 验证脚本
│   ├── reports/           # 验证报告
│   └── screenshots/       # 测试截图
└── tests/                 # 单元测试和集成测试
```

## 功能特点

- 产品信息录入与管理
- 二维码生成与扫描
- 物流轨迹追踪
- 产品溯源查询
- 质量检测报告
- 数据统计与分析

## 开发指南

### 环境设置

1. 克隆仓库：

```bash
git clone https://github.com/yourusername/food-traceability-system.git
cd food-traceability-system
```

2. 安装依赖：

```bash
npm install
```

3. 设置脚本环境：

```bash
npm run setup:all
```

这将设置以下环境：
- 验证脚本环境 (`npm run setup:validation`)
- Git脚本别名 (`npm run setup:git`)
- 调试工具脚本 (`npm run setup:debug`)

### 启动开发服务器

```bash
npm run start
```

服务器将启动在以下地址：
- 本地访问：http://localhost:3000, http://localhost:8080 或 http://localhost:8081 (根据端口占用情况)
- 本地UI：http://localhost:3001, http://localhost:3002 或 http://localhost:3003 (根据端口占用情况)

系统使用browser-sync启动服务器，会自动监控文件变化并刷新浏览器。

### 运行测试

```bash
# 运行所有测试
npm test

# 仅运行单元测试
npm run test:unit

# 仅运行集成测试
npm run test:integration

# 按钮改进验证测试
npm run validate:buttons
```

如需一次性启动服务器并运行所有按钮测试，可以使用：

```bash
npm run start && npm run validate:buttons
```

测试报告将保存在：
- JSON报告：validation/reports/button_improvements_report.json
- HTML报告：validation/reports/button_improvements_report.html 

### 运行验证测试

```bash
# 运行所有验证测试
npm run validate

# 仅验证按钮功能
npm run validate:buttons

# 仅验证页面功能
npm run validate:functionality

# 仅验证页面导航
npm run validate:navigation

# 仅验证资源加载
npm run validate:resources

# 仅验证UI
npm run validate:ui
```

### 使用Git快捷脚本

设置Git脚本别名后，您可以使用以下命令：

```bash
# 在PowerShell中使用
.\scripts\setup-git-scripts.ps1

# 然后使用如下命令
g status        # 查看Git状态
g a             # 添加所有文件
g c "提交信息"   # 提交更改
g p             # 推送到远程
g pull          # 拉取更新
g b             # 查看分支
g co 分支名      # 切换分支
g cob 新分支名   # 创建并切换到新分支
g l             # 查看提交日志

# 或者使用快速提交命令
gitpush "提交信息"   # 添加、提交并推送
gp "提交信息"        # 同上，简写版本
```

### 使用调试工具脚本

设置调试工具别名后，您可以使用以下命令：

```bash
# 在PowerShell中使用
.\scripts\setup-debug-tools.ps1

# 然后使用如下命令
debug           # 启动默认调试
debug-chrome    # 使用Chrome启动调试
debug-edge      # 使用Edge启动调试
```

## 按钮标准规范

所有按钮必须符合以下标准：

### 1. 唯一ID

每个按钮必须有唯一的ID属性，以便于测试和访问。

```html
<button id="unique-button-id">按钮文本</button>
```

### 2. 无障碍属性

按钮必须包含适当的无障碍属性，包括：
- `aria-label`：为屏幕阅读器提供描述
- `tabindex="0"`：确保按钮可以通过键盘访问

```html
<button id="submit-btn" aria-label="提交表单" tabindex="0">提交</button>
```

### 3. 视觉反馈

按钮必须提供视觉反馈，包括：
- 悬停状态（:hover）
- 聚焦状态（:focus）
- 点击状态（:active）

所有CSS样式已在`assets/css/trace-components.css`中定义：

```css
.btn:hover {
  background-color: #0056b3;
  transform: translateY(-1px);
}

.btn:focus {
  outline: 2px solid #0070f3;
  outline-offset: 2px;
}

.btn:active {
  transform: translateY(1px);
}
```

### 4. 按钮验证

使用以下命令验证按钮是否符合上述所有标准：

```bash
npm run validate:buttons
```

验证脚本将检查所有页面上的按钮，并生成详细报告。

## 部署

```bash
npm run deploy
```

这将构建CSS并将应用部署到Surge.sh。

## 验证脚本标准化

项目中的验证脚本已标准化，以提供一致的接口和错误处理。每个验证脚本都有以下标准结构：

```javascript
// 标准化配置对象
const config = {
  baseUrl: 'http://localhost:3000',
  screenshotsDir: 'validation/screenshots',
  reportPath: 'validation/reports/xxx_report.json',
  // 其他配置...
};

// 主要验证功能
async function run() {
  // 验证逻辑
  return {
    status: 'success', // 或 'failed'
    // 其他结果数据...
  };
}

// 导出接口
module.exports = { run };
```

### 迁移验证脚本

如果您有旧格式的验证脚本需要迁移到新的标准化格式，可以使用：

```bash
npm run validate:migrate
```

## 贡献指南

1. Fork 仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m '添加了一些令人惊叹的功能'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建一个 Pull Request

## 许可证

本项目采用 ISC 许可证 - 详情见 LICENSE 文件。 