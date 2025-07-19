# API部署切换工具指南

<!-- 文档版本: v1.0.0 -->
<!-- 创建日期: 2025-02-02 -->
<!-- 适用版本: Phase-3 技术栈现代化 -->
<!-- 基础依赖: TASK-P3-019B (API文档同步与集成指南) -->

## 📋 工具概览

本目录包含Phase-3技术栈现代化中Mock API到真实API切换的完整工具集，确保安全可靠的环境切换和部署验证。

### 主要工具
- **`api-switch.sh`** - 核心API环境切换脚本
- **`health-check.sh`** - API健康状态检查工具 (计划)
- **`backup-restore.sh`** - 配置备份恢复工具 (计划)
- **`monitoring.sh`** - 实时监控工具 (计划)

## 🚀 快速开始

### 前置要求
```bash
# 确保安装必需工具
node --version  # >= 18.0.0
npm --version   # >= 8.0.0
curl --version  # 用于API连通性检查
```

### 环境准备
```bash
# 1. 创建必要的目录结构
mkdir -p logs/deployment
mkdir -p backups/api-config

# 2. 确保脚本有执行权限
chmod +x scripts/deployment/*.sh

# 3. 验证项目配置文件存在
ls web-app-next/src/config/api-*.ts
```

## 📖 api-switch.sh 使用指南

### 基本用法
```bash
# 语法
./scripts/deployment/api-switch.sh <environment> <module> [options]

# 查看帮助
./scripts/deployment/api-switch.sh --help

# 查看版本
./scripts/deployment/api-switch.sh --version

# 查看当前状态
./scripts/deployment/api-switch.sh --status
```

### 支持的环境
- **development** - 开发环境 (使用Mock API)
- **staging** - 测试环境 (真实API测试)
- **production** - 生产环境 (真实API)

### 支持的模块
基于TASK-P3-019A的69个API接口，按业务模块分组：

| 模块 | API数量 | 依赖关系 | 切换优先级 |
|------|---------|----------|------------|
| auth | 4个 | 无 | 高 (基础) |
| user | 18个 | auth | 高 (基础) |
| trace | 5个 | auth, user | 中 |
| farming | 9个 | auth, user | 中 (核心业务) |
| processing | 9个 | auth, user, farming | 中 (核心业务) |
| logistics | 9个 | auth, user, processing | 中 (核心业务) |
| admin | 8个 | auth, user | 低 (管理功能) |
| ai | 7个 | auth, user, farming, processing | 低 (高级功能) |

### 使用示例

#### 单模块切换
```bash
# 切换认证模块到测试环境
./scripts/deployment/api-switch.sh staging auth

# 强制切换农业模块到生产环境 (跳过确认)
./scripts/deployment/api-switch.sh production farming --force

# 预览切换步骤 (不执行实际操作)
./scripts/deployment/api-switch.sh staging processing --dry-run
```

#### 批量模块切换
```bash
# 切换所有模块到生产环境 (按依赖顺序)
./scripts/deployment/api-switch.sh production all

# 强制批量切换 (跳过所有确认)
./scripts/deployment/api-switch.sh production all --force
```

#### 回滚操作
```bash
# 回滚单个模块到Mock API
./scripts/deployment/api-switch.sh development auth --rollback

# 强制回滚所有模块
./scripts/deployment/api-switch.sh development all --rollback --force
```

## 🔧 配置说明

### 环境变量配置
脚本依赖以下环境变量：

```bash
# .env.local 或系统环境变量
NEXT_PUBLIC_API_URL=https://api.example.com              # 生产API地址
NEXT_PUBLIC_STAGING_API_URL=https://staging-api.example.com  # 测试API地址

# 可选配置
API_SECRET_KEY=your-api-secret                           # API密钥
DATABASE_URL=postgresql://user:pass@host:port/db        # 数据库连接
REDIS_URL=redis://host:port                              # Redis连接
```

### 项目配置文件
脚本会自动处理以下配置文件：

- `web-app-next/src/config/api-environment.ts` - API环境配置
- `web-app-next/src/config/api-migration.ts` - 模块迁移状态
- `.env.local` - 环境变量配置

## 📊 日志和报告

### 日志文件位置
```bash
logs/deployment/
├── api-switch-20250202-143025.log      # 主操作日志
├── api-switch-errors.log               # 错误日志
├── switch-report-auth-20250202-143025.json     # 单模块切换报告
└── batch-switch-report-20250202-143100.json    # 批量切换报告
```

