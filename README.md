# 食品溯源系统原型

基于MCP服务的物流原型系统，使用GitHub Actions实现自动部署。

## 设计风格

本项目采用"Neo Minimal iOS-Style Admin UI"设计语言，具有以下特点：

### 布局规范
- **页面容器**：`max-w-[390px] mx-auto flex flex-col min-h-screen`
- **内容区域**：`pt-[80px] pb-[80px]`（顶部和底部空间避免导航遮挡）
- **响应式**：移动优先设计，所有组件适配窄屏幕

### 导航栏
- **顶部导航**：`fixed top-0 left-0 right-0 z-[999] bg-[#1890FF] text-white shadow-sm h-16 flex items-center px-4`
- **左侧**：返回图标 + 页面标题
- **右侧**：功能图标按钮，如通知、设置等

### 卡片设计
- **标准卡片**：`bg-white rounded-lg shadow-sm p-4 mb-4`
- **标题**：`text-lg font-medium text-gray-900`
- **副文本**：`text-sm text-gray-600`
- **网格布局**：`grid grid-cols-2 gap-4`适用于统计或快捷操作

### 用户信息卡
- **容器**：`flex items-center p-4 bg-white rounded-lg shadow-sm`
- **头像**：`w-12 h-12 rounded-full overflow-hidden mr-3`
- **问候语**：`text-lg font-medium text-gray-900`（如：你好，张三）
- **班次**：`text-sm text-gray-600 mr-2`（如：早班）
- **角色标签**：`rounded-full text-xs bg-[#E6F7FF] text-[#1890FF] px-2 py-0.5`

### 统计卡片
- **图标区**：右侧带软背景（如`bg-blue-50`）
- **数字强调**：`text-2xl font-medium text-gray-900`
- **状态颜色**：警告`text-[#FF4D4F]`，成功`text-[#52C41A]`

### 功能按钮
- **二列布局**：`grid grid-cols-2 gap-4`
- **按钮结构**：垂直堆叠的图标+标签
- **背景色**：根据功能类型使用不同背景色
- **交互反馈**：`hover:shadow-md hover:scale-[1.03] transition-all duration-200`
- **禁用状态**：灰色显示并可选显示锁定图标

### 底部标签栏
- **容器**：`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50`
- **布局**：`flex justify-around items-center h-16`
- **标签项**：`flex flex-col items-center`
- **标签文字**：`text-xs mt-1`
- **活动状态**：`text-[#1890FF]`并可添加指示条

### 色彩系统
- **主色**：`#1890FF` (蓝色)
- **成功**：`#52C41A` (绿色)
- **警告**：`#FAAD14` (黄色)
- **错误**：`#FF4D4F` (红色)
- **文本**：主要文本 `#333333`，次要文本 `#666666`

### 无障碍与交互
- **互动元素**：必须支持 `:hover`, `:focus`, 和 `:active` 状态
- **键盘导航**：可聚焦元素需设置 `tabindex="0"`
- **语义化**：使用恰当的 `aria-label` 和语义角色
- **触摸目标**：确保足够大小的点击区域（最小44px）

## 部署信息

项目已部署到Surge平台：
- 网址：https://food-trace-prototype.surge.sh
- 支持通过GitHub Actions自动部署

## 开发工具脚本

### Git快速提交工具

使用`gitpush`命令可一键完成git提交操作：

```bash
# 使用方法
gitpush "提交说明信息"

# 例如
gitpush "修复登录页面bug"
```

此命令会自动执行以下操作：
1. 添加所有更改 (git add .)
2. 提交更改 (git commit -m "你的信息")
3. 推送到远程仓库 (git push)

### 部署脚本

```bash
# 完整部署（包含CSS构建）
npm run deploy

# 简单部署（不构建CSS）
npm run deploy:simple
```

## 自动部署说明

本项目使用GitHub Actions自动部署到Surge平台：

- **触发条件**：推送到main分支时自动部署
- **工作流程**：检出代码 → 设置Node.js环境 → 安装依赖 → 构建CSS → 部署到Surge
- **配置文件**：`.github/workflows/deploy.yml`

如需手动部署，可使用：
```bash
surge ./ food-trace-prototype.surge.sh
```

## 本地开发

```bash
# 安装依赖
npm install

# 启动本地开发服务器
npm start

# 手动部署
npm run deploy
```

## MCP服务使用指南

本项目使用多个MCP（Model Control Protocol）服务提供AI增强功能。

### Neon数据库服务

PostgreSQL兼容的云数据库服务，用于数据存储。

**使用示例**：
```javascript
// 连接到数据库
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 查询示例
async function getProducts() {
  const result = await pool.query('SELECT * FROM products');
  return result.rows;
}
```

**通过AI使用Neon数据库**：
```
请创建一个新的products表，包含id、name、price和category字段。
```

AI将生成并执行必要的SQL语句，如：
```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(50)
);
```

### Magic MCP

提供UI组件生成和Logo搜索功能。

**使用示例**：
```
/ui 创建一个带有头像、用户名和角色标签的用户信息卡片
```

