# MallCenter 小程序装修系统能力边界分析

## 执行摘要

当前装修系统**仅实现主题颜色切换**（约占完整装修的 20%）。后端数据模型已预留 modulesConfig/bannerConfig/logoUrl 等字段但前端未消费。核心瓶颈在前端：首页 WXML 硬编码布局，无动态模块渲染。建议分三期推进：快速修补（通知/Logo/完整主题）→ 模块化改造 → AI 增强。但需注意：食品溯源商城不需要有赞级自由度，"换色+换Logo+改文字+调Banner" 可能已覆盖 80% 真实需求。

---

## 一、能力矩阵

| 装修维度 | 后端支持 | 前端支持 | 当前状态 | 改造难度 |
|---------|---------|---------|---------|---------|
| **主题颜色切换** | ✅ 完整(12色JSON) | ✅ CSS变量(65%) | ✅ 已实现 | — |
| **店铺名称/宣传语** | ✅ shopName/slogan字段 | ❌ 硬编码 | ⚠️ 后端有前端没用 | < 0.5天 |
| **通知栏文字** | ✅ noticeTexts字段 | ❌ WXML写死3条 | ⚠️ 后端有前端没用 | < 0.5天 |
| **Logo 更换** | ✅ logoUrl字段 | ✅ 已绑定(刚改) | ⚠️ 需上传能力 | 0.5天 |
| **Banner 管理** | ✅ bannerConfig字段(未用) + 广告接口 | ⚠️ 广告接口驱动 | ⚠️ 有两套体系未统一 | 1天 |
| **模块显隐控制** | ⚠️ feature-config独立接口 | ⚠️ 布尔开关(3个) | ⚠️ 分散在两套系统 | 0.5天 |
| **模块排序/增删** | ✅ modulesConfig字段(NULL) | ❌ 完全无渲染逻辑 | ❌ 空壳 | 2-3天 |
| **商品卡片样式** | ❌ 无字段 | ❌ 硬编码 | ❌ 未实现 | 1-2天 |
| **自定义页面背景** | ❌ 无字段 | ❌ 硬编码 #f5f5f5 | ❌ 未实现 | 0.5天 |
| **AI对话改布局** | ❌ action不支持 | ❌ 无处理逻辑 | ❌ 未实现 | 3天+ |

---

## 二、后端已有但前端未消费的字段

| 字段 | 类型 | DB列存在 | API返回 | 前端消费 | 状态 |
|------|------|---------|---------|---------|------|
| themeCode | String | ✅ | ✅ | ✅ | 完整 |
| customTheme | JSON | ✅ | ✅ | ✅ | 完整 |
| shopName | String | ✅ | ✅ | ❌ | **断裂** |
| slogan | String | ✅ | ✅ | ❌ | **断裂** |
| noticeTexts | JSON | ✅ | ✅ | ❌ | **断裂** |
| logoUrl | String | ✅ | ✅(刚加) | ✅(刚改) | 需上传 |
| modulesConfig | JSON | ✅ | ❌(返回[]) | ❌ | **空壳** |
| bannerConfig | JSON | ✅ | ❌ | ❌ | **空壳** |
| pageConfig | JSON | ✅ | ❌ | ❌ | **空壳** |
| templateId | Long | ✅ | ❌ | ❌ | 未启用 |

---

## 三、前端硬编码盘点

### 首页模块结构（固定顺序，不可重排）
```
1. 顶部导航栏 (logo + 搜索)          — 硬编码
2. 通知栏 (3条固定文字)               — 硬编码 ⚠️ noticeTexts未消费
3. Banner 轮播                        — 广告接口驱动
4. 食品分类网格                       — wx:if开关，内容API驱动
5. 快捷功能 (扫码溯源 + AI助手)       — 硬编码
6. 热销单品                           — wx:if开关，内容API驱动
7. 好物探店/猜你喜欢                  — wx:if开关，内容API驱动
8. AI浮动按钮                         — wx:if开关
```

### 硬编码颜色（35%未var化）
- 白色背景: `#fff` (多处)
- 价格红色: `#e74c3c`
- AI按钮蓝: `linear-gradient(#1890ff, #096dd9)`
- 搜索框边框: `rgba(212,175,55,0.3)`
- 推荐标签: `linear-gradient(#ff6b6b, #ee5a5a)`

---

## 四、AI对话扩展性评估

### 当前CHAT_SYSTEM_PROMPT支持的action
| Action | 功能 | 前端处理 |
|--------|------|---------|
| recommend | 推荐主题 | 渲染themeCard |
| apply | 应用主题 | 写DB + 显示成功卡 |
| update_info | 修改店名/宣传语 | 写DB |
| none | 普通对话 | 仅显示文字 |

### 扩展新action的改动链
每新增一个action需要修改 **4处**：
1. `CHAT_SYSTEM_PROMPT` — 添加action说明和JSON字段
2. `decorationChat()` — 后端解析新action并执行
3. `chatFallback()` — 添加关键词匹配降级
4. `decoration-chat/index.js` — 前端渲染新action的UI组件

