# 溯源商城 + Web管理端 高保真HTML原型系统

> 基于项目现有设计系统构建的交互式高保真原型，包含C端小程序（溯源商城）和Web管理端共46个页面。

## 项目概述

本项目是食品溯源B2B2C平台的高保真HTML原型系统，用于产品评审、用户测试和开发参考。

**品牌说明**:
- **C端小程序**（22页面）：名称为"溯源商城"，是一个通用的B2B2C食品溯源商城平台，面向终端用户（消费者、企业采购）
- **Web管理端**（24页面）：平台管理后台，用于管理多个商户（包括白垩纪等品牌），进行产品管理、内容审核、流量管理等操作

**核心特性**:
- ✅ **高保真设计**: 接近真实产品的视觉效果和交互体验
- ✅ **完整交互**: 表单验证、列表操作、模拟API响应、页面导航
- ✅ **Mock数据**: 完整的模拟数据库和API系统
- ✅ **统一入口**: index.html集成所有界面，支持流程图可视化
- ✅ **响应式设计**: 支持移动端和桌面端

**技术栈**:
- 纯HTML + CSS + JavaScript（无框架依赖）
- CSS变量系统（复用项目现有设计）
- 模块化JavaScript（Mock API、表单验证、列表操作等）

## 项目结构

```
/小程序/
├── index.html                  # 主入口页面（Figma风格导航）
├── README.md                   # 项目说明文档（本文件）
│
├── assets/                     # 公共资源
│   ├── css/                    # CSS样式
│   │   ├── variables.css       # CSS变量（颜色、间距、圆角等）
│   │   ├── common.css          # 通用组件（按钮、卡片、表单）
│   │   ├── mobile.css          # 移动端专属样式
│   │   ├── desktop.css         # 桌面端专属样式
│   │   └── components.css      # 复用的组件库
│   │
│   ├── js/                     # JavaScript文件
│   │   ├── mockData.js         # 模拟数据库
│   │   ├── mockAPI.js          # 模拟API调用
│   │   ├── router.js           # 页面路由系统
│   │   ├── formValidator.js    # 表单验证工具
│   │   ├── listHelper.js       # 列表操作（排序/筛选/分页）
│   │   ├── stateManager.js     # 全局状态管理
│   │   └── utils.js            # 通用工具函数
│   │
│   └── images/                 # 图片资源
│       ├── placeholders/       # 占位图
│       └── icons/              # 图标资源
│
├── c-miniprogram/              # C端小程序（22个页面）
│   ├── home/                   # 首页模块
│   ├── auth/                   # 认证模块
│   ├── products/               # 产品模块
│   ├── traceability/           # 溯源模块
│   ├── ai-analysis/            # AI分析模块
│   ├── ai-rag/                 # AI问答模块
│   ├── referral/               # 推荐模块
│   ├── orders/                 # 订单模块
│   └── profile/                # 个人中心模块
│
└── web-admin/                  # Web管理端（24个页面）
    ├── dashboard/              # 仪表板模块
    ├── merchant/               # 商户管理模块
    ├── product-management/     # 产品管理模块
    ├── content-control/        # 内容控制模块
    ├── traffic-ad/             # 流量广告模块
    ├── ai-knowledge/           # AI知识库模块
    ├── analytics/              # 分析模块
    └── settings/               # 设置模块
```

## 快速开始

### 1. 直接打开

由于本项目是纯HTML/CSS/JavaScript实现，无需安装任何依赖。

**本地查看**:
```bash
# 方法1: 直接用浏览器打开index.html
open index.html

# 方法2: 使用本地服务器（推荐，避免CORS问题）
# macOS/Linux
python3 -m http.server 8000

# Windows
python -m http.server 8000

# 然后在浏览器访问: http://localhost:8000
```

### 2. 浏览原型

1. **主入口页面**: 打开 `index.html` 查看所有46个页面的导航
2. **筛选功能**: 使用顶部工具栏筛选C端/Web端、MVP/完成/规划中的页面
3. **搜索功能**: 在搜索框输入关键词快速查找页面
4. **流程图**: 点击"显示流程连接线"查看页面跳转关系
5. **预览页面**: 点击任意页面卡片跳转到对应页面

## 页面清单

### C端小程序（22个页面）

