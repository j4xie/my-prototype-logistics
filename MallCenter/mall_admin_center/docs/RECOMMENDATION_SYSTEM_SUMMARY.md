# 推荐系统实现总结

> 最后更新: 2025-12-27
> 状态: Phase 1 完成，数据收集中

---

## 1. 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        推荐系统架构                                  │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐     行为数据      ┌──────────────┐
│  小程序前端   │ ───────────────→ │ 行为追踪服务  │
│              │                   │ (Tracking)   │
└──────────────┘                   └──────┬───────┘
       │                                  │
       │ 请求推荐                          │ 更新兴趣
       ▼                                  ▼
┌──────────────┐                   ┌──────────────┐
│  推荐服务     │ ←───────────────  │ 用户画像     │
│ (Recommend)  │    兴趣标签       │ (Profile)    │
└──────┬───────┘                   └──────────────┘
       │
       │ 混合推荐 (20% 探索 + 80% 利用)
       ▼
┌──────────────────────────────────────────────────┐
│              探索算法 (A/B 测试)                   │
├─────────────────────┬────────────────────────────┤
│   LinUCB (50%)      │  Thompson Sampling (50%)   │
│   上下文感知        │  贝叶斯探索                 │
│   40维特征向量      │  Beta分布采样              │
│   MySQL持久化       │  Redis缓存                 │
└─────────────────────┴────────────────────────────┘
```

---

## 2. 核心组件

### 2.1 行为追踪 (UserBehaviorTrackingService)

**功能**: 记录用户行为，更新兴趣标签

| API 端点 | 说明 |
|---------|------|
| `POST /behavior/track` | 上报单个行为事件 |
| `POST /behavior/trackBatch` | 批量上报行为事件 |
| `POST /behavior/view/product` | 商品浏览事件 |
| `POST /behavior/search` | 搜索事件 |
| `POST /behavior/cart/add` | 加购事件 |
| `GET /behavior/interests/{wxUserId}` | 获取用户兴趣标签 |
| `GET /behavior/profile/{wxUserId}` | 获取用户画像 |

**行为类型权重**:
- `purchase`: 5.0 (购买)
- `cart_add`: 3.0 (加购)
- `click`: 2.0 (点击)
- `view`: 1.0 (浏览)
- `search`: 1.5 (搜索)

### 2.2 冷启动 (Cold Start)

**功能**: 新用户首次使用时收集偏好

| API 端点 | 说明 |
|---------|------|
| `GET /behavior/cold-start/check/{wxUserId}` | 检查是否需要显示弹窗 |
| `POST /behavior/cold-start/complete` | 完成冷启动偏好设置 |

**偏好选项**:
- 品类偏好 (海鲜、肉类、蔬菜、水果等)
- 价格区间 (经济、中档、高端)
- 品牌偏好

### 2.3 推荐服务 (RecommendationService)

**混合推荐策略**:
- 30% 基于内容推荐 (用户兴趣标签匹配)
- 25% 协同过滤推荐 (相似用户行为)
- 25% 热门推荐 (销量排序)
- 20% 强化学习探索 (A/B 测试算法)

| API 端点 | 说明 |
|---------|------|
| `GET /recommend/home/{wxUserId}` | 首页推荐 |
| `GET /recommend/youMayLike/{wxUserId}` | 猜你喜欢 |
| `GET /recommend/similar/{productId}` | 相似商品 |
| `POST /recommend/cart` | 购物车推荐 |
| `GET /recommend/popular` | 热门商品 |

### 2.4 探索算法

#### LinUCB (Linear Upper Confidence Bound)

**原理**: 上下文感知的多臂老虎机算法

**特征向量 (40维)**:
- 用户特征 (20维): 品类兴趣、价格偏好、活跃度等
- 商品特征 (20维): 品类、价格、销量、评分等

**UCB 计算公式**:
```
UCB = θᵀx + α√(xᵀA⁻¹x)
```

**参数持久化**: MySQL 表 `linucb_arm_parameters`

#### Thompson Sampling

**原理**: 贝叶斯探索，Beta 分布采样

**更新规则**:
- 正向反馈: α += 1
- 负向反馈: β += 1

**期望 CTR**: α / (α + β)

**参数存储**: Redis (30天过期)

---

## 3. A/B 测试设计

### 3.1 分流机制

**修复前** (有问题):
```java
// 每次请求随机分配，同一用户可能被分到不同组
if (random.nextDouble() < 0.5) {
    return linUCBExplorer;
}
```

**修复后** (正确):
```java
// 基于用户ID哈希，同一用户永远在同一组
int hash = Math.abs(wxUserId.hashCode() % 100);
return hash < 50 ? "linucb" : "thompson";
```

### 3.2 数据追踪

**日志字段**:
| 字段 | 说明 |
|------|------|
| `ab_test_group` | 分组: linucb / thompson |
| `explorer_algorithm` | 算法名称 |
| `is_clicked` | 是否点击 |
| `is_purchased` | 是否购买 |

**分析 SQL**:
```sql
SELECT
    ab_test_group,
    COUNT(*) as impressions,
    SUM(is_clicked) as clicks,
    SUM(is_purchased) as purchases,
    ROUND(SUM(is_clicked)/COUNT(*), 4) as ctr,
    ROUND(SUM(is_purchased)/COUNT(*), 4) as cvr
