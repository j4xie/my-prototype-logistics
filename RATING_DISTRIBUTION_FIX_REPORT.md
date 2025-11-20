# Rating Distribution 序列化问题修复报告

**时间**: 2025-11-20 03:00
**状态**: ✅ 代码修复完成，⏳ 等待编译测试

---

## 问题分析

### 根本原因

**JSON序列化失败**：
- ❌ **问题**: Map中包含null key导致JSON序列化时抛出异常
- 📊 **影响端点**:
  - `GET /suppliers/rating-distribution` - 供应商评级分布
  - `GET /customers/rating-distribution` - 客户评级分布
  - `GET /reports/business-overview` - 业务概览报表

### 错误流程

1. **数据库查询**:
   ```sql
   SELECT s.rating, COUNT(s) FROM Supplier s
   WHERE s.factoryId = :factoryId
   GROUP BY s.rating
   ```
   - 如果某些供应商/客户的rating字段为null
   - GROUP BY会返回null作为一个分组

2. **代码处理** (修复前):
   ```java
   for (Object[] row : distribution) {
       Integer rating = (Integer) row[0];  // 可能是null!
       Long count = (Long) row[1];
       result.put(rating, count);  // null key进入Map
   }
   ```

3. **JSON序列化失败**:
   - Spring Boot尝试将Map序列化为JSON
   - JSON不允许null作为对象key
   - 抛出序列化异常，API返回500错误

### 测试验证

假设数据库有以下数据：
```
| rating | count |
|--------|-------|
| NULL   | 3     |  ← 3个未评级供应商
| 1      | 2     |
| 2      | 5     |
| 3      | 8     |
| 4      | 6     |
| 5      | 4     |
```

**修复前返回**:
```json
❌ 500 Internal Server Error (JSON序列化失败)
```

**修复后返回**:
```json
{
  "code": 200,
  "data": {
    "0": 3,   ← 未评级归类为0
    "1": 2,
    "2": 5,
    "3": 8,
    "4": 6,
    "5": 4
  }
}
```

---

## 修复内容

### 修复策略

**方案**: 过滤null rating，将其归类为"未评级"（rating=0）

**优点**：
- ✅ 避免JSON序列化失败
- ✅ 保留数据完整性（未评级记录不会丢失）
- ✅ 前端可以清楚区分"未评级"和"1星"
- ✅ 提供完整的0-5分评级分布

### 1. SupplierServiceImpl修复

**文件**: `/backend-java/src/main/java/com/cretas/aims/service/impl/SupplierServiceImpl.java`
**方法**: `getSupplierRatingDistribution`
**行数**: 257-279

**修改内容**:
```java
// 修复前
for (Object[] row : distribution) {
    Integer rating = (Integer) row[0];
    Long count = (Long) row[1];
    result.put(rating, count);  // ❌ null key!
}
for (int i = 1; i <= 5; i++) {  // ❌ 缺少0
    result.putIfAbsent(i, 0L);
}

// 修复后
for (Object[] row : distribution) {
    Integer rating = (Integer) row[0];
    Long count = (Long) row[1];
    if (rating != null) {  // ✅ 过滤null
        result.put(rating, count);
    } else {
        log.warn("发现未评级的供应商，数量: {}", count);
        result.put(0, result.getOrDefault(0, 0L) + count);  // ✅ 归类为0
    }
}
for (int i = 0; i <= 5; i++) {  // ✅ 包含0-5
    result.putIfAbsent(i, 0L);
}
```

### 2. CustomerServiceImpl修复

**文件**: `/backend-java/src/main/java/com/cretas/aims/service/impl/CustomerServiceImpl.java`
**方法**: `getCustomerRatingDistribution`
**行数**: 286-307

**修改内容**: 与SupplierServiceImpl相同逻辑

### 3. ReportServiceImpl修复

**文件**: `/backend-java/src/main/java/com/cretas/aims/service/impl/ReportServiceImpl.java`
**方法**: `getBusinessOverviewReport`
**行数**: 492-527

**修改内容**:
```java
// 供应商评级分布
List<Object[]> supplierRating = supplierRepository.getSupplierRatingDistribution(factoryId);
Map<Integer, Long> supplierRatingDistribution = new HashMap<>();
for (Object[] row : supplierRating) {
    Integer rating = (Integer) row[0];
    Long count = (Long) row[1];
    if (rating != null) {  // ✅ 过滤null
        supplierRatingDistribution.put(rating, count);
    } else {
        supplierRatingDistribution.put(0, supplierRatingDistribution.getOrDefault(0, 0L) + count);
    }
}
// 确保所有评级都有值
for (int i = 0; i <= 5; i++) {
    supplierRatingDistribution.putIfAbsent(i, 0L);
}

// 客户评级分布（相同逻辑）
...
```