#### MVP核心（8个）
1. **首页** (`c-miniprogram/home/home.html`)
2. **微信授权登录** (`c-miniprogram/auth/login.html`)
3. **产品列表** (`c-miniprogram/products/list.html`)
4. **产品详情** (`c-miniprogram/products/detail.html`)
5. **扫码溯源** (`c-miniprogram/traceability/scan.html`)
6. **批次溯源信息** (`c-miniprogram/traceability/batch-info.html`)
7. **AI智能问答** (`c-miniprogram/ai-rag/chat.html`)
8. **个人中心** (`c-miniprogram/profile/index.html`)

#### 完善版（14个）
- 搜索页、注册绑定、阶梯定价计算器
- 质检报告详情、溯源时间线详情
- 工厂/行业/产品AI分析
- 咨询历史、分享推荐、我的推荐、推荐奖励
- 订单列表/详情/结算
- 设置页

### Web管理端（24个页面）

#### MVP核心（8个）
1. **总览仪表板** (`web-admin/dashboard/overview.html`)
2. **商户列表** (`web-admin/merchant/list.html`)
3. **商户审核** (`web-admin/merchant/review.html`)
4. **产品列表** (`web-admin/product-management/list.html`)
5. **新建产品** (`web-admin/product-management/create.html`)
6. **价格配置** (`web-admin/product-management/price-config.html`)
7. **内容审核队列** (`web-admin/content-control/review-queue.html`)
8. **知识库管理** (`web-admin/ai-knowledge/knowledge-base.html`)

#### 完善版（16个）
- 商户详情、状态管理
- 编辑产品、批量上下线
- 文案审核、展示策略、Banner管理
- 排序配置、推荐位、广告位、营销活动
- 文档上传、分类管理、问答对管理
- 流量统计、转化报告、用户行为
- 系统配置、用户权限、操作日志

## 设计系统

本原型复用了项目现有的设计系统（`docs/prd/*.html`和`docs/archive/prototypes-html/`）。

### 配色方案

```css
/* 主色 - 紫蓝渐变 */
--primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
--primary-color: #667eea;

/* 功能色 */
--success-color: #52c41a;  /* 成功/完成 */
--warning-color: #faad14;  /* 警告/进行中 */
--error-color: #f5222d;    /* 错误/危险 */
--info-color: #1890ff;     /* 信息 */

/* 商场风格扩展色 */
--ecommerce-accent: #ff6b6b;  /* 促销红 */
--ecommerce-vip: #ffd700;      /* VIP金 */
--ecommerce-safe: #2ed573;     /* 安全绿（溯源认证）*/
```

### 组件库

**按钮**:
- `.btn-primary` - 主要操作
- `.btn-default` - 次要操作
- `.btn-link` - 链接样式
- `.btn-success` / `.btn-danger` - 成功/危险操作

**卡片**:
- `.card` - 基础卡片
- `.product-card` - 产品卡片（带hover效果）

**表单**:
- `.form-control` - 输入框
- `.form-label.required` - 必填标签

**状态徽章**:
- `.badge-success` / `.badge-warning` / `.badge-danger`

**表格**:
- `.table` - 数据表格（支持排序、筛选）

## Mock数据系统

### 数据结构

**`mockData.js`** 包含以下模拟数据：
- **用户数据**: C端用户、商户信息
- **产品数据**: 产品列表、价格阶梯
- **批次溯源**: 原料、质检、时间线
- **订单数据**: 订单列表、订单详情
- **AI知识库**: 问答对、文档分类
- **推荐数据**: 推荐关系、奖励记录
- **统计数据**: Web端仪表板数据

### API调用

**`mockAPI.js`** 提供以下API端点：

**C端API**:
```javascript
await MockAPI.request('products.list', { category, keyword, page, pageSize });
await MockAPI.request('traceability.scan', { qrCode });
await MockAPI.request('ai.chat', { question, userId });
```

**Web端API**:
```javascript
await MockAPI.request('merchants.list', { status, keyword, page });
await MockAPI.request('admin.products.create', productData);
await MockAPI.request('admin.knowledge.upload', { file, category });
```

所有API调用都会：
- 模拟网络延迟（500-1000ms）
- 10%概率返回错误（用于测试错误处理）
- 支持完整的CRUD操作

## 交互功能

### 表单验证

使用 `FormValidator` 类进行表单验证：

```javascript
// 验证表单
const errors = FormValidator.validate(formEl);
if (errors.length > 0) {
  FormValidator.showErrors(formEl, errors);
} else {
  // 提交表单
}

// 启用实时验证
FormValidator.enableRealTimeValidation(formEl);
```

### 列表操作

