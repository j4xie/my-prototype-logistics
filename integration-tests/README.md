# 白垩纪食品溯源系统 - 前后端集成测试

本测试套件用于验证React Native前端与Node.js后端的完整集成功能。

## 🚀 快速开始

### 1. 安装依赖
```bash
cd integration-tests
npm install
```

### 2. 运行完整集成测试
```bash
npm run test
```

### 3. 查看测试报告
测试完成后会在 `reports/` 目录生成HTML和JSON格式的报告。

## 📋 测试覆盖范围

### ✅ 认证系统测试
- [x] 平台用户登录
- [x] 工厂用户登录  
- [x] 两阶段注册流程
- [x] Token刷新机制
- [x] 设备绑定功能
- [x] 无效凭据处理
- [x] 登出功能

### ✅ 权限系统测试
- [x] 8角色权限验证
- [x] 跨工厂数据隔离
- [x] 权限升级防护
- [x] 权限继承机制
- [x] 动态权限更新
- [x] 特殊权限场景

### 🚧 计划中的测试
- [ ] 业务功能测试（加工、告警、报表）
- [ ] 数据同步测试（离线缓存、实时同步）
- [ ] 网络异常测试（网络中断、恢复）
- [ ] 性能测试（响应时间、内存使用）

## 🛠️ 命令参考

### 基础命令
```bash
# 运行完整测试套件
npm run test

# 只运行认证系统测试
npm run test:auth

# 只运行权限系统测试
npm run test:permission

# 快速测试（跳过环境准备）
npm run test:quick
```

### 环境管理
```bash
# 启动测试环境
npm run env:start

# 初始化测试数据
npm run data:init

# 清理报告文件
npm run clean
```

### 高级选项
```bash
# 跳过环境启动（假设环境已运行）
node run-integration-tests.js --skip-env

# 跳过数据初始化
node run-integration-tests.js --skip-data

# 详细日志输出
node run-integration-tests.js --verbose

# 只运行指定套件
node run-integration-tests.js --suite=auth
```

## 📊 测试报告

### HTML报告
- 位置: `reports/test-report-[timestamp].html`
- 包含: 详细的测试结果、性能指标、可视化图表

### JSON报告
- 位置: `reports/test-report-[timestamp].json`
- 包含: 原始测试数据，便于程序解析

### 控制台输出
- 实时显示测试进度
- 彩色输出，易于识别成功/失败
- 包含性能指标和统计信息

## 🔧 环境要求

### 必需服务
- **后端API**: localhost:3001 (自动启动)
- **MySQL数据库**: localhost:3306
- **React Native服务**: localhost:3010 (自动启动)

### Node.js版本
- 需要 Node.js 14.0.0 或更高版本

### 测试数据
- 自动创建测试工厂、用户、白名单等数据
- 测试完成后可选择清理数据

## 🚨 故障排除

### 常见问题

1. **端口占用**
   ```bash
   # 检查端口占用
   netstat -ano | findstr :3001
   netstat -ano | findstr :3010
   
   # 杀死占用进程
   npx kill-port 3001
   npx kill-port 3010
   ```

2. **MySQL连接失败**
   - 确认MySQL服务正在运行
   - 检查数据库连接配置
   - 验证用户权限

3. **依赖安装失败**
   ```bash
   # 清理并重新安装
   rm -rf node_modules
   npm install
   ```

4. **测试超时**
   - 检查网络连接
   - 增加超时时间配置
   - 确认服务响应正常

### 日志文件
- 环境启动日志: `reports/environment-logs-[timestamp].json`
- 测试执行日志: 控制台输出和HTML报告
- 错误详情: 包含在测试报告中

## 📝 贡献指南

### 添加新的测试用例
1. 在 `scenarios/` 目录创建测试文件
2. 继承基础测试类或遵循现有模式
3. 在主执行器中注册新的测试套件
4. 更新此README文档

### 测试数据管理
- 测试数据配置: `setup/test-config.js`
- 数据初始化: `setup/test-data-init.js`
- 避免硬编码，使用配置文件

### 代码规范
- 使用ES6模块语法
- 遵循现有的错误处理模式
- 添加适当的日志和报告信息
- 保持测试的独立性和可重复性

## 📞 支持

如有问题，请联系开发团队或提交Issue。

---

**版本**: 1.0.0  
**更新时间**: 2025-01-09  
**适用项目**: 白垩纪食品溯源系统