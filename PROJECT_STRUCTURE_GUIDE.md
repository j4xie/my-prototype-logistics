# 项目结构完整指南

**最后更新**: 2025-11-21  
**整理范围**: 完整项目结构优化  
**目标**: 让新开发者能快速找到所需信息

## 🗂️ 项目总体结构

```
my-prototype-logistics/
│
├── 📄 核心文档 (在根目录)
│   ├── README.md                      # 项目总概览（必读）
│   ├── CLAUDE.md                      # 开发指南和最佳实践（必读）
│   ├── QUICK_START.md                 # 5分钟快速开始（新手必读）
│   ├── ROOT_CLEANUP_SUMMARY.md        # 根目录整理说明
│   └── PROJECT_STRUCTURE_GUIDE.md     # 本文件
│
├── 🔧 开发目录
│   ├── backend-java/                  # Spring Boot后端（Java）
│   │   ├── src/                       # Java源代码
│   │   ├── target/                    # 编译输出
│   │   ├── docs/                      # 后端文档和报告
│   │   │   ├── reports/               # 测试和E2E报告
│   │   │   └── ...
│   │   ├── logs/                      # 后端日志文件
│   │   ├── scripts/                   # SQL脚本和工具
│   │   ├── test-reports/              # 测试报告目录
│   │   ├── backend-ai-chat/           # Python AI服务
│   │   │   ├── docs/                  # AI文档和指南
│   │   │   ├── scripts/               # AI脚本和测试
│   │   │   ├── venv/                  # Python虚拟环境
│   │   │   ├── README.md              # AI服务说明
│   │   │   └── requirements.txt       # 依赖配置
│   │   ├── pom.xml                    # Maven配置（重要）
│   │   ├── build.sh                   # 编译脚本
│   │   ├── deploy.sh                  # 部署脚本
│   │   ├── run-local.sh               # 本地运行脚本
│   │   ├── README.md                  # 后端说明
│   │   └── BACKEND_CLEANUP_SUMMARY.md # 后端整理说明
│   │
│   ├── frontend/                      # React Native前端
│   │   ├── CretasFoodTrace/           # Expo应用项目
│   │   └── ...
│   │
│   └── backend/                       # 旧Python后端（可选）
│
├── 📚 文档目录
│   ├── docs/
│   │   ├── prd/                       # 产品需求文档（主要）
│   │   │   ├── PRD-功能与文件映射-v3.0.md      # 核心：功能映射
│   │   │   ├── PRD-功能与文件映射-v3.0.html    # 核心：功能映射(HTML)
│   │   │   ├── PRD-完整业务流程与界面设计-v5.0.md    # 核心：业务流程
│   │   │   ├── PRD-完整业务流程与界面设计-v5.0.html  # 核心：业务流程(HTML)
│   │   │   ├── PENDING_FEATURES_TODO.md       # 待实现功能清单
│   │   │   ├── 导航架构实现指南.md             # 导航开发指南
│   │   │   ├── 角色权限和页面访问速查表.md     # 权限速查
│   │   │   ├── AI-DETAILED-FUNCTIONALITY-GUIDE.md  # AI详解
│   │   │   ├── AI-Integration-Complete-Guide.html   # AI集成
│   │   │   ├── MRD-*.html                    # 市场需求文档
│   │   │   ├── README.md                     # PRD目录说明
│   │   │   ├── archive/                      # 归档目录
│   │   │   │   ├── deprecated/               # 过期文档
│   │   │   │   ├── controller-docs/          # 单个Controller文档
│   │   │   │   ├── entity-docs/              # 单个Entity文档
│   │   │   │   └── ...
│   │   │   └── ...
│   │   │
│   │   ├── reports/                   # 项目报告
│   │   │   ├── *_REPORT.md            # 各类报告
│   │   │   ├── *_SUMMARY.md           # 总结文档
│   │   │   └── ...
│   │   │
│   │   ├── archive/                   # 已归档内容
│   │   │   ├── test-reports/          # 测试报告目录
│   │   │   ├── generate_*.py          # 生成脚本
│   │   │   └── ...
│   │   │
│   │   └── [其他文档子目录]
│   │
│   └── ...
│
├── 🚀 脚本和工具
│   ├── scripts/                       # 所有脚本集中地
│   │   ├── start-complete-system.sh   # 启动完整系统
│   │   ├── start-system-macos.sh      # 启动macOS系统
│   │   ├── test-integration.sh        # 集成测试
│   │   ├── test_backend_apis.sh       # 后端API测试
│   │   ├── test_dashboard_apis.sh     # 仪表盘测试
│   │   └── ...
│   │
│   └── build/                         # 编译产物
│       └── cretas-backend-system-1.0.0.jar
│
├── 📊 日志和测试
│   ├── logs/                          # 项目日志
│   ├── tests/                         # 测试文件和报告
│   └── ...
│
├── 🔧 配置文件
│   ├── package-lock.json              # NPM依赖锁定
│   ├── .gitignore                     # Git忽略配置
│   ├── .github/                       # GitHub配置
│   └── ...
│
└── 🔍 隐藏目录
    ├── .git/                          # Git版本控制
    ├── .vscode/                       # VSCode配置
    ├── .claude/                       # Claude指南
    └── ...
```

