# 前端改造清单

## 一、管理前端 (mall_admin_ui) 改造

### 新增页面 (16个)

#### 商户管理模块 (4页面)
| 文件路径 | 功能 | 优先级 | 状态 |
|---------|------|--------|------|
| `src/views/merchant/list.vue` | 商户列表（筛选、批量操作、表格） | P0 | ⬜ |
| `src/views/merchant/review.vue` | 商户审核（队列、资料预览、审核表单） | P0 | ⬜ |
| `src/views/merchant/detail.vue` | 商户详情（完整资料、统计数据） | P1 | ⬜ |
| `src/views/merchant/status-management.vue` | 状态管理（批量上下线、封禁） | P1 | ⬜ |

#### 溯源管理模块 (4页面)
| 文件路径 | 功能 | 优先级 | 状态 |
|---------|------|--------|------|
| `src/views/traceability/batch-list.vue` | 批次列表（搜索、筛选、分页） | P0 | ⬜ |
| `src/views/traceability/batch-detail.vue` | 批次详情（时间线、原料、质检） | P0 | ⬜ |
| `src/views/traceability/timeline-editor.vue` | 时间线编辑（拖拽排序、添加节点） | P1 | ⬜ |
| `src/views/traceability/quality-report.vue` | 质检报告管理（上传、编辑） | P1 | ⬜ |

#### 广告系统模块 (3页面)
| 文件路径 | 功能 | 优先级 | 状态 |
|---------|------|--------|------|
| `src/views/advertisement/splash-ad.vue` | 启动广告管理 | P1 | ⬜ |
| `src/views/advertisement/banner-list.vue` | Banner管理（轮播图） | P1 | ⬜ |
| `src/views/advertisement/ad-slots.vue` | 广告位配置 | P2 | ⬜ |

#### 内容审核模块 (2页面)
| 文件路径 | 功能 | 优先级 | 状态 |
|---------|------|--------|------|
| `src/views/content-review/review-queue.vue` | 审核队列（商品、文案、图片） | P1 | ⬜ |
| `src/views/content-review/strategy-config.vue` | 展示策略配置 | P2 | ⬜ |

#### AI知识库模块 (3页面)
| 文件路径 | 功能 | 优先级 | 状态 |
|---------|------|--------|------|
| `src/views/ai-knowledge/knowledge-base.vue` | 知识库文档列表 | P1 | ⬜ |
| `src/views/ai-knowledge/document-upload.vue` | 文档上传 | P1 | ⬜ |
| `src/views/ai-knowledge/qa-pairs.vue` | 问答对管理 | P2 | ⬜ |

---

### 修改现有页面 (3个)

#### 商品管理 `src/views/mall/goodsspu/`
| 改动项 | 说明 | 状态 |
|-------|------|------|
| 添加商户选择器 | 关联商品到商户 | ⬜ |
| 添加阶梯定价配置 | 可动态添加价格梯度 | ⬜ |
| 添加溯源批次绑定 | 关联最新批次号 | ⬜ |
| 添加标签管理 | 可溯源、热销等标签 | ⬜ |

#### 订单管理 `src/views/mall/orderinfo/`
| 改动项 | 说明 | 状态 |
|-------|------|------|
| 显示商户信息列 | 表格新增商户名称列 | ⬜ |
| 添加溯源链接 | 订单详情显示溯源入口 | ⬜ |

#### 仪表盘 `src/views/dashboard/`
| 改动项 | 说明 | 状态 |
|-------|------|------|
| 添加待审核商户统计 | 新增指标卡片 | ⬜ |
| 添加商户分布饼图 | 新增图表 | ⬜ |

---

### 新增组件 (6个)

| 组件路径 | 功能 | 状态 |
|---------|------|------|
| `src/components/PriceTierEditor.vue` | 阶梯定价编辑器（可增删行） | ⬜ |
| `src/components/TimelineEditor.vue` | 溯源时间线编辑器 | ⬜ |
| `src/components/MerchantSelector.vue` | 商户选择下拉框 | ⬜ |
| `src/components/ContentPreview.vue` | 内容预览组件 | ⬜ |
| `src/components/StatusBadge.vue` | 状态徽章（审核中/已通过/已封禁） | ⬜ |
| `src/components/ImageUploader.vue` | 多图上传组件 | ⬜ |

