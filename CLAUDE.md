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
| Cretas 后端 | 10010 | `http://139.196.165.140:10010` |
| Mall 后端 | 8080 | `http://139.196.165.140:8080` |
| MySQL | 3306 | `localhost:3306` |
| Redis | 6379 | `localhost:6379` |
| FRP | 7501 | 内网穿透 |

### 测试账号
| 角色 | 用户名 | 密码 | factoryId |
|------|--------|------|-----------|
| 工厂超级管理员 | `factory_admin1` | `123456` | F001 |
| 平台管理员 | `platform_admin` | `123456` | - |
| 车间主管 | `workshop_sup1` | `123456` | F001 |
| 仓储主管 | `warehouse_mgr1` | `123456` | F001 |
| HR 管理员 | `hr_admin1` | `123456` | F001 |
| 调度员 | `dispatcher1` | `123456` | F001 |
| 质检员 | `quality_insp1` | `123456` | F001 |

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
# 方式1: JAR 部署 (推荐，默认)
./deploy-backend.sh              # 本地打包 → GitHub Release → 服务器拉取

# 方式2: Git 部署 (旧方式)
./deploy-backend.sh --git        # git push → 服务器编译

# 或使用 skill
/deploy-backend
```

---

## Server Structure

### 服务器目录 (`/www/wwwroot/`)
```
/www/wwwroot/
├── cretas/              # Cretas 食品溯源系统
│   ├── aims-0.0.1-SNAPSHOT.jar  # 主 JAR
│   ├── pull-jar.sh      # 从 Release 拉取 JAR
│   ├── deploy.sh        # Git 部署脚本
│   ├── restart.sh       # 重启服务
│   ├── code/            # 完整代码仓库
│   └── logs/            # 日志目录
├── mall/                # 商城系统
│   ├── admin/           # 管理前端
│   ├── backend/         # 后端服务 (logistics-admin.jar)
│   └── data/            # 数据文件
├── showcase/            # 展示网站
│   └── cretaceousfuture/
└── web-admin/           # Web 管理前端
```

### 服务管理
```bash
# Mall 后端 (systemd 管理)
systemctl status mall-backend
systemctl restart mall-backend

# Cretas 后端 (脚本管理)
cd /www/wwwroot/cretas && bash restart.sh

# 查看日志
tail -f /www/wwwroot/cretas/cretas-backend.log
tail -f /www/wwwroot/mall/backend/mall-admin.log
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
- `server-operations.md` - 服务器运维规范
- `backend-deployment.md` - 后端自动化部署

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