AI将生成ReactJS组件代码：
```jsx
<div className="bg-white rounded-lg shadow-sm p-4 flex items-center">
  <div className="w-12 h-12 rounded-full bg-blue-100 mr-3 overflow-hidden">
    <img src="/avatar.png" alt="用户头像" className="w-full h-full object-cover" />
  </div>
  <div>
    <div className="text-lg font-medium text-gray-900">张三</div>
    <div className="flex items-center">
      <span className="text-sm text-gray-600 mr-2">早班</span>
      <span className="rounded-full text-xs bg-[#E6F7FF] text-[#1890FF] px-2 py-0.5">系统管理员</span>
    </div>
  </div>
</div>
```

### Browser Tools MCP

提供浏览器调试和分析功能。

**使用示例**：
```
请截图当前页面并检查网络错误
```

AI将运行相关工具并分析结果：
```
页面截图已获取。检测到1个网络错误：
- 404错误：/api/products - 资源未找到
```

### Playwright MCP

提供浏览器自动化和交互功能。

**使用示例**：
```
点击登录页面的"忘记密码"链接并填写邮箱
```

AI将执行操作并报告结果：
```
已点击"忘记密码"链接，打开重置密码表单，已填写邮箱字段并提交。
系统显示"重置链接已发送"确认消息。
```

## 原型系统功能模块

该原型系统包含以下详细功能模块：

### 1. 登录与功能选择
- **用户登录界面**：支持账号密码登录、记住密码和找回密码功能
- **功能模块选择器**：卡片式布局展示各个模块入口，包含图标和模块名称
- **权限控制**：基于用户角色显示可访问模块，禁用无权限模块
- **操作反馈**：错误提示、加载状态和成功跳转动画

### 2. 养殖管理模块
- **养殖场信息**：
  - 基本信息管理（名称、地址、负责人、联系方式）
  - 场地信息（面积、环境参数、容量）
  - 资质证书管理（营业执照、卫生许可证）
- **动物溯源记录**：
  - 入场登记（来源、数量、健康状况）
  - 日常养殖记录（喂养、生长数据）
  - 疫病防控记录（检疫、疫情预警）
- **疫苗接种记录**：
  - 接种计划管理
  - 接种执行记录（疫苗批次、接种人员、接种时间）
  - 免疫效果评估
- **繁育信息管理**：
  - 种源信息记录
  - 繁殖过程监控
  - 后代追踪
- **场地监控**：
  - 实时视频监控接入
  - 养殖环境监测（温度、湿度、有害气体浓度）
  - 异常情况警报

### 3. 生产加工模块
- **加工厂信息**：
  - 基本信息管理
  - 生产线配置
  - 工艺流程定义
- **加工溯源记录**：
  - 原料接收记录（批次、数量、质量检验）
  - 加工过程记录（时间、工艺参数、操作人员）
  - 产品入库记录（生产日期、保质期、批次码）
- **质检管理**：
  - 质检标准配置
  - 检测记录管理
  - 不合格品处理
  - 质检报告生成
- **肉质等级评定**：
  - 符合国家标准GB/T 17238-2008
  - 评定流程管理
  - 等级证书生成
- **加工记录采集**：
  - 关键节点拍照记录
  - 条码扫描记录
  - 工序确认

### 4. 销售物流模块
- **物流信息管理**：
  - 运输工具信息（车辆、冷链设备）
  - 运输路线规划
  - 配送人员管理
  - 交付确认
- **库存管理**：
  - 产品入库管理
  - 库存盘点
  - 出库记录
  - 库存预警
- **销售管理**：
  - 订单处理
  - 销售记录
  - 客户信息管理
- **溯源地图**：
  - 全生命周期地理位置可视化
  - 运输轨迹跟踪
  - 销售网点分布

### 5. 溯源查询模块
- **溯源码生成**：
  - 二维码/条形码生成
  - 溯源链接生成
  - 批次管理
- **溯源页面**：
  - 产品基本信息展示
  - 生产加工环节展示
  - 检验检疫信息展示
  - 物流运输信息展示
- **产品验真**：
  - 真伪验证
  - 防伪技术支持
  - 举报功能

### 6. 系统管理模块
- **用户管理**：
  - 用户创建与维护
  - 角色分配
  - 权限设置
  - 用户登录日志
- **系统配置**：
  - 基础数据维护
  - 系统参数设置
  - 业务规则配置
  - 短信/邮件通知设置
- **数据分析**：
  - 销售统计
  - 产量分析
  - 质量分析
  - 追溯使用分析

## 项目技术栈

- **前端**: HTML5, CSS3, JavaScript
- **样式**: TailwindCSS
- **图表**: Chart.js
- **地图**: Leaflet
- **工具**: Axios, QRCode
- **构建工具**: PostCSS, Autoprefixer
- **开发服务器**: Browser-Sync
- **部署**: Surge, GitHub Actions
- **AI增强**: MCP服务（Magic MCP, Browser Tools MCP, Sequential Thinking MCP, Playwright MCP, Neon MCP） 