---

### 新增 API 客户端 (6个)

```javascript
// src/api/merchant.js
export function getMerchantPage(query) { }        // 分页查询
export function getMerchantDetail(id) { }         // 商户详情
export function reviewMerchant(id, data) { }      // 审核操作
export function updateMerchantStatus(id, status) { } // 状态变更
export function getMerchantStats() { }            // 统计数据

// src/api/traceability.js
export function getBatchPage(query) { }           // 批次列表
export function getBatchDetail(id) { }            // 批次详情
export function createBatch(data) { }             // 创建批次
export function addTimelineNode(batchId, data) { } // 添加时间线节点
export function uploadQualityReport(batchId, file) { } // 上传质检报告

// src/api/advertisement.js
export function getAdList(type) { }               // 广告列表
export function createAd(data) { }                // 创建广告
export function updateAdStatus(id, status) { }    // 更新状态
export function getAdStats(id) { }                // 点击统计

// src/api/content-review.js
export function getReviewQueue(type) { }          // 审核队列
export function reviewContent(id, action, remark) { } // 审核操作
export function batchReview(ids, action) { }      // 批量审核

// src/api/ai-knowledge.js
export function getDocumentList(categoryId) { }   // 文档列表
export function uploadDocument(formData) { }      // 上传文档
export function getQAPairs(categoryId) { }        // 问答对列表
export function createQAPair(data) { }            // 创建问答对

// src/api/referral.js
export function getReferralList(query) { }        // 推荐列表
export function getReferralStats() { }            // 推荐统计
```

---

### 路由配置更新

```javascript
// src/router/index.js 新增路由
{
  path: '/merchant',
  component: Layout,
  children: [
    { path: 'list', component: () => import('@/views/merchant/list.vue') },
    { path: 'review', component: () => import('@/views/merchant/review.vue') },
    { path: 'detail/:id', component: () => import('@/views/merchant/detail.vue') },
  ]
},
{
  path: '/traceability',
  component: Layout,
  children: [
    { path: 'batch-list', component: () => import('@/views/traceability/batch-list.vue') },
    { path: 'batch-detail/:id', component: () => import('@/views/traceability/batch-detail.vue') },
  ]
},
// ... 其他模块
```

---

## 二、小程序 (mall_miniprogram) 改造

### 新增页面 (18个)

#### 溯源模块 (4页面)
| 路径 | 功能 | 优先级 | 状态 |
|-----|------|--------|------|
| `pages/traceability/scan/index` | 扫码溯源（相机扫描 + 手动输入） | P0 | ⬜ |
| `pages/traceability/batch-info/index` | 批次详情（时间线、原料、质检） | P0 | ⬜ |
| `pages/traceability/timeline/index` | 时间线详情页 | P1 | ⬜ |
| `pages/traceability/quality-report/index` | 质检报告详情 | P1 | ⬜ |

#### AI问答模块 (2页面)
| 路径 | 功能 | 优先级 | 状态 |
|-----|------|--------|------|
| `pages/ai-rag/chat/index` | 聊天界面（气泡、打字动画） | P1 | ⬜ |
| `pages/ai-rag/history/index` | 对话历史列表 | P2 | ⬜ |

#### 商家工作台模块 (7页面)
| 路径 | 功能 | 优先级 | 状态 |
|-----|------|--------|------|
| `pages/merchant-center/index/index` | 工作台首页（统计卡片、功能菜单） | P0 | ⬜ |
| `pages/merchant-center/orders/index` | 商家订单管理 | P0 | ⬜ |
| `pages/merchant-center/product-list/index` | 商品列表 | P0 | ⬜ |
| `pages/merchant-center/product-edit/index` | 发布/编辑商品 | P0 | ⬜ |
| `pages/merchant-center/staff/index` | 员工管理 | P2 | ⬜ |
| `pages/merchant-center/stats/index` | 数据统计 | P2 | ⬜ |
| `pages/merchant-center/settings/index` | 店铺设置 | P2 | ⬜ |