FROM recommendation_logs
WHERE ab_test_group IS NOT NULL
  AND create_time >= DATE_SUB(NOW(), INTERVAL 14 DAY)
GROUP BY ab_test_group;
```

---

## 4. 反馈机制

### 4.1 正向反馈

**触发条件**: 用户点击探索推荐的商品

**处理流程**:
1. 前端调用 `POST /behavior/view/product`
2. 后端检测是否为探索推荐 (Redis 标记)
3. 调用 `BanditExplorer.receiveReward(categoryId, 1.0)`
4. 更新算法参数

### 4.2 负向反馈

**触发条件**:
- 用户刷新推荐列表
- 用户离开页面
- 探索标记过期 (24小时)

**处理流程**:
1. 前端调用 `POST /behavior/ignored/{wxUserId}`
2. 后端获取未点击的探索推荐
3. 调用 `BanditExplorer.receiveReward(categoryId, 0.0)`
4. 清除探索标记

---

## 5. 数据存储

### 5.1 MySQL 表

| 表名 | 说明 |
|------|------|
| `user_behavior_events` | 用户行为事件 |
| `user_interest_tags` | 用户兴趣标签 |
| `user_recommendation_profiles` | 用户推荐画像 |
| `recommendation_logs` | 推荐日志 |
| `linucb_arm_parameters` | LinUCB 参数 |
| `linucb_exploration_logs` | 探索日志 |

### 5.2 Redis 缓存

| Key 模式 | TTL | 说明 |
|---------|-----|------|
| `rec:explore:{wxUserId}:{productId}` | 24h | 探索标记 |
| `ts:category:{categoryId}` | 30d | TS 参数 |
| `linucb:params:{categoryId}` | 10min | LinUCB 缓存 |
| `rec:home:{wxUserId}` | 5min | 推荐结果缓存 |

---

## 6. 后续计划

### Phase 2: A/B 测试分析 (2周后)

- 收集足够数据量
- 对比 LinUCB vs Thompson Sampling 的 CTR/CVR
- 确定最优算法

### Phase 3: 按需优化

- 如果 TS 胜出，添加 MySQL 持久化
- 如果效果相近，保留两者

### Phase 4: 自动训练管道

- Cron 定时任务 (每日凌晨2点)
- 自动导出训练数据
- LightGBM 模型训练
- 模型热加载
- 钉钉通知

**详细计划**: 见 `/Users/jietaoxie/.claude/plans/glistening-coalescing-crayon.md`

---

## 7. API 完整列表

### 行为追踪 API

```
POST /weixin/ma/behavior/track              # 上报单个事件
POST /weixin/ma/behavior/trackBatch         # 批量上报事件
POST /weixin/ma/behavior/view/product       # 商品浏览
POST /weixin/ma/behavior/search             # 搜索事件
POST /weixin/ma/behavior/cart/add           # 加购事件
GET  /weixin/ma/behavior/interests/{id}     # 用户兴趣
GET  /weixin/ma/behavior/profile/{id}       # 用户画像
GET  /weixin/ma/behavior/searchHistory/{id} # 搜索历史
GET  /weixin/ma/behavior/recentViewed/{id}  # 浏览历史
POST /weixin/ma/behavior/analyze/{id}       # 触发分析
GET  /weixin/ma/behavior/cold-start/check/{id}  # 冷启动检查
POST /weixin/ma/behavior/cold-start/complete    # 完成冷启动
POST /weixin/ma/behavior/ignored/{id}       # 处理忽略推荐
```

### 推荐 API

```
GET  /weixin/ma/recommend/home/{wxUserId}       # 首页推荐
GET  /weixin/ma/recommend/youMayLike/{wxUserId} # 猜你喜欢
GET  /weixin/ma/recommend/similar/{productId}   # 相似商品
POST /weixin/ma/recommend/cart                  # 购物车推荐
GET  /weixin/ma/recommend/popular               # 热门商品
POST /weixin/ma/recommend/refresh/{wxUserId}    # 刷新推荐
```

---

## 8. 测试验证

### 验证 A/B 分流稳定性

```bash
# 同一用户多次请求，应该在同一组
for i in 1 2 3; do
  curl -s "http://localhost:7500/weixin/ma/recommend/home/test_user_001?limit=3"
done

# 检查数据库
SELECT DISTINCT ab_test_group FROM recommendation_logs
WHERE wx_user_id = 'test_user_001';
# 应该只有一个值
```

### 验证反馈机制

```bash
# 1. 获取推荐
curl -s "http://localhost:7500/weixin/ma/recommend/home/test_user?limit=5"

# 2. 模拟点击 (正向反馈)
curl -X POST "http://localhost:7500/weixin/ma/behavior/view/product" \
  -H "Content-Type: application/json" \
  -d '{"wxUserId":"test_user","productId":"P001","source":"exploration"}'

# 3. 模拟忽略 (负向反馈)
curl -X POST "http://localhost:7500/weixin/ma/behavior/ignored/test_user"
```

---

## 9. 性能指标

| 指标 | 目标值 | 当前状态 |
|------|--------|---------|
| 推荐响应时间 | < 200ms | ✅ ~150ms |
| 日志批量插入 | 1次DB操作 | ✅ 已优化 |
| 缓存命中率 | > 80% | 待测量 |
| A/B 分流准确性 | 100% | ✅ 已验证 |

---

*文档版本: 1.0 | 作者: Claude Code*
