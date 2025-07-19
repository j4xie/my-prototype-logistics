# 黑牛食品溯源系统

## 项目结构

```
heiniu/
├── backend/              # 后端服务 (Node.js + Express + MySQL)
│   ├── src/
│   │   ├── controllers/  # 控制器
│   │   ├── middleware/   # 中间件
│   │   ├── models/       # 数据模型
│   │   ├── routes/       # 路由
│   │   ├── services/     # 业务逻辑
│   │   ├── utils/        # 工具函数
│   │   ├── config/       # 配置文件
│   │   └── index.js      # 入口文件
│   ├── prisma/           # 数据库模式
│   ├── package.json
│   └── .env.example
├── frontend/             # 前端项目 (Next.js + React)
│   ├── web-app-next/     # Next.js 应用
│   ├── prototype/        # 原型页面
│   ├── docs/             # 文档
│   ├── scripts/          # 脚本工具
│   └── reports/          # 报告
└── README.md
```

## 开发指南

### 后端开发

1. **安装依赖**
```bash
cd backend
npm install
```

2. **配置环境变量**
```bash
cp .env.example .env
# 修改 .env 文件中的数据库配置
```

3. **数据库迁移**
```bash
npx prisma migrate dev --name init
```

4. **启动后端服务**
```bash
npm run dev  # 开发模式
npm start    # 生产模式
```

### 前端开发

1. **安装依赖**
```bash
cd frontend/web-app-next
npm install
```

2. **启动前端服务**
```bash
npm run dev
```

3. **配置API地址**
- 开发环境: `http://localhost:3001`
- 生产环境: 根据部署情况配置

## 技术栈

### 后端
- **运行时**: Node.js
- **框架**: Express.js
- **数据库**: MySQL (可迁移到 PostgreSQL)
- **ORM**: Prisma
- **身份验证**: JWT
- **安全**: bcrypt, helmet, cors

### 前端
- **框架**: Next.js 14
- **UI库**: React + Tailwind CSS
- **状态管理**: Zustand
- **API客户端**: Fetch API
- **测试**: Jest + React Testing Library

## 部署说明

### 本地开发
1. 启动后端服务: `cd backend && npm run dev`
2. 启动前端服务: `cd frontend/web-app-next && npm run dev`

### 生产部署
- 后端: 支持各种云服务提供商
- 前端: 支持 Vercel、Netlify 等静态部署

## 数据库迁移

从 MySQL 迁移到 PostgreSQL:
1. 修改 `backend/prisma/schema.prisma` 中的 provider
2. 更新 `DATABASE_URL` 环境变量
3. 运行 `npx prisma migrate dev`

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 许可证

MIT License