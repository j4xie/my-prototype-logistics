# My Prototype Logistics

基于MCP服务的物流原型系统。

## MCP服务配置说明

本项目使用多个MCP服务来提供各种功能。以下是每个服务的配置和使用说明：

### 1. Neon数据库服务

用于处理应用的数据存储需求。

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

要获取这些信息：
1. 注册/登录 [Neon数据库](https://neon.tech)
2. 创建新项目
3. 在项目设置中获取API密钥
4. 更新mcp.json中的API密钥

### 2. Magic MCP

提供AI增强功能。

**配置要求：**
- 21st-dev平台账户
- 有效的API密钥

要获取这些信息：
1. 注册/登录21st-dev平台
2. 创建新项目/应用
3. 生成API密钥
4. 更新mcp.json中的API密钥

### 3. Browser Tools MCP

允许AI助手与浏览器交互。

**配置要求：**
- Node.js环境

设置步骤：
1. 安装依赖：`npm install -g @agentdeskai/browser-tools-mcp`

### 4. Figma API工具

与Figma设计文件集成。

**配置要求：**
- Figma账户
- 个人访问令牌
- 设计文件ID

设置步骤：
1. 登录Figma账户
2. 生成个人访问令牌（Account Settings > Personal Access Tokens）
3. 获取设计文件ID（URL中的值）
4. 设置环境变量

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

## 如何启动应用

1. 确保MCP服务已启动（手动或自动）
2. 运行 `node service-worker.js` 启动应用服务
3. 访问 http://localhost:3000 打开应用 