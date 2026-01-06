# 白垩纪食品溯源系统 (Cretas)

**项目状态**: Phase 3 核心完成 (82-85%) | 优化中 🔨

---

## 🚀 快速开始

### 新开发者必读（按顺序）

1. **[QUICK_START.md](./QUICK_START.md)** - 5分钟快速开始
2. **[PROJECT_STRUCTURE_GUIDE.md](./PROJECT_STRUCTURE_GUIDE.md)** - 项目结构完整指南 ⭐
3. **[CLAUDE.md](./CLAUDE.md)** - 开发指南和代码规范

### 完整文档

📖 **[PROJECT_FULL_DOCUMENTATION.md](./PROJECT_FULL_DOCUMENTATION.md)** - 完整项目文档（1400+ 行）

---

## 技术栈

| 组件 | 技术 |
|------|------|
| **前端** | React Native (Expo 53+) + TypeScript |
| **后端** | Spring Boot 2.7.15 + Java 11 + MySQL |
| **AI** | Python + DeepSeek API |
| **部署** | 阿里云 139.196.165.140:10010 |

---

## 核心功能

✅ 原材料 FIFO 管理 - 新鲜/冻货智能区分
✅ 智能生产计划 - 自动预估原料
✅ 精准成本分析 - AI 优化建议
✅ 员工打卡系统 - GPS + 生物识别
✅ 8角色权限体系 - RBAC 权限控制

---

## 开发命令

```bash
# 前端
cd frontend/CretasFoodTrace
npm start

# 后端
cd backend-java
mvn spring-boot:run

# 部署
scp target/*.jar root@139.196.165.140:/www/wwwroot/cretas/
```

---

## 快速查找

- **API 端点**: [docs/prd/PRD-功能与文件映射-v3.0.md](./docs/prd/PRD-功能与文件映射-v3.0.md)
- **业务流程**: [docs/prd/PRD-完整业务流程与界面设计-v5.0.md](./docs/prd/PRD-完整业务流程与界面设计-v5.0.md)
- **权限速查**: [docs/prd/角色权限和页面访问速查表.md](./docs/prd/角色权限和页面访问速查表.md)

---

**项目文档版本**: v3.0 | **最后更新**: 2025-01-06
