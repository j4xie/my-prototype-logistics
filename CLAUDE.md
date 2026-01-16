# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**白垩纪食品溯源系统 (Cretas Food Traceability System)**

| 组件 | 技术栈 |
|------|--------|
| **后端** | Java 11 + Spring Boot 2.7.15 + MySQL + JPA |
| **前端** | Expo 53+ + TypeScript + React Navigation 7+ |
| **AI服务** | Python + LLM API |

**项目状态**: Phase 3 核心完成 (82-85%)

---

## Quick Reference

### 端口配置

| Service | Port | URL |
|---------|------|-----|
| React Native | 3010 | `http://localhost:3010` |
| Spring Boot | 10010 | `http://139.196.165.140:10010` |
| MySQL | 3306 | `localhost:3306` |

### 测试账号
- **Admin**: `admin` / `Admin@123456`

---

## Development Commands

### 前端 (React Native)
```bash
cd frontend/CretasFoodTrace
npm start                    # Start Expo
npx expo start --clear      # Clear cache
```

### 后端 (Spring Boot)
```bash
cd backend-java
mvn clean package -DskipTests    # Build
mvn spring-boot:run              # Run locally
```

### 部署到服务器
```bash
scp target/*.jar root@139.196.165.140:/www/wwwroot/cretas/
ssh root@139.196.165.140 "bash /www/wwwroot/cretas/restart.sh"
```

---

## Architecture

### 后端结构
```
backend-java/src/main/java/com/cretas/aims/
├── controller/    # REST API
├── entity/        # JPA 实体
├── service/       # 业务逻辑
├── repository/    # 数据访问
├── dto/           # 数据传输对象
└── config/        # 配置类
```

### 前端结构
```
frontend/CretasFoodTrace/src/
├── screens/       # 页面组件
├── components/    # UI 组件
├── services/api/  # API 客户端
├── store/         # Zustand 状态
├── navigation/    # 路由配置
└── types/         # TypeScript 类型
```

### API 路径
- 基础路径: `/api/mobile/*`
- 认证: `/api/mobile/auth/*`
- 业务: `/api/mobile/{factoryId}/*`

---

## Key Patterns

### 代码质量原则
详见 `.claude/rules/` 目录下的规范文件：
- `api-response-handling.md` - API 响应处理
- `typescript-type-safety.md` - TypeScript 类型安全
- `jwt-token-handling.md` - JWT Token 处理
- `database-entity-sync.md` - 数据库同步
- `field-naming-convention.md` - 字段命名

### 核心原则
1. **禁止降级处理** - 不返回假数据，明确显示错误
2. **类型安全** - 避免 `as any`，使用明确类型
3. **统一响应格式** - `{ success, data, message }`

---

## Documentation

- [PRD-功能与文件映射-v3.0.md](./docs/prd/PRD-功能与文件映射-v3.0.md)
- [PRD-完整业务流程与界面设计-v5.0.md](./docs/prd/PRD-完整业务流程与界面设计-v5.0.md)
- [QUICK_START.md](./QUICK_START.md)

---

## Troubleshooting

### 健康检查
```bash
curl http://localhost:10010/api/mobile/health
lsof -i :10010
```

### 缓存问题
```bash
npx expo start --clear
rm -rf node_modules && npm install
```
