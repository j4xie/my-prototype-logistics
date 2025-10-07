# 📚 Backend 文档目录

## 核心文档

### [API接口文档.md](API接口文档.md)
完整的API接口文档（120+ 个接口），包含：
- 移动端基础接口（登录、设备、激活、文件上传、AI分析）
- 加工模块接口（批次、质检、设备监控、仪表板、告警）
- 打卡模块接口
- 时间统计接口
- 工作类型管理接口
- 报表模块接口
- 系统监控接口
- 激活码管理接口
- 工厂用户接口（认证、白名单、用户管理、平台管理）

**推荐**: 前端开发必看

---

### [BACKEND_SYSTEM_OVERVIEW.md](BACKEND_SYSTEM_OVERVIEW.md)
后端系统架构概览，包含：
- 系统架构设计
- 数据库模型说明
- 技术栈详解
- 权限系统设计

**推荐**: 了解系统架构必看

---

### [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md)
测试账号清单，包含：
- 平台管理员账号
- 工厂超级管理员账号
- 部门管理员账号
- 普通用户账号
- 激活码列表

**推荐**: 测试开发必看

---

### [MYSQL_SETUP_GUIDE.md](MYSQL_SETUP_GUIDE.md)
MySQL 数据库安装和配置指南，包含：
- Windows/macOS/Linux 安装步骤
- 数据库初始化
- 常见问题解决

**推荐**: 环境搭建必看

---

### [PHASE2_RN_REQUIREMENTS.md](PHASE2_RN_REQUIREMENTS.md)
React Native 前端需求文档，包含：
- 前端开发需要的后端API需求
- 数据库表结构需求
- 业务逻辑需求
- 集成点需求

**推荐**: React Native 开发必看

---

## 归档文档 (archive/)

以下是历史文档，已归档保存：

- **API_DOCUMENTATION.md** - 旧版API文档（已被 API接口文档.md 替代）
- **COMPLETE-BACKEND-SUMMARY.md** - 后端完整总结报告
- **FINAL-SYSTEM-HEALTH-REPORT.md** - 系统健康检查报告
- **FINAL-USER-MANAGEMENT-FIX-REPORT.md** - 用户管理修复报告
- **PHASE2_BACKEND_REQUIREMENTS.md** - Phase 2 后端需求文档

---

## 📖 快速导航

### 我想...

#### 🚀 开始开发
1. 先看 [MYSQL_SETUP_GUIDE.md](MYSQL_SETUP_GUIDE.md) - 搭建环境
2. 再看 [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md) - 获取测试账号
3. 最后看 [API接口文档.md](API接口文档.md) - 调用接口

#### 🏗️ 了解架构
1. 先看 [BACKEND_SYSTEM_OVERVIEW.md](BACKEND_SYSTEM_OVERVIEW.md) - 系统概览
2. 再看 [../README.md](../README.md) - 项目主文档

#### 📱 开发React Native前端
1. 先看 [API接口文档.md](API接口文档.md) - API接口
2. 再看 [PHASE2_RN_REQUIREMENTS.md](PHASE2_RN_REQUIREMENTS.md) - 前端需求

#### 🧪 测试功能
1. 先看 [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md) - 测试账号
2. 再看 [API接口文档.md](API接口文档.md) - API调用方法

---

## 📂 文档结构

```
docs/
├── README.md                          # 本文档（导航索引）
├── API接口文档.md                      # ⭐ 完整API文档
├── BACKEND_SYSTEM_OVERVIEW.md         # ⭐ 系统架构概览
├── TEST_ACCOUNTS.md                   # ⭐ 测试账号清单
├── MYSQL_SETUP_GUIDE.md               # ⭐ MySQL安装指南
├── PHASE2_RN_REQUIREMENTS.md          # ⭐ RN前端需求
└── archive/                           # 归档文档
    ├── API_DOCUMENTATION.md
    ├── COMPLETE-BACKEND-SUMMARY.md
    ├── FINAL-SYSTEM-HEALTH-REPORT.md
    ├── FINAL-USER-MANAGEMENT-FIX-REPORT.md
    └── PHASE2_BACKEND_REQUIREMENTS.md
```

---

**最后更新**: 2025-10-05
**维护者**: Cretas 开发团队
