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
- WSL（Windows Subsystem for Linux）
- Node.js环境

设置步骤：
1. 确保WSL已安装：`wsl --install`
2. 安装依赖：`npm install -g @agentdeskai/browser-tools-mcp`

### 4. Figma Context MCP

与Figma设计文件集成。

**配置要求：**
- Figma账户
- 个人访问令牌
- 设计文件ID

设置步骤：
1. 登录Figma账户
2. 生成个人访问令牌（Account Settings > Personal Access Tokens）
3. 获取设计文件ID（URL中的值）
4. 设置环境变量：
   ```
   FIGMA_TOKEN=你的访问令牌
   FIGMA_FILE_ID=你的文件ID
   ```

## 如何启动

1. 确保已安装所有依赖
2. 运行 `node service-worker.js` 启动服务
3. 访问 http://localhost:3000 打开应用 