---

## 📖 快速导航

### 🎯 我想快速了解项目

**按顺序阅读**:
1. `README.md` - 项目概览（5分钟）
2. `QUICK_START.md` - 快速开始（5分钟）
3. `CLAUDE.md` - 开发指南（15分钟）

### 🔍 我想了解功能实现

**查看这些文档**:
1. `docs/prd/PRD-功能与文件映射-v3.0.md` - 找到功能对应的代码位置
2. `docs/prd/PRD-完整业务流程与界面设计-v5.0.md` - 了解完整业务流程

### 🔐 我需要权限和角色信息

**查看这个文档**:
- `docs/prd/角色权限和页面访问速查表.md` - 快速查找权限规则

### 🧭 我需要了解导航架构

**查看这个文档**:
- `docs/prd/导航架构实现指南.md` - 导航开发代码示例

### 🤖 我需要了解AI功能

**查看这些文档**:
1. `docs/prd/AI-DETAILED-FUNCTIONALITY-GUIDE.md` - AI功能详解
2. `docs/prd/AI-Integration-Complete-Guide.html` - AI集成指南
3. `backend-java/backend-ai-chat/README.md` - AI服务说明

### 🚀 我想启动系统

**执行脚本**:
```bash
# 启动完整系统（推荐）
bash scripts/start-complete-system.sh

# 或启动macOS系统
bash scripts/start-system-macos.sh

# 或手动启动
cd backend-java
./run-local.sh  # 启动后端

cd frontend/CretasFoodTrace
npm start       # 启动前端
```

### 📝 我需要查看报告

**查看目录**:
- `docs/reports/` - 所有项目报告
- `backend-java/docs/reports/` - 后端测试报告

### 🐛 我想查看日志

**查看目录**:
- `logs/` - 项目日志
- `backend-java/logs/` - 后端日志

### 🏗️ 我想了解项目整理

**查看这些文档**:
- `ROOT_CLEANUP_SUMMARY.md` - 根目录整理说明
- `backend-java/BACKEND_CLEANUP_SUMMARY.md` - 后端整理说明

---

## 🎓 按角色的推荐阅读

### 👨‍💻 新手开发者

**第1周 - 环境和基础**：
1. `README.md` - 理解项目
2. `QUICK_START.md` - 搭建环境
3. `CLAUDE.md` (section: "Code Quality Principles") - 学习最佳实践

**第2周 - 功能和权限**：
1. `docs/prd/角色权限和页面访问速查表.md` - 理解权限
2. `docs/prd/导航架构实现指南.md` - 理解导航

**第3周 - 开始开发**：
1. 选择一个模块（如material, equipment等）
2. 查看 `docs/prd/PRD-功能与文件映射-v3.0.md` 找到相关代码
3. 开始修改代码

### 🔧 后端开发者

**必读**：
1. `backend-java/README.md` - 后端项目说明
2. `docs/prd/PRD-完整业务流程与界面设计-v5.0.md` - 数据模型
3. `backend-java/docs/reports/` - 查看历史测试报告

**参考**：
- `docs/prd/PRD-功能与文件映射-v3.0.md` - API端点映射
- `docs/prd/PENDING_FEATURES_TODO.md` - 待实现功能

### 📱 前端开发者

**必读**：
1. `docs/prd/角色权限和页面访问速查表.md` - 权限配置
2. `docs/prd/导航架构实现指南.md` - 导航实现
3. `docs/prd/PRD-功能与文件映射-v3.0.md` - 功能和API映射

