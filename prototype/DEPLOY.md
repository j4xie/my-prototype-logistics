# 🚀 Prototype 项目 Vercel 部署指南

## 📋 部署前准备

### 1. 项目结构
确认您的 `prototype/` 目录结构如下：
```
prototype/
├── vercel.json          # Vercel配置文件
├── DEPLOY.md           # 本部署指南
└── modern-app/         # 主应用目录
    ├── index.html      # 主入口文件（包含预览功能）
    ├── pages/          # 所有页面文件
    ├── styles/         # 样式文件
    └── README.md       # 应用说明
```

### 2. 功能特性
✅ **单一入口点**：只使用 `index.html` 作为主入口，避免部署冲突  
✅ **集成预览功能**：页面总览预览功能已内置到主页面中  
✅ **完整路由支持**：支持所有页面和静态资源的正确路由  
✅ **响应式设计**：兼容桌面和移动端访问  

## 🔧 部署到 Vercel

### 方法一：使用 Vercel CLI（推荐）

1. **安装 Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **进入 prototype 目录**
   ```bash
   cd /path/to/your/my-prototype-logistics/prototype
   ```

3. **登录 Vercel**
   ```bash
   vercel login
   ```

4. **执行部署**
   ```bash
   vercel --prod
   ```

5. **按提示配置**
   - Project name: `food-traceability-prototype`
   - Framework: `Other`
   - Root directory: `./` (当前目录)
   - Build command: 留空（静态文件）
   - Output directory: `modern-app`

### 方法二：使用 GitHub 集成

1. **创建新的 Git 仓库**
   ```bash
   cd prototype/
   git init
   git add .
   git commit -m "Initial prototype deployment"
   ```

2. **推送到 GitHub**
   ```bash
   git remote add origin https://github.com/yourusername/food-traceability-prototype.git
   git push -u origin main
   ```

3. **在 Vercel 控制台导入**
   - 访问 [vercel.com](https://vercel.com)
   - 点击 "New Project"
   - 导入 GitHub 仓库
   - 根目录设置为 `./`
   - 框架选择 "Other"

### 方法三：直接拖拽部署

1. **准备部署文件夹**
   将 `prototype/modern-app/` 目录压缩为 ZIP 文件

2. **访问 Vercel**
   - 访问 [vercel.com](https://vercel.com)
   - 直接拖拽 ZIP 文件到页面
   - 等待自动部署完成

## ⚙️ Vercel 配置说明

`vercel.json` 配置文件功能：

```json
{
  "version": 2,
  "name": "food-traceability-prototype",
  "public": true,
  "framework": null,
  "builds": [
    {
      "src": "modern-app/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/",
      "dest": "/modern-app/index.html"
    },
    {
      "src": "/pages/(.*)",
      "dest": "/modern-app/pages/$1"
    },
    {
      "src": "/styles/(.*)",
      "dest": "/modern-app/styles/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/modern-app/$1"
    }
  ]
}
```

### 配置解释：
- **builds**: 将 `modern-app/` 目录构建为静态文件
- **routes**: 设置路由规则，确保所有请求正确映射到文件
- **cleanUrls**: 启用干净的URL（无 .html 后缀）
- **headers**: 设置安全头，支持 iframe 嵌套

## 🌐 部署后访问

### 主要功能入口：
1. **主页面**: `https://your-deployment.vercel.app/`
2. **页面预览**: 点击主页的"页面总览预览"按钮
3. **用户入口**: 点击"普通用户"进入移动端体验
4. **管理后台**: 点击"管理员后台"进入PC端管理

### 直接页面访问：
- 认证页面: `/pages/auth/login.html`
- 溯源查询: `/pages/trace/query.html`
- 农业监控: `/pages/farming/dashboard.html`
- 管理后台: `/pages/admin/dashboard.html`

## 🔍 预览功能使用

集成的预览功能特性：
- **左侧页面列表**: 按模块分组的50个页面导航
- **右侧实时预览**: iframe方式预览选中页面
- **面包屑导航**: 显示当前浏览路径
- **预览控制**: 适应/实际/全屏模式
- **键盘快捷键**: ESC退出预览，F11全屏

## 🚨 常见问题解决

### Q1: 页面无法加载
**解决方案**: 检查文件路径是否正确，确保所有页面文件都在 `pages/` 目录下

### Q2: 样式丢失
**解决方案**: 确认 `styles/` 目录包含所有CSS文件，路径引用正确

### Q3: iframe 显示空白
**解决方案**: 检查目标页面是否存在，以及是否有JavaScript错误

### Q4: 移动端显示异常
**解决方案**: 确认响应式CSS生效，检查viewport设置

## 📊 性能优化建议

1. **图片优化**: 使用WebP格式或压缩现有图片
2. **CSS压缩**: 考虑合并和压缩CSS文件
3. **缓存设置**: Vercel自动处理静态文件缓存
4. **CDN加速**: Vercel全球CDN自动加速

## 🔒 安全配置

当前配置包含的安全措施：
- `X-Frame-Options: SAMEORIGIN` - 防止点击劫持
- `X-Content-Type-Options: nosniff` - 防止MIME类型嗅探
- HTTPS 强制加密（Vercel自动配置）

## 📱 域名配置（可选）

如需使用自定义域名：
1. 在 Vercel 项目设置中添加域名
2. 配置DNS CNAME记录指向 Vercel
3. 等待SSL证书自动配置

## 🎯 部署验证清单

部署完成后验证：
- [ ] 主页面加载正常
- [ ] 预览功能工作正常
- [ ] 所有模块页面可访问
- [ ] 移动端响应式正常
- [ ] 管理后台页面完整
- [ ] 图片和样式正常加载

---

## 📞 技术支持

如遇到部署问题，请检查：
1. 文件结构是否完整
2. vercel.json 配置是否正确
3. Vercel构建日志是否有错误
4. 网络连接是否正常

**部署完成后，您将拥有一个完整的食品溯源系统原型演示平台！** 🎉 