#### 推荐模块 (3页面)
| 路径 | 功能 | 优先级 | 状态 |
|-----|------|--------|------|
| `pages/referral/share/index` | 分享推荐（二维码、链接） | P2 | ⬜ |
| `pages/referral/my-referrals/index` | 我的推荐列表 | P2 | ⬜ |
| `pages/referral/rewards/index` | 奖励明细 | P2 | ⬜ |

#### 其他页面 (2页面)
| 路径 | 功能 | 优先级 | 状态 |
|-----|------|--------|------|
| `pages/auth/register/index` | 企业注册绑定 | P1 | ⬜ |
| `pages/orders/checkout/index` | 下单结算（地址、支付） | P0 | ⬜ |

---

### 修改现有页面 (6个)

#### 首页 `pages/home/index`
| 改动项 | 说明 | 状态 |
|-------|------|------|
| 添加启动广告弹窗 | 5秒倒计时、可关闭 | ⬜ |
| 改为黑金奢华风格 | UI 颜色调整 | ⬜ |
| 添加10个分类网格 | 替换现有分类展示 | ⬜ |
| 添加悬浮客服按钮 | 右下角悬浮 | ⬜ |

#### 商品详情 `pages/goods/goods-detail/index`
| 改动项 | 说明 | 状态 |
|-------|------|------|
| 添加阶梯定价表 | 显示价格梯度 | ⬜ |
| 添加数量选择Modal | 实时计算价格 | ⬜ |
| 添加"再买X个享优惠"提示 | 动态提示 | ⬜ |
| 添加溯源时间线入口 | 跳转溯源页 | ⬜ |
| 添加供货商卡片 | 评分、统计信息 | ⬜ |
| 添加AI分析入口 | 产品/工厂/行业分析 | ⬜ |

#### 商品列表 `pages/goods/goods-list/index`
| 改动项 | 说明 | 状态 |
|-------|------|------|
| 添加溯源标签显示 | 显示"可溯源"标签 | ⬜ |
| 显示阶梯价格 | "¥65起" 格式 | ⬜ |

#### 订单列表 `pages/order/order-list/index`
| 改动项 | 说明 | 状态 |
|-------|------|------|
| 添加溯源入口 | 订单卡片显示溯源按钮 | ⬜ |

#### 个人中心 `pages/user/user-center/index`
| 改动项 | 说明 | 状态 |
|-------|------|------|
| 添加推荐邀请入口 | 功能菜单项 | ⬜ |
| 添加咨询历史入口 | 功能菜单项 | ⬜ |
| 添加商家工作台入口 | 商家角色显示 | ⬜ |

#### 登录页 `pages/auth/login/index` (如有)
| 改动项 | 说明 | 状态 |
|-------|------|------|
| 添加用户类型识别 | 消费者/企业/商家 | ⬜ |

---

### 新增组件 (8个)

| 组件路径 | 功能 | 状态 |
|---------|------|------|
| `components/splash-ad/index` | 启动广告组件 | ⬜ |
| `components/price-tier-display/index` | 阶梯定价展示 | ⬜ |
| `components/quantity-modal/index` | 数量选择弹窗 | ⬜ |
| `components/timeline/index` | 溯源时间线 | ⬜ |
| `components/chat-bubble/index` | AI聊天气泡 | ⬜ |
| `components/merchant-card/index` | 商户信息卡片 | ⬜ |
| `components/quality-badge/index` | 质检徽章 | ⬜ |
| `components/evidence-gallery/index` | 现场实拍图集 | ⬜ |

---

### 新增 API 调用

