# 食品溯源系统原型

基于MCP服务的物流原型系统，使用GitHub Actions实现自动部署。

## 部署信息

项目已部署到Surge平台：
- 网址：https://food-trace-prototype.surge.sh
- 支持通过GitHub Actions自动部署

## 自动部署说明

本项目使用GitHub Actions自动部署：

### GitHub Actions自动部署

当你将代码推送到GitHub仓库时，GitHub Actions会自动部署到Surge。

设置步骤：
1. 将代码推送到GitHub仓库
2. 在仓库设置中添加Secret: `SURGE_TOKEN`
3. 每次推送到main分支时会自动部署

已配置的工作流程：
- `.github/workflows/deploy.yml` - 用于自动部署到Surge

工作流程说明：
- 触发条件：推送到main分支
- 执行步骤：
  1. 检出代码
  2. 设置Node.js环境
  3. 安装依赖
  4. 构建CSS（npm run build:css）
  5. 使用Surge部署（使用SURGE_TOKEN密钥）

### Surge部署服务

Surge是一个静态网站托管平台，提供简单的命令行部署功能：

```bash
# 安装Surge命令行工具
npm install -g surge

# 获取Surge Token
surge token

# 手动部署网站
surge ./ food-trace-prototype.surge.sh
```

项目已配置部署脚本：
```bash
# 完整部署（包含CSS构建）
npm run deploy

# 简单部署（不构建CSS）
npm run deploy:simple
```

### 备选方案：Netlify自动部署

如果需要更强大的托管服务，可以使用Netlify：

1. 注册Netlify账户
2. 连接GitHub仓库
3. 设置构建命令: `npm run build:css`
4. 设置发布目录: `./`

## 本地开发

```bash
# 安装依赖
npm install

# 启动本地开发服务器
npm start

# 手动部署
npm run deploy
```

## MCP服务配置说明

本项目使用多个MCP（Model Control Protocol）服务来提供各种AI增强功能。以下是每个服务的配置和使用说明：

### 1. Neon数据库服务

用于处理应用的数据存储需求，提供PostgreSQL兼容的云数据库服务。

**配置要求：**
- Neon账户和项目
- 有效的API密钥
- 数据库连接字符串

**已配置信息：**
- 数据库连接字符串：已在.env文件中配置
- 连接信息：
  - 主机：ep-frosty-hill-a1h70bse-pooler.ap-southeast-1.aws.neon.tech
  - 数据库：neondb
  - 用户：neondb_owner

**API密钥示例：**
```json
{
  "enabled": true,
  "commandToRun": [
    "npx",
    "@neondatabase/mcp@latest",
    "--neon-api-key",
    "0sJhQZK2VDBqAaaaaBBBccCCddDDeeEE"
  ]
}
```

