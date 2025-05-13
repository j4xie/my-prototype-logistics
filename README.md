# 食品溯源系统

<!-- updated for: 项目重构阶段一 - 文档统一与更新 -->

一个基于Web应用的食品溯源系统，用于跟踪农产品从农场到餐桌的整个过程，确保食品安全和透明度。

## 功能特点

- **产品信息录入与管理**：支持批量和单个产品信息的录入和管理
- **二维码生成与扫描**：生成唯一二维码标识每批产品，并支持移动端扫描
- **物流轨迹追踪**：记录和展示产品在供应链中的流转路径
- **产品溯源查询**：面向消费者和企业用户的完整溯源信息查询
- **质量检测报告**：记录和展示产品质量检测结果
- **数据统计与分析**：对溯源数据进行多维度统计和分析
- **农业/养殖数据采集与监控**：支持自动化和手动数据采集
- **数据趋势预测与分析**：基于历史数据进行趋势预测和分析

## 快速开始

### 环境要求
- Node.js (14.x或更高版本)
- npm、yarn或pnpm包管理器

### 安装步骤

1. 克隆仓库:
```bash
git clone https://github.com/yourusername/food-traceability-system.git
cd food-traceability-system
```

2. 安装依赖:
```bash
npm install
# 或使用其他包管理器
yarn install
pnpm install
```

3. 设置环境变量:
```bash
cp .env.example .env
# 根据需要编辑.env文件
```

### 运行应用

```bash
npm run start
# 或使用其他包管理器
yarn start
pnpm start
```

服务器通常会启动在 http://localhost:3000

## 项目结构

项目采用模块化的目录结构，便于维护和扩展：

```
.
├── web-app/                   # Web应用主目录
│   ├── src/                   # 源代码目录
│   │   ├── components/        # 组件目录
│   │   ├── pages/             # 页面组件
│   │   ├── hooks/             # 自定义Hooks
│   │   ├── utils/             # 工具函数
│   │   ├── services/          # API服务
│   │   ├── store/             # 状态管理
│   │   ├── styles/            # 全局样式
│   │   └── types/             # 类型定义
│   ├── public/                # 静态资源
│   ├── tests/                 # 测试文件
│   └── config/                # 配置文件
├── docs/                      # 项目文档
│   ├── architecture/          # 架构文档
│   ├── api/                   # API文档
│   ├── components/            # 组件文档
│   └── guides/                # 开发指南
├── scripts/                   # 工具脚本
└── ...                        # 其他配置文件
```

详细的目录结构说明请查看[目录结构文档](docs/architecture/directory.md)。

## 核心模块

1. **认证 (Auth)**
   - 用户登录与认证
   - 权限管理

2. **核心溯源 (Trace)**
   - 溯源批次管理
   - 溯源查询
   - 溯源详情展示
   - 溯源地图展示
   - 溯源证书管理

3. **物流 (Logistics)**
   - 物流记录创建
   - 车辆监控
   - 物流报告
   - 销售数据分析

4. **加工 (Processing)**
   - 加工质量检测
   - 加工环境监控
   - 加工过程记录
   - 加工报告生成

5. **农业/养殖 (Farming)**
   - 数据采集中心
   - 二维码数据采集
   - 手动数据采集
   - 自动监控数据展示
   - 数据验证
   - 养殖过程记录
   - 疫苗接种记录
   - 溯源批次创建

6. **预测与分析**
   - 数据预测分析
   - 预测模型配置
   - 模型管理
   - 指标详情分析

7. **用户中心/设置**
   - 用户个人信息管理
   - 系统设置
   - 消息通知
   - 帮助中心

8. **管理后台**
   - 管理员仪表盘
   - 用户管理
   - 角色权限管理
   - 产品信息管理
   - 模板管理
   - 数据导入
   - 系统设置
   - 系统日志

## 文档

详细文档可在`docs`目录找到：

- **架构文档**
  - [系统架构概览](docs/architecture/overview.md)
  - [目录结构说明](docs/architecture/directory.md)
  - [技术栈说明](docs/architecture/technologies.md)

- **API文档**
  - [API概览](docs/api/overview.md)
  - [认证API](docs/api/authentication.md)
  - [溯源API](docs/api/trace.md)
  - [农业/养殖API](docs/api/farming.md)
  - [物流API](docs/api/logistics.md)
  - [加工API](docs/api/processing.md)

- **组件文档**
  - [组件概览](docs/components/overview.md)
  - [通用组件](docs/components/common/index.md)
  - [业务组件](docs/components/modules/index.md)

- **开发指南**
  - [快速开始](docs/guides/getting-started.md)
  - [开发流程](docs/guides/development.md)
  - [测试指南](docs/guides/testing.md)
  - [部署指南](docs/guides/deployment.md)

## 开发工作流

项目使用Git Flow工作流进行开发：

- **main**: 生产环境分支
- **develop**: 开发环境分支
- **feature/xxx**: 新功能分支
- **bugfix/xxx**: 错误修复分支
- **release/xxx**: 发布准备分支

贡献代码前，请阅读[开发流程文档](docs/guides/development.md)。

## 测试

项目包含多种测试类型，确保代码质量：

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行端到端测试
npm run test:e2e

# 生成测试覆盖率报告
npm test -- --coverage
```

## 贡献指南

欢迎贡献代码、提出问题或建议。请通过以下步骤参与项目：

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'feat: add some feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 许可证

[选择合适的许可证]