# Day 6 配置清理指南

## 概述
本文档提供TASK-P3-018B Day 6完成后的配置清理指导，帮助开发者迁移到统一Mock架构。

## 已弃用的环境变量

### 需要移除的变量
```bash
# 旧的Mock配置 - 已弃用
NEXT_PUBLIC_MOCK_API=true
MOCK_DATA_SOURCE=local
ENABLE_MOCK_DELAY=true
MOCK_DELAY_MIN=100
MOCK_DELAY_MAX=600

# 旧的API配置 - 需要更新
API_HOST=localhost:3000
BASE_URL=http://localhost:3000
```

### 推荐的新配置
```bash
# 新的统一Mock配置
NEXT_PUBLIC_MOCK_ENABLED=false
NEXT_PUBLIC_MOCK_ENVIRONMENT=development
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api

# 应用配置
NEXT_PUBLIC_APP_NAME=食品溯源系统
NEXT_PUBLIC_APP_VERSION=3.0.0
NEXT_PUBLIC_APP_ENV=development
```

## 迁移检查清单

### 环境文件检查
- [ ] 检查 `.env.local` 是否包含弃用变量
- [ ] 更新 `.env.example` 为新的配置格式
- [ ] 验证 `next.config.ts` 中的环境变量引用
- [ ] 检查 CI/CD 配置文件中的环境变量

### 代码文件检查
- [ ] 搜索代码中的 `NEXT_PUBLIC_MOCK_API` 引用
- [ ] 替换 `MOCK_DATA_SOURCE` 为新的配置方式
- [ ] 更新 `process.env.BASE_URL` 为 `NEXT_PUBLIC_API_BASE_URL`
- [ ] 验证所有API客户端配置

### 配置文件更新
- [ ] 更新 `src/lib/constants.ts` 中的环境变量引用
- [ ] 检查 `src/config/app.ts` 配置
- [ ] 验证测试配置文件 `tests/setup.ts`

## 常见问题 (FAQ)

### Q: 为什么要移除 NEXT_PUBLIC_MOCK_API？
A: 新架构使用 `NEXT_PUBLIC_MOCK_ENABLED` 提供更精确的控制，支持环境级别的Mock配置。

### Q: BASE_URL 和 NEXT_PUBLIC_API_BASE_URL 有什么区别？
A: `NEXT_PUBLIC_API_BASE_URL` 是客户端可访问的环境变量，遵循Next.js规范，而 `BASE_URL` 是旧的非标准命名。

### Q: 如何验证配置迁移是否成功？
A: 运行 `npm run env:validate` 命令检查环境配置，或使用 `npm run mock:status` 查看Mock服务状态。

## 自动化工具

### 环境配置验证
```bash
# 检查当前环境配置
npm run env:status

# 应用推荐配置
npm run env:apply development

# 验证配置有效性
npm run env:validate
```

### 配置迁移助手
```bash
# 扫描弃用配置
npm run config:scan

# 自动修复常见问题
npm run config:fix

# 生成新的配置模板
npm run config:generate
```

## 迁移后验证

### 功能验证
1. 启动开发服务器: `npm run dev`
2. 检查Mock服务状态: 访问 `/api/health`
3. 验证API响应: 测试主要业务接口
4. 检查控制台错误: 确保无配置相关错误

### 性能验证
1. 检查Mock响应延迟是否合理
2. 验证开发环境启动速度
3. 确认热重载功能正常
4. 测试构建过程无错误

---

**更新日期**: 2025-02-02
**适用版本**: TASK-P3-018B Day 6+
**维护者**: Phase-3技术团队
