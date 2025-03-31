# 食品溯源系统原型

基于MCP服务的物流原型系统，使用GitHub Actions实现自动部署。

## 部署信息

项目已部署到Surge平台：
- 网址：https://food-trace-prototype.surge.sh
- 支持通过GitHub Actions自动部署

## 开发工具脚本

### Git快速提交工具

使用`gitpush`命令可一键完成git提交操作：

```bash
# 使用方法
gitpush "提交说明信息"

# 例如
gitpush "修复登录页面bug"
```

此命令会自动执行以下操作：
1. 添加所有更改 (git add .)
2. 提交更改 (git commit -m "你的信息")
3. 推送到远程仓库 (git push)

### 部署脚本

```bash
# 完整部署（包含CSS构建）
npm run deploy

# 简单部署（不构建CSS）
npm run deploy:simple
```

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

## MCP服务简介

本项目使用多个MCP（Model Control Protocol）服务来提供各种AI增强功能：

1. **Neon数据库服务** - 提供PostgreSQL兼容的云数据库服务
2. **Magic MCP** - 提供UI组件生成和Logo搜索能力
3. **Browser Tools MCP** - 提供浏览器调试和分析功能
4. **Sequential Thinking MCP** - 提供结构化思考和问题解决功能
5. **Playwright MCP** - 提供浏览器自动化功能

## 自动启动MCP服务

项目包含自动启动脚本，可以在系统启动时自动运行所有MCP服务。

### 手动启动

运行批处理文件：`start-mcp-services.bat`

### 设置自动启动

运行以下命令（需要管理员权限）：

```bash
node setup-autostart.js
```

这将创建一个Windows计划任务，在用户登录时自动启动所有MCP服务。

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