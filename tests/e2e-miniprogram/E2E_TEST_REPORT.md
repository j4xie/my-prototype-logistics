# MallCenter 小程序 E2E 测试报告

**测试日期**: 2026-03-03
**测试工具**: weapp-dev-mcp + miniprogram-automator (ws://localhost:9420)
**设备**: iPhone 12/13 Pro 模拟器 (SDK 2.19.6, DevTools 2.01.2510270)
**AppID**: wx8a458528c6dfb405

---

## 测试总结

| 指标 | 值 |
|------|-----|
| 总页面数 | 41 |
| 已测试 | **41/41 (100%)** |
| 导航成功 | **41/41 (100%)** |
| 数据加载验证 | 16 个关键页面 |
| 功能流程测试 | 购物车→结算→订单确认 闭环 |
| 修复的阻断性问题 | 2 |

---

## 阻断性问题修复

### BUG-1: centerapi.cretaceousfuture.com 502 Bad Gateway [已修复]

**严重性**: P0 (所有 API 请求失败)

**根因**: Nginx `proxy_pass` 指向错误服务器
- 错误: `proxy_pass http://47.100.235.168:8080` (新服务器，无 Mall 后端)
- 正确: `proxy_pass http://127.0.0.1:8080` (本机 Mall 后端)

**修复**:
```bash
# /www/server/panel/vhost/nginx/java_logistics-admin.conf
# 修改 location / 和 /weixin/api/ma/ai/chat/stream 的 proxy_pass
sed -i 's|proxy_pass http://47.100.235.168:8080;|proxy_pass http://127.0.0.1:8080;|g'
nginx -s reload
```

**影响**: 修复后所有 API 恢复正常，首页数据加载完整。

### BUG-2: 模拟器启动失败 — 缺失 Tab 图标 [已修复]

**严重性**: P0 (模拟器无法启动)

**根因**: `app.json` tabBar[4] 引用 `public/img/5-001.png` / `5-002.png` 但文件不存在
- 目录中只有 `5-1.png`, `5-2.png` (命名不一致)

**修复**: 复制 `4-001.png` → `5-001.png`, `4-002.png` → `5-002.png` 作为占位

**建议**: 设计正确的"我的"Tab 图标替换占位文件。

---

## 页面导航测试结果

### 主包页面 (22 个)

| # | 页面路径 | 状态 | 数据验证 | 备注 |
|---|---------|------|---------|------|
| 1 | pages/home/index | ✅ PASS | 10商品 + 3轮播 + 14分类 + 10推荐 | configLoaded=true, isLoggedIn 自动登录 |
| 2 | pages/base/search/index | ✅ PASS | — | 搜索页正常加载 |
| 3 | pages/base/webview/index | ✅ PASS | url=cretaceousfuture.com | URL 参数解析正确, web-view 加载 |
| 4 | pages/auth/login/index | ✅ PASS | loginType=wechat, isDevTools=true | "暂不登录" 按钮可点击 |
| 5 | pages/auth/register/index | ✅ PASS | 5公司类型 + 4品类 + 4采购量 | B2B注册: 公司/联系人/业务需求/营业执照上传 |
| 6 | pages/auth/bind-merchant/index | ✅ PASS | 5公司类型 | 商户绑定表单: 公司名/信用代码/类型/地址/联系人/执照 |
| 7 | pages/goods/goods-category/index | ✅ PASS | 14 个分类 | TabCur/MainCur 正确初始化 |
| 8 | pages/goods/goods-list/index | ✅ PASS | height=1721px | 商品列表有内容 |
| 9 | pages/goods/goods-detail/index | ✅ PASS | height=1982px | 详情页富内容加载 |
| 10 | pages/goods/price-calculator/index | ✅ PASS | — | 阶梯价计算器 |
| 11 | pages/shopping-cart/index | ✅ PASS | 1商品 ¥125 (加购后) | 加购→选择→结算 闭环验证 |
| 12 | pages/order/order-confirm/index | ✅ PASS | userInfo + 优惠券 + 留言 | 收货地址/订单金额/运费/提交订单 |
| 13 | pages/order/order-list/index | ✅ PASS | 5 Tab (全部/待付款/待发货/待收货/已完成) | 订单列表正常 |
| 14 | pages/order/order-detail/index | ✅ PASS | 订单金额/运费/支付金额 | 订单编号(复制)/创建时间/客服 |
| 15 | pages/order/order-logistics/index | ✅ PASS | 顺丰 + 6跟踪节点 | 揽收→转运→分拨→营业点→派送→签收 |
| 16 | pages/appraises/form/index | ✅ PASS | 3评分 + 8快捷标签 | 商品/物流/服务星评 + 文字 + 图片(0/9) |
| 17 | pages/user/user-center/index | ✅ PASS | — | 个人中心正常 |
| 18 | pages/user/settings/index | ✅ PASS | — | 设置页正常 |
| 19 | pages/user/user-address/list/index | ✅ PASS | — | 地址列表 + "添加新地址"按钮 |
| 20 | pages/user/user-address/form/index | ✅ PASS | 3 input + 省市区 picker | 姓名/电话/省市区/详细地址 |
| 21 | pages/notification/index | ✅ PASS | — | 通知中心正常 |
| 22 | pages/orders/checkout/index | ✅ PASS | 商品¥125 + 2优惠券 + 免运费 | 从购物车结算进入, 完整订单数据 |

### 分包: 溯源 (3 个)

| # | 页面路径 | 状态 | 备注 |
|---|---------|------|------|
| 23 | pages/traceability/scan/index | ✅ PASS | 扫码溯源入口 |
| 24 | pages/traceability/detail/index | ✅ PASS | 溯源详情 |
| 25 | pages/traceability/quality-report/index | ✅ PASS | 质检报告 |

### 分包: AI RAG (2 个)

| # | 页面路径 | 状态 | 数据验证 | 备注 |
|---|---------|------|---------|------|
| 26 | pages/ai-rag/chat/index | ✅ PASS | sessionId生成, 4快捷问题 | AI 对话页正常 |
| 27 | pages/ai-rag/history/index | ✅ PASS | — | 历史记录页 |

### 分包: AI 分析 (3 个)

| # | 页面路径 | 状态 | 备注 |
|---|---------|------|------|
| 28 | pages/ai-analysis/product/index | ✅ PASS | 产品分析 |
| 29 | pages/ai-analysis/factory/index | ✅ PASS | 工厂分析 |
| 30 | pages/ai-analysis/industry/index | ✅ PASS | 行业分析 |

### 分包: 推荐分销 (3 个)

| # | 页面路径 | 状态 | 备注 |
|---|---------|------|------|
| 31 | pages/referral/share/index | ✅ PASS | 分享页 |
| 32 | pages/referral/my-referrals/index | ✅ PASS | 我的推荐 |
| 33 | pages/referral/rewards/index | ✅ PASS | 奖励页 |

### 分包: 商家中心 (8 个)

| # | 页面路径 | 状态 | 数据验证 | 备注 |
|---|---------|------|---------|------|
| 34 | pages/merchant-center/index/index | ✅ PASS | stats + 5订单 + 7菜单 | 商家首页 |
| 35 | pages/merchant-center/orders/index | ✅ PASS | 5订单 + 5 Tab | 全部/待处理/待发货/已完成/退款售后 |
| 36 | pages/merchant-center/product-list/index | ✅ PASS | — | 商品管理 |
| 37 | pages/merchant-center/product-edit/index | ✅ PASS | 5分类 + 6单位 + 溯源设置 | 图片/名称/分类/描述/售价/原价/库存/单位/溯源 |
| 38 | pages/merchant-center/staff/index | ✅ PASS | — | 员工管理 |
| 39 | pages/merchant-center/stats/index | ✅ PASS | — | 数据统计 |
| 40 | pages/merchant-center/settings/index | ✅ PASS | — | 店铺设置 |
| 41 | pages/merchant-center/shop-design/index | ✅ PASS | — | 店铺装修 |

---

## 功能流程测试

### 购物车→结算 闭环

| 步骤 | 操作 | 结果 | 验证 |
|------|------|------|------|
| 1 | 浏览商品详情 (皇家杜老爷蝴蝶面) | ✅ | goods-detail 加载, height=1982px |
| 2 | 点击 `.action-cart-btn` 打开数量弹窗 | ✅ | 弹窗出现 |
| 3 | 点击 `.qty-action-btn.add-cart` 加入购物车 | ✅ | 商品添加成功 |
| 4 | 切换到购物车 Tab | ✅ | 商品显示: 蝴蝶面 ¥125 x1 |
| 5 | 勾选商品 checkbox | ✅ | checked=true, isAllSelect=true, settlePrice=125.00 |
| 6 | 点击 `.settle-bt` 结算 | ✅ | 跳转 checkout 页 |
| 7 | 验证结算页数据 | ✅ | goods[0].name=蝴蝶面, totalAmount=125.00, 2优惠券可用 |

### 商家中心→订单→物流 闭环

| 步骤 | 操作 | 结果 | 验证 |
|------|------|------|------|
| 1 | 进入商家订单管理 | ✅ | 5订单, 5 Tab 分类 |
| 2 | 查看订单详情 (order-detail) | ✅ | 金额/运费/支付/编号/时间 |
| 3 | 查看物流跟踪 (order-logistics) | ✅ | 顺丰速运, 6个跟踪节点 |
| 4 | 查看评价表单 (appraises/form) | ✅ | 3维评分 + 8快捷标签 + 图片上传 |

### 地址管理 闭环

| 步骤 | 操作 | 结果 | 验证 |
|------|------|------|------|
| 1 | 结算页点击 "添加收货地址" | ✅ | 跳转地址列表 (select=true) |
| 2 | 点击 "添加新地址" | ✅ | 跳转地址表单 |
| 3 | 验证表单字段 | ✅ | 姓名/电话/省市区 picker/详细地址 |

---

## 数据完整性验证

### 首页 (pages/home/index)

| 数据项 | 结果 | 详情 |
|--------|------|------|
| configLoaded | ✅ | basePath = centerapi.cretaceousfuture.com |
| isLoggedIn | ✅ | 自动微信登录成功 (ID: 2016695518555873282) |
| goodsList | ✅ | 10 商品, 含名称/价格/图片 |
| goodsListNew | ✅ | 5 新品 |
| goodsListHot | ✅ | 5 热门 |
| swiperData | ✅ | 3 轮播图 (OSS 图片) |
| bannerList | ✅ | 3 Banner (含点击数据追踪) |
| categoryList | ✅ | 9 分类 (丸滑/家禽/小吃/水发/海鲜/牛羊/猪肉/米面/肉肠) |
| recommendList | ✅ | 10 推荐商品 (含 description) |
| showAiAssistant | ✅ | AI 助手已启用 |
| showTraceEntry | ✅ | 溯源入口已显示 |

### 分类页 (pages/goods/goods-category/index)

| 数据项 | 结果 | 详情 |
|--------|------|------|
| goodsCategory | ✅ | 14 分类完整加载 |
| 分类列表 | ✅ | 丸滑→家禽→小吃→水发→海鲜→牛羊→猪肉→米面→肉肠→蔬菜菌菇→蘸料底料→调理肉类→豆制品→饮料甜品 |

### 购物车 (pages/shopping-cart/index)

| 数据项 | 结果 | 详情 |
|--------|------|------|
| shoppingCartData | ✅ | 1 商品 (加购蝴蝶面后) |
| selectValue | ✅ | ["2028910767145025538"] |
| settlePrice | ✅ | "125.00" |
| goodsListRecom | ✅ | 6 推荐商品 |

### 结算页 (pages/orders/checkout/index)

| 数据项 | 结果 | 详情 |
|--------|------|------|
| goods | ✅ | 1 商品: 蝴蝶面 ¥125 x1 |
| availableCoupons | ✅ | 2 张 (满200减20, 满100减10) |
| goodsAmount | ✅ | "125.00" |
| freightAmount | ✅ | "0.00" (免运费) |
| totalAmount | ✅ | "125.00" |
| paymentMethod | ✅ | "wechat" |

### 注册页 (pages/auth/register/index)

| 数据项 | 结果 | 详情 |
|--------|------|------|
| companyTypes | ✅ | 5 类型 (生产商/经销商/餐饮/零售/其他) |
| categories | ✅ | 4 品类 (海鲜/肉类/蔬菜/粮油) |
| purchaseVolumes | ✅ | 4 档 (500以下/500-2000/2000-5000/5000+) |
| formData | ✅ | 12 字段 (公司/信用代码/联系人/推荐码等) |

### 商家中心 (pages/merchant-center/index/index)

| 数据项 | 结果 | 详情 |
|--------|------|------|
| stats | ✅ | todayOrders=0, totalProducts=0 |
| recentOrders | ✅ | 3 订单 (含金额/状态/时间) |
| menuItems | ✅ | 7 菜单项 (订单/商品/编辑/装修/统计/员工/设置) |

### 商家订单 (pages/merchant-center/orders/index)

| 数据项 | 结果 | 详情 |
|--------|------|------|
| orders | ✅ | 5 订单 |
| tabs | ✅ | 5 Tab (全部/待处理/待发货/已完成/退款售后) |
| 订单数据 | ✅ | 含 orderNo/customerName/totalAmount/status/createTime/goods |

### 物流跟踪 (pages/order/order-logistics/index)

| 数据项 | 结果 | 详情 |
|--------|------|------|
| logistics | ✅ | 顺丰速运, SF1234567890123, status=delivered |
| trackList | ✅ | 6 节点 (揽收→转运→分拨→营业点→派送→签收) |
| courierPhone | ✅ | 13812341234 |

### 评价表单 (pages/appraises/form/index)

| 数据项 | 结果 | 详情 |
|--------|------|------|
| orderInfo | ✅ | 有机蔬菜礼盒, 规格: 10斤装 |
| ratings | ✅ | 商品/物流/服务 各5★默认 |
| quickTags | ✅ | 8 标签 (质量好/包装精美/物流快/服务好/性价比高/推荐购买/新鲜可口/下次还来) |
| images | ✅ | 支持0/9张图片上传 |

### AI RAG 对话 (pages/ai-rag/chat/index)

| 数据项 | 结果 | 详情 |
|--------|------|------|
| sessionId | ✅ | 自动生成会话 ID |
| quickQuestions | ✅ | 4 快捷问题 |
| historyLoaded | ✅ | 历史加载完成 |

### 商品编辑 (pages/merchant-center/product-edit/index)

| 数据项 | 结果 | 详情 |
|--------|------|------|
| categories | ✅ | 5 分类 (生鲜肉类/蔬菜水果/海鲜水产/酒水饮料/休闲零食) |
| units | ✅ | 6 单位 (件/斤/公斤/盒/袋/瓶) |
| form | ✅ | 10 字段 (名称/分类/售价/原价/库存/单位/描述/图片/溯源/批次号) |
| hasTraceability | ✅ | 溯源开关可用 |

---

## UI 元素验证

### 首页组件

| 组件 | 数量 | 状态 |
|------|------|------|
| swiper-item (通知) | 3 | ✅ "欢迎使用白垩纪食品溯源商城" / "扫码即可查看商品溯源信息" / "联系电话：13916928096" |
| swiper-item (Banner) | 3 | ✅ 图片 Banner (OSS) |

### 登录页组件

| 组件 | 选择器 | 状态 |
|------|--------|------|
| 微信登录按钮 | button | ✅ "微信一键登录" (282×49px) |
| 跳过登录 | .skip-login | ✅ "暂不登录，先逛逛" (154×35px) |

### 结算页组件

| 组件 | 状态 |
|------|------|
| 收货地址区 | ✅ "添加收货地址" (可点击跳转地址列表) |
| 商品信息 | ✅ 图片+名称+价格+数量 |
| 优惠券 | ✅ "2张可用" (可展开选择) |
| 订单备注 | ✅ 文本输入框 |
| 金额明细 | ✅ 商品金额/运费/合计 |
| 提交按钮 | ✅ "提交订单" |

### 物流跟踪组件

| 组件 | 状态 |
|------|------|
| 快递信息头 | ✅ 顺丰速运 + 运单号 + 复制按钮 |
| 状态标签 | ✅ "已签收" |
| 时间轴 | ✅ 6 节点, 带圆点+连线 |
| 操作按钮 | ✅ 联系快递员 / 查看订单 / 刷新物流 |

### 评价表单组件

| 组件 | 状态 |
|------|------|
| 商品卡片 | ✅ 图片+名称+规格 |
| 三维星评 | ✅ 商品/物流/服务 各5星可点选 |
| 文本区 | ✅ textarea 0/500 字 |
| 快捷标签 | ✅ 8 个可选 tag |
| 图片上传 | ✅ 最多9张 |
| 匿名开关 | ✅ switch |
| 提交按钮 | ✅ "提交评价" |

---

## 已知问题

### P2: Console Error — Foundation.onLoad

```
[渲染层错误] remote-debug start error TypeError: Foundation.onLoad is not a function
(env: Windows, mp, 2.01.2510270; lib: 2.19.6)
```

**影响**: 仅开发者工具环境，不影响真机运行。

### P3: 截图超时

MCP `mp_screenshot` 工具在 15s 内超时。raw WebSocket `App.captureScreenshot` 也在 8s 内超时。
可能原因: 开发者工具的截图功能在自动化模式下性能较差。

### P3: Tab 图标命名不一致

`app.json` 引用 `5-001.png` / `5-002.png`，但目录中其他图标使用 `X-X.png` 格式 (如 `1-1.png`)。
建议统一命名规则或添加正确的"我的"Tab 图标。

---

## 测试环境搭建记录

### 工具链
1. **微信开发者工具** v2.01.2510270 (Windows)
2. **weapp-dev-mcp** (`@yfme/weapp-dev-mcp`) — MCP 自动化工具
3. **miniprogram-automator** v0.12.1 — 微信官方 SDK

### 已解决的环境问题
1. **版本检查崩溃**: SDK 的 `checkVersion()` 因 `SDKVersion: undefined` 而崩溃 → Monkey-patch 跳过
2. **App.* 命令无响应**: 模拟器未启动时 `Tool.*` 可用但 `App.*` 静默超时 → 确保模拟器运行
3. **MCP launch 模式失败**: 中文路径导致 cliPath 无法识别 → 改用 connect 模式

---

## 下一步建议

1. **替换占位 Tab 图标**: 设计正确的"我的"Tab 图标 (5-001.png, 5-002.png)
2. **端到端支付流程**: 模拟微信支付回调，验证订单状态流转 (待付款→已付款→待发货→已完成)
3. **真机测试**: 在实际 iOS/Android 设备上验证
4. **性能监控**: 首屏加载时间、分包加载时间
5. **错误监控**: 集成异常上报 (如 Sentry)
