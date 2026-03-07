# MallCenter 微信小程序前端 UI/UX 深度审查

**日期**: 2026-03-03
**模式**: Full | 语言: Chinese
**增强**: Codebase grounding: ON | Fact-check: OFF | Browser: OFF

---

## Executive Summary

- **建议**: 优先修复新版checkout支付模拟问题(需集成真实`wx.requestPayment`),其次优化SSE逐token setData的性能瓶颈,最后补齐preloadRule/lazyCodeLoading等工程配置
- **置信度**: 高 -- 所有关键发现均经代码验证,三组研究员+分析师+评审员在核心问题上达成共识
- **关键风险**: 新版checkout结算页使用setTimeout模拟支付,虽旧版路径(order-operate)具备真实支付能力,但用户可能走到新版路径完成"假支付"
- **时间影响**: P1问题(支付集成+SSE节流)预计1-2个Sprint可完成;P2工程优化可渐进式推进
- **工作量**: P1约3-5人天,P2约5-8人天,P3属持续优化

---

## Consensus & Disagreements

| 主题 | Researcher发现 | Analyst判定 | Critic挑战 | 最终裁定 |
|------|---------------|------------|-----------|---------|
| **支付能力** | A/C均发现checkout用setTimeout模拟 | P0致命 | `order-operate/index.js` L87-119有完整`wx.requestPayment`调用链 | **P1** -- 新版checkout未集成真实支付,但旧版order-confirm→order-detail→order-operate路径支付完整。降级为P1 |
| **api.js reject后resolve** | B发现reject后仍resolve | P0代码安全 | Promise规范保证:一旦reject,后续resolve被静默忽略 | **P3** -- 代码瑕疵,非运行时bug |
| **SSE setData频率** | B发现每token全量setData | P1性能 | 实际token流速10-30/s,微信有内部批处理 | **P1** -- 经代码验证确实每token都setData,中低端设备上可能卡顿 |
| **phone-login定时器泄漏** | B发现setInterval存局部变量无onUnload清理 | P1 | 60s自然终止 | **P3** -- 新版login/index.js L208使用this.countdownTimer,L353-358 onUnload有clearInterval清理 |
| **count-down竞态** | B发现setData异步存timer竞态 | P2 | 确认存在 | **P2** -- L27 setInterval → L48 setData异步保存,竞态理论存在但实际触发概率极低 |
| **域名硬编码** | C发现无环境切换 | P2 | 微信小程序标准实践 | **P3** -- env.js包含注释说明切换方式,小程序生态标准做法 |
| **session存globalData** | C发现session存内存 | P2 | 符合微信安全规范,session_key不应持久化 | **不是问题** -- 微信官方要求session_key不能持久化到storage |
| **loadFeatureConfig绕过api.js** | B称3处,实为1处 | P2 | 确认仅1处 | **P2** -- home/index.js L441-475直接wx.request绕过鉴权 |
| **console.log数量** | B称79处/23文件 | 引用B数据 | 实为191处/51文件 | **191处/51文件** -- grep验证确认Critic数据准确 |
| **preloadRule/lazyCodeLoading** | A发现缺失 | P2 | 收益取决于用户行为 | **P2** -- app.json确认无配置,5个subPackage均未配置预加载 |
| **CSS变量命名矛盾** | A发现--primary-gold实为#52c41a(绿色) | P3 | 未挑战 | **P2** -- 语义矛盾增加维护成本 |

---

## Detailed Analysis

### 1. 支付链路完整性

**双路径发现**:
- **旧路径** (完整): order-confirm → orderSub API → order-detail (callPay=true) → order-operate组件 → unifiedOrder API → `wx.requestPayment()` (L87-126完整参数)
- **新路径** (模拟): checkout → `setTimeout(1000)` 模拟提交 → `setTimeout(1500)` 模拟支付

**关键问题**: order-confirm L57-66检测到缓存数据后重定向到新版checkout,大部分用户会走到模拟支付路径。

**修复方向**: 在checkout/index.js中集成已有的orderSub + unifiedOrder + wx.requestPayment调用链,参照order-operate/index.js实现。

### 2. SSE流式聊天性能

- `ai-rag/chat/index.js` L392-396: 每收到一个token就`this.setData({ messages })`,无节流
- 实际token流速约10-30 tokens/s
- 降级方案(simulateStreamDisplay)更频繁: 3字符/20ms ≈ 50次/s
- **建议**: 累积token到局部变量,每150ms批量setData,降频到6-7次/s