### 可扩展的action（可行性排序）
| 新Action | 难度 | 说明 |
|----------|------|------|
| update_notice | 低 | 修改通知栏文字，复用update_info模式 |
| update_logo | 中 | 需要图片上传能力（小程序chooseImage → 上传 → 返回URL） |
| update_banner | 中 | 需要图片URL列表管理 |
| reorder_modules | 高 | 自然语言描述排序效率低，需动态模块渲染支持 |
| change_layout | 高 | 需要预定义布局模板 + 前端动态渲染引擎 |

### Critic观点：对话式 vs 可视化
业界共识（有赞/微盟/Shopify）：**布局操作用可视化编辑器，AI 辅助提建议**。
- "把Banner移到分类下面" → 拖拽操作2秒，自然语言描述效率极低
- "推荐个适合我行业的主题" → 对话式效率高，AI 擅长
- **建议**：颜色/文字/Logo 用 AI 对话，布局/模块排序用 shop-design 可视化

---

## 五、分期实施建议

### Phase 1: 快速修补（1-2天）— 打通已有字段

| 任务 | 工作量 | 说明 |
|------|--------|------|
| 通知栏动态化 | 2h | WXML读取data.noticeTexts，loadPageConfig()提取noticeTexts |
| 店名/宣传语动态化 | 2h | WXML绑定shopName/slogan，loadPageConfig()提取 |
| shop-design保存完整主题 | 1h | 从只存2色改为存完整themeConfig |
| themes.js统一数据源 | 1h | shop-design引用themes.js，删除getDefaultThemes() |
| 剩余35%硬编码颜色var化 | 2h | 价格红→var(--price-color)，白色背景→var(--card-bg)等 |
| AI对话增加update_notice | 2h | PROMPT+后端解析+前端显示 |

**产出**：装修可控制 = 主题颜色 + 店名 + 宣传语 + 通知文字 + Logo

### Phase 2: 功能增强（3-5天）— 补全常用能力

| 任务 | 工作量 | 说明 |
|------|--------|------|
| Logo上传能力 | 4h | 小程序chooseImage→后端接收→存OSS→写logoUrl |
| Banner配置 | 8h | bannerConfig字段启用，CRUD管理，首页读取替代广告接口 |
| 模块显隐统一 | 4h | 将feature-config合并到MerchantPageConfig，一处管理 |
| 页面背景色/图 | 2h | 新增backgroundColor到CSS变量体系 |
| 预览真实化 | 8h | shop-design预览使用真实首页数据+缩放渲染 |

**产出**：覆盖80%商户实际装修需求

### Phase 3: 模块化改造（5-10天）— 如果确有需求

| 任务 | 工作量 | 说明 |
|------|--------|------|
| 动态模块渲染引擎 | 16h | WXML模板化，wx:for遍历modulesConfig，每个模块type对应template |
| 模块排序拖拽UI | 8h | shop-design添加拖拽排序交互 |
| AI对话布局建议 | 8h | 仅推荐模块组合，实际操作仍在shop-design |
| 自定义模块 | 16h | 富文本/图文/自定义HTML模块 |

**注意**：Phase 3 需先评估ROI——食品溯源商城的商户是否真的需要模块重排？

---

## 六、共识与分歧

### 团队共识（置信度 90%+）
1. **Phase 1 投入产出比最高** — 打通已有字段只需1-2天，立即可见效果
2. **shop-design 主题保存需修复** — 只存2色是明显bug，应存完整themeConfig
3. **themes.js 需统一** — 两套独立维护的主题数据是技术债
4. **AI 对话适合颜色/文字，不适合布局** — 业界验证的结论

### 分歧点
1. **@Anonymous 安全风险**：研究员认为高风险，批评者认为小程序环境相对安全。建议：至少加微信登录态校验
2. **dynamicModules 是否应该实现**：研究员认为是空壳需补，批评者认为可能是故意预留、当前固定布局已够用。建议：Phase 1/2不动，Phase 3评估需求后决定
3. **"完整装修"的定义**：不应盲目追求有赞/Shopify级别的自由度，食品溯源商城的核心价值不在装修花样

---

## 七、关键开放问题

1. **商户真实需求**：是否有商户反馈"我想重新排列首页模块"？如果没有，Phase 3可以不做
2. **图片上传**：OSS配置是否已就绪？logo/banner上传需要对象存储
3. **多商户隔离**：当前merchantId=null（全局默认），未来是否需要每个商户独立装修？
4. **装修版本管理**：是否需要"发布/回滚"机制？当前只有一份配置，改了就生效

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (后端/前端/AI对话)
- Browser explorer: OFF
- Total sources found: 17 codebase files + industry references
- Key disagreements: 2 resolved (安全风险→加登录态; dynamicModules→延后评估), 1 unresolved (完整装修定义)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Healer: All checks passed ✅