**连接字符串示例：**
```
postgresql://neondb_owner:abcdefg123456@ep-frosty-hill-a1h70bse-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

**使用功能：**
- 创建和管理数据库项目
- 执行SQL查询
- 管理数据库分支
- 描述表结构
- 获取连接字符串
- 执行数据库迁移

**设置方法：**
1. 注册/登录 [Neon数据库](https://neon.tech)
2. 创建新项目
3. 在项目设置中获取API密钥
4. 更新mcp.json中的API密钥

### 2. Magic MCP

提供AI增强功能，尤其是UI组件生成和Logo搜索能力。

**配置要求：**
- 21st-dev平台账户
- 有效的API密钥

**API密钥示例：**
```json
{
  "enabled": true,
  "commandToRun": [
    "npx",
    "@21stio/magic-mcp@latest",
    "start",
    "--api-key",
    "21st_xxxx1234abcd5678efgh"
  ]
}
```

**主要功能：**
- 生成React UI组件（/ui或/21命令）
- 搜索和提供品牌Logo（/logo命令）
- 以JSX、TSX或SVG格式返回组件

**使用场景：**
- 快速构建UI界面
- 添加品牌标识
- 创建自定义组件

**设置方法：**
1. 注册/登录21st-dev平台
2. 创建新项目/应用
3. 生成API密钥
4. 更新mcp.json中的API密钥

### 3. Browser Tools MCP

允许AI助手与浏览器交互，提供浏览器调试和分析功能。

**配置要求：**
- Node.js环境

**配置示例：**
```json
{
  "enabled": true,
  "commandToRun": [
    "npx",
    "@agentdeskai/browser-tools-mcp@1.16.2"
  ]
}
```

**主要功能：**
- 获取控制台日志和错误
- 捕获网络请求和错误
- 截取屏幕
- 运行各种审计（可访问性、性能、SEO等）
- 调试模式

**使用场景：**
- 调试网页问题
- 分析网站性能
- 检查UI问题
- 优化网站访问体验

**设置步骤：**
1. 安装依赖：`npm install -g @agentdeskai/browser-tools-mcp`

### 4. Sequential Thinking MCP

提供结构化思考和问题解决功能，适用于复杂任务分析。

**配置示例：**
```json
{
  "enabled": true,
  "commandToRun": [
    "npx",
    "@mcp.cx/sequential-thinking-mcp@latest"
  ]
}
```

**主要功能：**
- 将复杂问题分解为步骤
- 支持思考过程的修改和分支
- 生成和验证解决方案假设
- 维护多步骤解决方案的上下文

**使用场景：**
- 复杂问题分析
- 多步骤规划
- 需要修正的思考过程
- 需要深入理解的分析任务

### 5. Playwright MCP

提供强大的浏览器自动化功能，实现网页交互和测试。

**配置示例：**
```json
{
  "enabled": true,
  "commandToRun": [
    "npx",
    "@playwright/mcp@latest"
  ]
}
```

**主要功能：**
- 导航到URL
- 页面截图和快照
- 点击和悬停等交互操作
- 上传文件
- 前进和后退导航

**使用场景：**
- 自动化网站测试
- 模拟用户交互
- 网页内容抓取
- 监控网站变化

**设置步骤：**
1. 安装Playwright：`npm install -g @playwright/mcp`

### 6. Figma API工具

与Figma设计文件集成，实现设计到代码的转换。

**配置要求：**
- Figma账户
- 个人访问令牌
- 设计文件ID

**API令牌示例：**
```
figd_aBcD1234EfGh5678IjKl9012MnOp3456QrSt7890UvWx1234YzAb5678CdEf9012
```

**环境变量配置示例：**
```bash
# .env文件
FIGMA_ACCESS_TOKEN=figd_aBcD1234EfGh5678IjKl9012MnOp3456QrSt7890UvWx1234YzAb5678CdEf9012
FIGMA_FILE_ID=abcDEF123456
```

**主要功能：**
- 访问Figma设计文件
- 导出设计资源
- 查看设计规范

**设置步骤：**
1. 登录Figma账户
2. 生成个人访问令牌（Account Settings > Personal Access Tokens）
3. 获取设计文件ID（URL中的值）
4. 设置环境变量

## 完整MCP配置文件示例

以下是包含所有MCP服务的完整`mcp.json`配置文件示例：

```json
{
  "neonMcp": {
    "enabled": true,
    "commandToRun": [
      "npx",
      "@neondatabase/mcp@latest",
      "--neon-api-key",
      "0sJhQZK2VDBqAaaaaBBBccCCddDDeeEE"
    ]
  },
  "magicMcp": {
    "enabled": true,
    "commandToRun": [
      "npx",
      "@21stio/magic-mcp@latest",
      "start",
      "--api-key",
      "21st_xxxx1234abcd5678efgh"
    ]
  },
  "browserToolsMcp": {
    "enabled": true,
    "commandToRun": [
      "npx",
      "@agentdeskai/browser-tools-mcp@1.16.2"
    ]
  },
  "sequentialThinkingMcp": {
    "enabled": true,
    "commandToRun": [
      "npx",
      "@mcp.cx/sequential-thinking-mcp@latest"
    ]
  },
  "playwrightMcp": {
    "enabled": true,
    "commandToRun": [
      "npx",
      "@playwright/mcp@latest"
    ]
  }
}
```

## 自动启动MCP服务

项目包含自动启动脚本，可以在系统启动时自动运行所有MCP服务。

### 手动启动

1. 运行批处理文件：`start-mcp-services.bat`

或

2. 直接运行Node.js脚本：`node start-mcp-services.js`

### 设置自动启动

运行以下命令（需要管理员权限）：

```bash
node setup-autostart.js
```

这将创建一个Windows计划任务，在用户登录时自动启动所有MCP服务。

### 日志

所有服务的日志文件保存在`logs`目录中：
- `browser-tools.log` - 浏览器工具MCP日志
- `magic-mcp.log` - Magic MCP日志
- `neon-mcp.log` - Neon数据库MCP日志
- `sequential-thinking.log` - 顺序思考MCP日志
- `playwright-mcp.log` - Playwright MCP日志

## 如何启动应用

1. 确保MCP服务已启动（手动或自动）
2. 运行 `npm start` 启动开发服务器
3. 访问 http://localhost:3000 打开应用 

## 原型系统功能模块

该原型系统包含以下主要功能模块：

### 登录与功能选择
- 用户登录界面
- 功能模块选择器（溯源管理不同环节的功能选择）

### 养殖管理模块
- 养殖场基本信息管理
- 溯源记录创建
- 疫苗接种记录
- 繁育信息管理
- 场地视频监控

### 生产加工模块
- 加工厂信息管理
- 溯源记录编辑
- 质检报告查询
- 肉质等级评定（符合国家标准GB/T 17238-2008）
- 加工过程拍照记录

### 销售物流模块
- 物流信息管理
- 溯源地图展示（产品全生命周期地理位置展示）

### 通用功能
- 溯源列表查询
- 溯源详情展示
- 溯源证书生成
- 系统设置
- 个人中心
- 溯源模板配置器
- 帮助中心

### PC端管理控制台
- 管理员仪表盘
- 数据批量导入功能
- 用户权限管理
- 系统日志查询

## 项目技术栈

- **前端**: HTML5, CSS3, JavaScript
- **样式**: TailwindCSS
- **图表**: Chart.js
- **地图**: Leaflet
- **工具**: Axios, QRCode
- **构建工具**: PostCSS, Autoprefixer
- **开发服务器**: Browser-Sync
- **部署**: Surge, GitHub Actions
- **AI增强**: MCP服务（Magic MCP, Browser Tools MCP, Sequential Thinking MCP, Playwright MCP, Neon MCP） 