### 报告格式
#### 单模块切换报告
```json
{
  "timestamp": "2025-02-02T14:30:25.000Z",
  "module": "auth",
  "action": "production",
  "status": "success",
  "environment": "production",
  "logFile": "/path/to/log/file",
  "backupLocation": "/path/to/backup",
  "nextSteps": [
    "监控模块 auth 的运行状态",
    "定期执行健康检查",
    "准备下一个模块的切换"
  ]
}
```

#### 批量切换报告
```json
{
  "timestamp": "2025-02-02T14:31:00.000Z",
  "environment": "production",
  "totalModules": 8,
  "successfulModules": {
    "count": 7,
    "modules": ["auth", "user", "trace", "farming", "processing", "logistics", "admin"]
  },
  "failedModules": {
    "count": 1,
    "modules": ["ai"]
  },
  "overallStatus": "partial_failure",
  "logFile": "/path/to/log/file",
  "recommendations": [
    "监控已切换模块的运行状态",
    "分析失败模块的问题原因",
    "制定失败模块的重试计划"
  ]
}
```

## 🔍 故障排除

### 常见问题

#### 1. 脚本权限问题
```bash
# 问题：Permission denied
# 解决：设置执行权限
chmod +x scripts/deployment/api-switch.sh
```

#### 2. 依赖工具缺失
```bash
# 问题：curl: command not found
# 解决：安装缺失工具
# macOS
brew install curl

# Ubuntu/Debian
sudo apt-get install curl

# CentOS/RHEL
sudo yum install curl
```

#### 3. API连通性检查失败
```bash
# 问题：API连通性检查失败
# 排查步骤：
1. 检查环境变量配置
echo $NEXT_PUBLIC_API_URL

2. 手动测试API连通性
curl -s https://api.example.com/health

3. 检查网络连接和防火墙设置
```

#### 4. 配置文件不存在
```bash
# 问题：配置文件不存在
# 解决：确保项目结构正确
ls web-app-next/src/config/
# 应该包含 api-environment.ts 和 api-migration.ts
```

### 回滚操作
如果切换过程中出现问题，可以使用以下方法回滚：

```bash
# 1. 使用脚本自动回滚
./scripts/deployment/api-switch.sh development module-name --rollback

# 2. 手动恢复配置
# 查看最新备份位置
cat backups/api-config/latest-backup.txt

# 手动恢复配置文件
cp backups/api-config/config-backup-timestamp/* web-app-next/src/config/
```

## 📚 最佳实践

### 切换前准备
1. **环境验证**
   ```bash
   # 验证目标环境API可用性
   curl -s https://api.example.com/health
   
   # 验证配置文件完整性
   node -e "console.log(require('./web-app-next/src/config/api-environment.ts'))"
   ```

2. **备份确认**
   ```bash
   # 确保自动备份功能正常
   ./scripts/deployment/api-switch.sh staging auth --dry-run
   ```

3. **团队协调**
   - 通知相关团队成员
   - 确保关键人员在线
   - 设定回滚时间窗口

### 切换过程中
1. **监控关键指标**
   - API响应时间
   - 错误率
   - 用户会话状态
   - 数据一致性

2. **渐进式切换**
   ```bash
   # 建议顺序：基础模块 → 核心业务 → 高级功能
   ./scripts/deployment/api-switch.sh production auth
   ./scripts/deployment/api-switch.sh production user
   ./scripts/deployment/api-switch.sh production farming
   # ... 继续其他模块
   ```

### 切换后验证
1. **功能验证**
   - 执行回归测试
   - 验证关键用户流程
   - 检查数据完整性

2. **性能验证**
   - 监控响应时间
   - 检查资源使用率
   - 验证负载处理能力

3. **用户体验验证**
   - 确认UI/UX无异常
   - 验证错误处理
   - 检查用户反馈

## 🔄 持续改进

### 脚本优化方向
1. **增强健康检查**
   - 添加更详细的API端点检查
   - 实施深度功能验证
   - 增加性能基准测试

2. **改进监控能力**
   - 集成APM工具
   - 添加实时告警
   - 提供可视化面板

3. **扩展自动化**
   - 自动依赖关系检查
   - 智能回滚决策
   - 集成CI/CD流水线

### 反馈和建议
如果在使用过程中遇到问题或有改进建议，请：

1. 查看日志文件获取详细信息
2. 检查报告文件了解操作结果
3. 参考故障排除指南
4. 联系开发团队寻求支持

---

**文档维护信息**
- **版本**: v1.0.0
- **创建日期**: 2025-02-02
- **最后更新**: 2025-02-02
- **下次审核**: 使用反馈收集后
- **负责人**: Phase-3 技术团队
- **审核状态**: ✅ 已完成初始版本 