使用 `ListHelper` 类进行列表操作：

```javascript
// 排序
const sorted = ListHelper.sort(data, 'createTime', 'desc');

// 筛选
const filtered = ListHelper.filter(data, { status: 'active', category: 'seafood' });

// 分页
const paginated = ListHelper.paginate(data, page, pageSize);

// 组合操作
const result = ListHelper.process(data, {
  filters: { status: 'active' },
  sortBy: 'price',
  order: 'asc',
  page: 1,
  pageSize: 10
});
```

### 状态管理

使用 `StateManager` 进行全局状态管理：

```javascript
// 设置状态
globalState.set('user.name', '张三');

// 获取状态
const userName = globalState.get('user.name');

// 监听状态变化
const unsubscribe = globalState.subscribe('user.name', (newValue) => {
  console.log('用户名已更新:', newValue);
});
```

### 工具函数

`Utils` 提供常用工具函数：

```javascript
// 格式化日期
Utils.formatDate(new Date(), 'YYYY-MM-DD HH:mm');

// 格式化货币
Utils.formatCurrency(1234.56); // "¥1,234.56"

// 显示Toast
Utils.showToast('操作成功', 'success');

// 确认对话框
const confirmed = await Utils.confirm('确认删除？', '删除提示');

// 复制到剪贴板
await Utils.copyToClipboard('文本内容');
```

## 开发指南

### 创建新页面

1. **复制模板页面** (推荐从MVP页面复制)
2. **修改页面内容** (保留公共头部、样式引用)
3. **添加到 `index.html` 的 `pages` 数组**
4. **更新连接关系** (`connectsTo` 字段)

### 引用公共资源

所有页面都应引用以下资源：

```html
<!-- CSS -->
<link rel="stylesheet" href="../assets/css/variables.css">
<link rel="stylesheet" href="../assets/css/common.css">
<!-- C端页面 -->
<link rel="stylesheet" href="../assets/css/mobile.css">
<!-- Web端页面 -->
<link rel="stylesheet" href="../assets/css/desktop.css">

<!-- JavaScript -->
<script src="../assets/js/mockData.js"></script>
<script src="../assets/js/mockAPI.js"></script>
<script src="../assets/js/utils.js"></script>
```

### 调用Mock API

```javascript
async function loadData() {
  const hideLoading = Utils.showLoading('加载中...');

  try {
    const result = await MockAPI.request('products.list', {
      category: 'seafood',
      page: 1,
      pageSize: 10
    });

    // 处理数据
    renderProducts(result.data);

  } catch (error) {
    Utils.showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}
```

## 实施计划

本项目按照以下阶段实施：

- ✅ **Phase 1**: 基础设施搭建（目录、CSS、Mock系统、主入口）
- ✅ **Phase 2**: C端小程序MVP（8个核心页面）
- ✅ **Phase 3**: Web管理端MVP（8个核心页面）
- ✅ **Phase 4**: C端完善（14个页面）
- ✅ **Phase 5**: Web端完善（16个页面）
- ✅ **Phase 6**: 优化与测试（跨浏览器、性能优化、文档完善）

**项目状态**: 全部6个阶段已完成，共计46个页面已实现并可演示

## 浏览器兼容性

**推荐浏览器**:
- Chrome 90+
- Safari 14+
- Firefox 88+
- Edge 90+

**移动端**:
- iOS Safari 14+
- Android Chrome 90+

## 常见问题

### 1. 页面显示不正常？

确保使用本地服务器打开（避免CORS问题）：
```bash
python3 -m http.server 8000
```

### 2. Mock API返回错误？

Mock API有10%概率返回错误（用于测试错误处理）。可以在 `mockAPI.js` 中设置 `skipError: true` 关闭。

### 3. 如何修改Mock数据？

编辑 `assets/js/mockData.js` 文件，修改 `MockDB` 对象中的数据。

### 4. 如何添加新的API端点？

在 `mockAPI.js` 的 `handleEndpoint` 方法中添加新的路由和处理函数。

## 贡献指南

本项目是内部原型系统，如需修改：

1. 遵循现有的设计系统和代码规范
2. 确保新页面样式与现有页面一致
3. 更新 `index.html` 中的页面列表
4. 更新本README文档

## 许可证

本项目为食品溯源B2B2C平台内部使用，版权所有 © 2025

---

**维护者**: Claude Sonnet 4.5
**最后更新**: 2025-12-17
**版本**: v1.0.0 (完整版 - 46个页面全部完成)