---

## 测试计划

修复完成后需要测试以下端点：

### Supplier Rating Distribution
- [ ] GET `/api/mobile/CRETAS_2024_001/suppliers/rating-distribution`
  - **期望**: 返回200，data包含0-5的完整评级分布
  - **验证**: 所有key为非null整数

### Customer Rating Distribution
- [ ] GET `/api/mobile/CRETAS_2024_001/customers/rating-distribution`
  - **期望**: 返回200，data包含0-5的完整评级分布
  - **验证**: 所有key为非null整数

### Business Overview Report
- [ ] GET `/api/mobile/CRETAS_2024_001/reports/business-overview`
  - **期望**: 返回200，包含supplierRatingDistribution和customerRatingDistribution字段
  - **验证**: 两个字段都是完整的0-5评级分布

### 数据验证

**测试数据准备**:
```sql
-- 创建包含null rating的测试数据
UPDATE suppliers SET rating = NULL WHERE id IN (1, 2, 3);
UPDATE customers SET rating = NULL WHERE id IN (1, 2);

-- 验证查询结果
SELECT rating, COUNT(*) FROM suppliers
WHERE factory_id='CRETAS_2024_001'
GROUP BY rating;
-- 应该看到NULL值的分组
```

**API测试**:
```bash
# 测试供应商评级分布
curl -s "http://localhost:10010/api/mobile/CRETAS_2024_001/suppliers/rating-distribution" | jq

# 期望输出：
{
  "code": 200,
  "message": "success",
  "data": {
    "0": 3,  # 未评级
    "1": 2,
    "2": 5,
    "3": 8,
    "4": 6,
    "5": 4
  }
}
```

---

## 影响分析

### 后向兼容性

**✅ 完全兼容**：
- 修复前：如果没有null rating，行为不变
- 修复后：只是增加了对null rating的处理

### 前端影响

**需要注意**：
- 前端原本只处理1-5分（5个值）
- 修复后返回0-5分（6个值）
- **建议**: 前端UI显示时，将rating=0显示为"未评级"或"待评级"

**示例前端处理**:
```typescript
const ratingLabels = {
  0: '未评级',
  1: '⭐ 1星',
  2: '⭐⭐ 2星',
  3: '⭐⭐⭐ 3星',
  4: '⭐⭐⭐⭐ 4星',
  5: '⭐⭐⭐⭐⭐ 5星'
};

// 渲染评级分布
Object.entries(ratingDistribution).map(([rating, count]) => (
  <div key={rating}>
    {ratingLabels[rating]}: {count}人
  </div>
));
```

---

## 预期结果

修复后：
- ✅ 所有rating-distribution端点返回200状态码
- ✅ 返回的Map不包含null key
- ✅ 未评级的供应商/客户归类为rating=0
- ✅ JSON序列化成功
- ✅ 数据完整性保持（不丢失未评级记录）
- ✅ 前端获得完整的0-5评级分布

---

## 文件清单

修改的文件：
1. `/backend-java/src/main/java/com/cretas/aims/service/impl/SupplierServiceImpl.java`
2. `/backend-java/src/main/java/com/cretas/aims/service/impl/CustomerServiceImpl.java`
3. `/backend-java/src/main/java/com/cretas/aims/service/impl/ReportServiceImpl.java`

修改方法数: 4个方法
- SupplierServiceImpl.getSupplierRatingDistribution
- CustomerServiceImpl.getCustomerRatingDistribution
- ReportServiceImpl.getBusinessOverviewReport (2处)

---

## 下一步行动

1. **立即**: 等待编译问题解决（与Equipment、Timeclock API一起编译）
2. **编译成功后**: 准备测试数据（包含null rating的记录）
3. **测试**: 验证3个受影响端点
4. **验证**: 确认前端能正确显示0-5分的评级分布
5. **继续**: 进入Phase B (P1高优先级修复)

---

**报告生成**: 2025-11-20 03:00:00
**修复工程师**: Claude Code
**优先级**: P0 (紧急)
**状态**: ✅ 代码修复完成，等待编译