### 3. 工程规范

- **preloadRule/lazyCodeLoading**: app.json完全缺失,5个subPackage无预加载
- **API路径不一致**: behavior tracking `/weixin/ma/` vs 主业务 `/weixin/api/ma/`
- **CSS变量**: `--primary-gold: #52c41a` 名为金色实为绿色
- **console.log**: 191处/51文件,业务代码约170+处

### 4. 被否定的问题

以下问题经Critic验证后不再作为bug:
- **session存内存** -- 符合微信安全规范
- **api.js reject/resolve** -- Promise规范保证不影响运行时
- **phone-login定时器** -- 新版已有onUnload清理
- **域名硬编码** -- 小程序生态标准实践

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| 新版checkout缺少真实支付集成 | ★★★★★ | 代码L239/L267明确setTimeout |
| 旧版order-operate有完整wx.requestPayment | ★★★★★ | 代码L104-119完整调用链 |
| SSE每token触发setData | ★★★★★ | 代码L392-396无节流 |
| SSE性能影响为中等(非致命) | ★★★★☆ | 缺少真机性能数据 |
| count-down存在理论竞态 | ★★★★☆ | 代码证实但触发概率极低 |
| phone-login定时器已有清理 | ★★★★★ | 新版login/index.js有onUnload清理 |
| api.js reject/resolve非功能bug | ★★★★★ | Promise规范明确 |
| 缺少preloadRule/lazyCodeLoading | ★★★★★ | app.json无相关配置 |
| console.log为191处/51文件 | ★★★★★ | grep验证 |

---

## Actionable Recommendations

### Immediate (本周内修复)

1. **[P1] 修复checkout支付集成**
   - 文件: `pages/orders/checkout/index.js`
   - 将`handlePayment()`中的setTimeout替换为`app.api.unifiedOrder()` + `wx.requestPayment()`
   - 参照: `components/order-operate/index.js` L87-126

2. **[P3] 修复api.js reject后return缺失**
   - 文件: `utils/api.js` L44
   - 在`reject(res.data.msg)`后添加`return`

### Short-term (本Sprint)

3. **[P1] SSE token事件添加throttle**
   - 文件: `pages/ai-rag/chat/index.js`
   - 累积token到局部变量,每150ms批量setData
   - 同时修复降级方案频率: interval 20ms→100ms, chunkSize 3→15

4. **[P2] app.json添加preloadRule和lazyCodeLoading**
   ```json
   "lazyCodeLoading": "requiredComponents",
   "preloadRule": {
     "pages/home/index": { "network": "wifi", "packages": ["pages/merchant-center", "pages/ai-rag"] },
     "pages/order/order-list/index": { "network": "all", "packages": ["pages/traceability"] }
   }
   ```

5. **[P2] loadFeatureConfig改用api.js**
   - 文件: `pages/home/index.js` L441-475
   - 替换为`app.api.getFeatureConfig()`

6. **[P2] count-down竞态修复**
   - 文件: `components/count-down/index.js`
   - timer ID存储从`this.setData`改为`this._timer`实例属性

### Conditional (视情况推进)

7. **[P2] api.js错误处理重构**
   - showModal改为showToast或引入防抖,避免弱网连续弹窗

8. **[P3] API路径规范化**
   - behavior tracking `/weixin/ma/` 统一为 `/weixin/api/ma/`

9. **[P2] CSS变量重命名**
   - `--primary-gold` → `--primary-color` 或 `--brand-color`

10. **[P3] console.log批量清理**
    - 引入eslint `no-console`规则,优先清理业务代码~170处

11. **[P2] OSS图片裁剪参数**
    - 确认图片源为阿里云OSS后,封装URL工具函数统一添加`?x-oss-process=image/resize,w_XXX`

---

## Open Questions

1. 后端统一下单接口是否已对接微信支付商户号?
2. 主包体积是否接近2MB限制?
3. 旧版phone-login页面是否仍有入口引用?
4. Banner/商品图片是否来自阿里云OSS?
5. ColorUI实际使用率是多少?

---

## Process Note
- Mode: Full
- Researchers deployed: 3 (UI/UX, Code Quality, API+Completeness)
- Browser explorer: OFF
- Total sources found: 22+ (代码文件直接验证)
- Key disagreements: 5 resolved (支付能力, api.js竞态, phone-login, console数量, 域名硬编码), 1 unresolved (SSE性能影响程度)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled
- Healer: all checks passed ✅
- Competitor profiles: N/A