**参考**：
- `docs/prd/PRD-完整业务流程与界面设计-v5.0.md` - 界面设计
- `docs/prd/PENDING_FEATURES_TODO.md` - 待实现功能

### 🤖 AI/数据分析开发者

**必读**：
1. `backend-java/backend-ai-chat/README.md` - AI服务说明
2. `docs/prd/AI-DETAILED-FUNCTIONALITY-GUIDE.md` - AI功能详解
3. `docs/prd/AI-Integration-Complete-Guide.html` - AI集成指南

### 📊 项目经理/QA

**必读**：
1. `README.md` - 项目概览
2. `docs/prd/PRD-完整业务流程与界面设计-v5.0.md` - 完整功能
3. `docs/prd/PENDING_FEATURES_TODO.md` - 进度跟踪

**参考**：
- `docs/reports/` - 测试报告
- `CLAUDE.md` (Code Review清单) - 质量标准

---

## 📊 文件统计

### 核心文档数量
- ✅ 最新版本PRD: 4个（v3.0 x2, v5.0 x2）
- ✅ 专项指南: 4个（权限、导航、AI等）
- ✅ 辅助文档: 3个（MRD、总结等）
- 📦 归档文档: 80+个（过期版本等）

### 代码数量
- ✅ Java 源文件: backend-java/src/
- ✅ React Native 文件: frontend/CretasFoodTrace/
- ✅ Python AI服务: backend-java/backend-ai-chat/

### 脚本和配置
- ✅ 部署脚本: 3个 (build.sh, deploy.sh, run-local.sh)
- ✅ 启动脚本: 2个 (scripts/start-*.sh)
- ✅ 测试脚本: 5+个 (scripts/ 和 docs/reports/)

---

## 🔄 工作流

### 开发流程

```
1. 查看需求
   ↓
   → 查看 docs/prd/ 中的相关文档

2. 确定代码位置
   ↓
   → 查看 PRD-功能与文件映射-v3.0.md

3. 开始编码
   ↓
   → 参考 CLAUDE.md 中的代码质量规范

4. 测试
   ↓
   → 运行 scripts/ 中的测试脚本
   → 查看 docs/reports/ 中的测试报告

5. 提交
   ↓
   → 通过代码审查清单 (CLAUDE.md)
   → 提交 Pull Request
```

### 部署流程

```
1. 编译
   ↓
   cd backend-java && ./build.sh

2. 验证
   ↓
   mvn test

3. 部署
   ↓
   ./deploy.sh

4. 监控
   ↓
   tail -f logs/backend.log
```

---

## 🎯 常见问题

### Q: 我找不到某个文件
**A**: 使用这个命令：
```bash
# 在根目录搜索
find . -name "filename" -type f

# 或搜索内容
grep -r "search_term" docs/ backend-java/
```

### Q: 整理前的文件还在吗？
**A**: 是的，都被整理到了归档目录：
- 根目录的旧文件 → `docs/reports/` 或 `docs/archive/`
- 后端的旧文件 → `backend-java/docs/reports/` 或 `backend-java/docs/archive/`
- PRD的旧文件 → `docs/prd/archive/`

### Q: 项目结构是否还会改变？
**A**: 不会。这是经过整理的最终结构。新文件应该遵循这个结构放置。

### Q: 如何贡献新文档？
**A**: 根据文档类型放置：
- 新功能文档 → `docs/prd/`
- 新报告 → `docs/reports/`
- 新脚本 → `scripts/`
- 新测试脚本 → `backend-java/docs/reports/` (对于后端)

---

## 🚀 下一步行动

1. **阅读核心文档**
   - [ ] README.md (5分钟)
   - [ ] QUICK_START.md (5分钟)
   - [ ] CLAUDE.md (30分钟)

2. **搭建开发环境**
   - [ ] 运行 QUICK_START.md 中的命令
   - [ ] 验证系统启动成功

3. **了解项目结构**
   - [ ] 查看相关的PRD文档
   - [ ] 找到自己要修改的代码位置

4. **开始开发**
   - [ ] 选择一个任务
   - [ ] 参考 CLAUDE.md 中的代码规范
   - [ ] 提交PR

---

**项目结构整理完成！祝开发愉快。** ✨