```javascript
// utils/api.js 新增

// 溯源
const getBatchInfo = (batchNo) => request('/traceability/batch/' + batchNo);
const getTimeline = (batchId) => request('/traceability/timeline/' + batchId);
const getQualityReports = (batchId) => request('/traceability/quality-reports/' + batchId);

// AI问答
const sendChatMessage = (data) => request('/ai/chat', 'POST', data);
const getChatHistory = (sessionId) => request('/ai/history/' + sessionId);

// 广告
const getSplashAd = () => request('/advertisement/splash');
const recordAdClick = (adId) => request('/advertisement/click/' + adId, 'POST');

// 商户
const getMerchantInfo = (id) => request('/merchant/' + id);
const getMerchantProducts = (id) => request('/merchant/' + id + '/products');
const getMerchantOrders = () => request('/merchant/orders');
const updateProductStatus = (id, status) => request('/merchant/product/' + id + '/status', 'PUT', {status});

// 推荐
const getShareInfo = () => request('/referral/share-info');
const getMyReferrals = () => request('/referral/list');
const getRewards = () => request('/referral/rewards');

// 阶梯定价
const getPriceTiers = (spuId) => request('/goods/' + spuId + '/price-tiers');
const calculatePrice = (spuId, quantity) => request('/goods/' + spuId + '/calculate-price?qty=' + quantity);
```

---

### app.json 分包配置

```json
{
  "subPackages": [
    {
      "root": "pages/merchant-center",
      "pages": [
        "index/index",
        "orders/index",
        "product-list/index",
        "product-edit/index",
        "staff/index",
        "stats/index",
        "settings/index"
      ]
    },
    {
      "root": "pages/ai-rag",
      "pages": [
        "chat/index",
        "history/index"
      ]
    },
    {
      "root": "pages/traceability",
      "pages": [
        "scan/index",
        "batch-info/index",
        "timeline/index",
        "quality-report/index"
      ]
    },
    {
      "root": "pages/referral",
      "pages": [
        "share/index",
        "my-referrals/index",
        "rewards/index"
      ]
    }
  ]
}
```

---

## 三、UI 风格指南

### 黑金奢华设计系统

```css
/* 主色调 */
--color-primary: #C9A86C;        /* 金色 */
--color-primary-dark: #A68A4E;   /* 深金色 */
--color-bg-primary: #1A1A1A;     /* 黑色背景 */
--color-bg-secondary: #2D2D2D;   /* 次级背景 */
--color-text-primary: #FFFFFF;   /* 白色文字 */
--color-text-secondary: #B3B3B3; /* 灰色文字 */
--color-accent: #FFD700;         /* 强调金色 */

/* 状态色 */
--color-success: #4CAF50;        /* 成功绿 */
--color-warning: #FF9800;        /* 警告橙 */
--color-error: #F44336;          /* 错误红 */
--color-info: #2196F3;           /* 信息蓝 */

/* 圆角 */
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-full: 9999px;

/* 阴影 */
--shadow-card: 0 2px 8px rgba(0, 0, 0, 0.3);
--shadow-modal: 0 4px 20px rgba(0, 0, 0, 0.5);
```

---

## 四、开发顺序建议

### 第一阶段 (Week 1-2)
1. ⬜ 商户管理后台（list + review）
2. ⬜ 溯源批次管理后台（list + detail）
3. ⬜ 小程序首页改造（启动广告 + UI风格）
4. ⬜ 小程序商品详情改造（阶梯定价）

### 第二阶段 (Week 3-4)
5. ⬜ 小程序溯源模块（扫码 + 批次详情）
6. ⬜ 商家工作台（首页 + 订单 + 商品管理）
7. ⬜ 广告系统（后台 + 小程序展示）

### 第三阶段 (Week 5-6)
8. ⬜ AI问答模块（聊天界面 + 历史）
9. ⬜ 内容审核系统
10. ⬜ 推荐系统

---

## 五、测试检查清单

### 管理前端
- [ ] 商户列表筛选、分页正常
- [ ] 商户审核流程完整
- [ ] 溯源批次创建、编辑正常
- [ ] 时间线节点增删改正常
- [ ] 广告上下线正常
- [ ] 内容审核批量操作正常

### 小程序
- [ ] 启动广告展示、关闭正常
- [ ] 阶梯定价计算准确
- [ ] 数量选择Modal交互流畅
- [ ] 扫码溯源流程完整
- [ ] 批次详情展示完整
- [ ] AI对话功能正常
- [ ] 商家工作台权限隔离
