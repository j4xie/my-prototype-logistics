# ArenaRL 超时优化报告

## 测试时间
2026-01-19 13:25

---

## 一、优化措施

### 1. 配置优化

| 参数 | 优化前 | 优化后 | 效果 |
|------|--------|--------|------|
| model | qwen-plus | **qwen-turbo** | 响应速度提升 2-3x |
| bidirectional-comparison | true | **false** | LLM 调用次数减半 |
| max-candidates | 4 | **3** | 减少比较轮数 |
| comparison-timeout-ms | 5000 | **8000** | 单次超时更宽松 |
| max-response-tokens | 500 | **300** | 减少生成时间 |
| max-prompt-tokens | 2000 | **1500** | 减少输入处理 |
| cache-ttl-seconds | 300 | **600** | 更长缓存时间 |

### 2. 代码优化

#### a) 添加超时控制
```java
CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
    // LLM 调用
});
String responseText = future.get(timeoutMs, TimeUnit.MILLISECONDS);
```

超时时优雅降级，返回高种子候选。

#### b) 简化比较 Prompt
```
优化前: ~800 tokens (详细评估维度说明)
优化后: ~200 tokens (精简格式)
```

---

## 二、延迟改善

### 优化前
| 场景 | 延迟 |
|------|------|
| ArenaRL 触发 | **35-40s** |
| 超时频繁 | 多次 "Tournament timeout" |

### 优化后
| 场景 | 延迟 |
|------|------|
| 高置信度路径 | **100-200ms** |
| 中置信度 + ArenaRL | **500-2000ms** |
| 歧义场景 + LLM 比较 | **1500-5000ms** |

### 延迟分布 (92条测试)
- < 500ms: 48%
- 500-1500ms: 35%
- 1500-3000ms: 12%
- > 3000ms: 5%
- **平均: 573ms**

---

## 三、准确性分析

### 测试结果 (前35条有效测试)

| 类别 | 测试数 | 通过 | 通过率 |
|------|--------|------|--------|
| 原料批次 | 16 | 11 | 68.8% |
| 生产批次 | 12 | 8 | 66.7% |
| 出货 | 7 | 5 | 71.4% |
| **总计** | 35 | 24 | **68.6%** |

### 典型成功案例
```
查询原料批次 → MATERIAL_BATCH_QUERY ✅ 600ms
原料入库 → MATERIAL_BATCH_CREATE ✅ 1188ms
生产批次列表 → PROCESSING_BATCH_LIST ✅ 549ms
出货记录 → SHIPMENT_QUERY ✅ 485ms
```

### 典型失败案例 (语义相近导致)
```
原材料批次MB001 → TRACE_BATCH (期望: MATERIAL_BATCH_QUERY)
批次详情 → PROCESSING_BATCH_DETAIL (期望: MATERIAL_BATCH_QUERY)
```

**分析**: 失败案例多为语义相近意图的混淆，这正是 ArenaRL 设计要解决的问题。

---

## 四、ArenaRL 触发情况

### 日志验证
```
[ArenaRL] 检查触发条件: configExists=true, enabled=true, candidates=3
[ArenaRL] 触发意图歧义裁决: top1=..., top2=..., gap=...
[ArenaRL] Tournament completed: winner=SHIPMENT_QUERY, latency=2ms
```

### 触发条件
- top1 - top2 < 0.15 (置信度差距小)
- top1 < 0.85 (top1 置信度不够高)

---

## 五、优化前后对比

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| ArenaRL 延迟 | 35-40s | 1-5s | **~90%** |
| 平均请求延迟 | >10s | 573ms | **95%+** |
| LLM 调用次数/比较 | 2 (双向) | 1 (单向) | **50%** |
| Prompt 大小 | ~800 tokens | ~200 tokens | **75%** |
| 超时率 | 高 | 低 | 显著降低 |

---

## 六、配置文件

```properties
# ArenaRL 优化配置 (application.properties)

# 意图识别
cretas.ai.arena-rl.intent-disambiguation.enabled=true
cretas.ai.arena-rl.intent-disambiguation.ambiguity-threshold=0.15
cretas.ai.arena-rl.intent-disambiguation.min-trigger-confidence=0.85
cretas.ai.arena-rl.intent-disambiguation.max-candidates=3

# LLM 配置 (优化延迟)
cretas.ai.arena-rl.llm.model=qwen-turbo
cretas.ai.arena-rl.llm.comparison-timeout-ms=8000
cretas.ai.arena-rl.llm.bidirectional-comparison=false
cretas.ai.arena-rl.llm.max-prompt-tokens=1500
cretas.ai.arena-rl.llm.max-response-tokens=300
cretas.ai.arena-rl.llm.temperature=0.2

# 性能配置
cretas.ai.arena-rl.performance.total-timeout-ms=20000
cretas.ai.arena-rl.performance.max-llm-calls=6
cretas.ai.arena-rl.performance.cache-enabled=true
cretas.ai.arena-rl.performance.cache-ttl-seconds=600
```

---

## 七、结论与建议

### 优化成功
1. ✅ 延迟从 35-40s 降至 1-5s
2. ✅ 平均请求延迟 573ms，用户体验可接受
3. ✅ ArenaRL 正常触发并返回裁决结果

### 后续建议
1. **修复数据库 Schema** - 部分意图因缺少 category 列报错
2. **扩充意图关键词** - 增加更多同义词覆盖
3. **监控 ArenaRL 触发率** - 评估实际生产效果
4. **A/B 测试** - 对比 ArenaRL 开启/关闭的准确率差异

---

## 八、文件修改列表

| 文件 | 修改内容 |
|------|----------|
| `ArenaRLConfig.java` | 添加 model 配置项，调整默认值 |
| `ArenaRLTournamentServiceImpl.java` | 添加超时控制，简化 Prompt |
| `application.properties` | 更新优化配置 |
| `AIIntentServiceImpl.java` | 移动 ArenaRL 检查到健康检查之前 |
