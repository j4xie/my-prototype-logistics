---
name: performance-audit
description: 分析后端性能问题，检测 N+1 查询、无分页查询、全表扫描、AI 服务超时等。使用此 Skill 来评估系统性能瓶颈、检测数据库查询问题、或优化 API 响应时间。
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# 后端性能审计 Skill

基于 BACKEND_AUDIT_REPORT.md 的分析，专注于识别和修复 Spring Boot 后端性能问题。

## 性能问题分类

| 问题类型 | 严重程度 | 影响 |
|----------|----------|------|
| N+1 查询 | 高 | 100 用户 = 101 次数据库查询 |
| 无分页 findAll() | 高 | 全表加载，内存溢出 |
| LIKE %keyword% | 中 | 无法使用索引，全表扫描 |
| AI 服务同步阻塞 | 高 | 线程池耗尽，服务不可用 |
| 巨型 Service 类 | 中 | 难以维护和测试 |

## 系统承载能力评估

| 指标 | 当前估计 | 瓶颈原因 |
|------|---------|---------|
| 并发用户数 | 50-100 | AI 同步调用阻塞 |
| QPS (普通接口) | 100-200 | N+1 查询、无缓存 |
| QPS (AI接口) | 5-10 | 同步等待 2-10秒 |
| 数据量上限 | 10万条/表 | findAll() 全表加载 |

---

## 检查命令

### 1. N+1 查询检测

已知问题位置：
- `MobileServiceImpl.java:990-995` - 人员统计循环查询
- `MobileServiceImpl.java:1061-1064` - 工时排行循环查询
- `MobileServiceImpl.java:1141-1142` - 加班统计循环查询
- `MobileServiceImpl.java:1228-1231` - 人员绩效循环查询
- `MobileServiceImpl.java:1621-1623` - 告警转换循环查询

```bash
# 检测 for 循环中的 repository 调用
cd /Users/jietaoxie/my-prototype-logistics/backend-java

# 查找循环内的数据库查询
grep -rn "for\s*(" src/main/java/ --include="*.java" | \
  while read line; do
    file=$(echo "$line" | cut -d: -f1)
    linenum=$(echo "$line" | cut -d: -f2)
    # 检查后续 10 行是否有 repository 调用
    sed -n "${linenum},$((linenum+10))p" "$file" | grep -q "repository\|Repository" && echo "$line"
  done

# 简化版：直接搜索
grep -rn "for.*{" src/main/java/com/cretas/aims/service/ --include="*.java" -A10 | \
  grep -B5 "repository\|Repository" | head -50
```

### 2. 无分页 findAll() 检测

已知问题位置：
- `PlatformServiceImpl:50-52` - `factoryRepository.findAll()`
- `AIReportScheduler:61-63` - `findAll().stream().filter()`
- `FactoryServiceImpl:38-40` - `findAll()`

```bash
# 查找所有 findAll() 调用
grep -rn "\.findAll()" src/main/java/ --include="*.java"

# 检查是否有分页参数
grep -rn "\.findAll()" src/main/java/ --include="*.java" | \
  grep -v "Pageable\|PageRequest"
```

### 3. LIKE 全表扫描检测

已知问题位置：
- `CustomerRepository:49` - `LIKE %:keyword%`
- `SupplierRepository:49` - `LIKE %:keyword%`
- `FactoryRepository:41-43` - `LIKE + CONCAT`
- `MaterialBatchRepository:126` - `LIKE %:keyword%`
- `UserRepository:73-75` - `LIKE %:keyword%`

```bash
# 查找左模糊匹配（无法使用索引）
grep -rn "LIKE %:" src/main/java/ --include="*.java"
grep -rn "LIKE CONCAT('%'" src/main/java/ --include="*.java"

# 应该使用右模糊（可以使用索引）
# LIKE CONCAT(:keyword, '%')
```

### 4. AI 服务性能检测

问题位置：
- `AIAnalysisService.java:36-38` - RestTemplate 无超时配置
- `AIAnalysisService.java:103-104` - 同步阻塞调用

```bash
# 检查 RestTemplate 配置
grep -rn "RestTemplate" src/main/java/ --include="*.java" -A5 | head -30

# 检查超时配置
grep -rn "timeout\|Timeout\|TIMEOUT" src/main/java/ --include="*.java"

# 检查异步调用
grep -rn "@Async" src/main/java/ --include="*.java"
```

### 5. 巨型类检测

```bash
# 统计 Service 实现类行数
wc -l src/main/java/com/cretas/aims/service/impl/*.java | sort -rn | head -10

# 统计 Controller 行数
wc -l src/main/java/com/cretas/aims/controller/*.java | sort -rn | head -10

# 建议：单个类不超过 500 行
```

### 6. Redis 缓存使用检测

```bash
# 检查缓存注解使用
grep -rn "@Cacheable\|@CacheEvict\|@CachePut" src/main/java/ --include="*.java"

# 检查 Redis 配置
grep -rn "RedisAutoConfiguration" src/main/resources/

# 当前状态：Redis 被禁用
# application.properties:51
# spring.autoconfigure.exclude=...RedisAutoConfiguration
```

---

## 性能修复建议

### 修复 N+1 查询

```java
// ❌ 问题代码 - N+1 查询
for (User user : allUsers) {
    List<TimeClockRecord> records = timeClockRecordRepository
        .findByFactoryIdAndUserId(factoryId, user.getId());
    // 100 用户 = 100 次数据库查询
}

// ✅ 修复 - 批量查询
List<Long> userIds = allUsers.stream()
    .map(User::getId)
    .collect(Collectors.toList());

List<TimeClockRecord> allRecords = timeClockRecordRepository
    .findByFactoryIdAndUserIdIn(factoryId, userIds);

Map<Long, List<TimeClockRecord>> recordsByUser = allRecords.stream()
    .collect(Collectors.groupingBy(TimeClockRecord::getUserId));
```

### 修复无分页查询

```java
// ❌ 问题代码
List<Factory> all = factoryRepository.findAll();

// ✅ 修复 - 添加分页
Page<Factory> page = factoryRepository.findAll(PageRequest.of(0, 100));
```

### 修复 LIKE 全表扫描

```java
// ❌ 问题代码 - 左模糊无法使用索引
@Query("SELECT c FROM Customer c WHERE c.name LIKE %:keyword%")

// ✅ 修复 - 右模糊可以使用索引
@Query("SELECT c FROM Customer c WHERE c.name LIKE CONCAT(:keyword, '%')")
```

### 修复 AI 服务超时

```java
// ❌ 问题代码 - 无超时配置
this.restTemplate = new RestTemplate();

// ✅ 修复 - 添加超时
@Bean
public RestTemplate restTemplate() {
    HttpComponentsClientHttpRequestFactory factory =
        new HttpComponentsClientHttpRequestFactory();
    factory.setConnectTimeout(5000);   // 连接超时 5秒
    factory.setReadTimeout(30000);     // 读取超时 30秒
    return new RestTemplate(factory);
}

// ✅ 更好的方案 - 异步调用
@Async
public CompletableFuture<AIResponse> analyzeAsync(String prompt) {
    return CompletableFuture.supplyAsync(() -> {
        return restTemplate.postForObject(url, request, AIResponse.class);
    });
}
```

---

## 快速诊断脚本

```bash
#!/bin/bash
# performance-check.sh - 后端性能快速诊断

cd /Users/jietaoxie/my-prototype-logistics/backend-java

echo "=== 1. N+1 查询风险 ==="
grep -rn "for.*{" src/main/java/com/cretas/aims/service/ -A5 | \
  grep -c "repository\|Repository"

echo ""
echo "=== 2. 无分页 findAll() ==="
grep -rn "\.findAll()" src/main/java/ --include="*.java" | \
  grep -v "Pageable" | wc -l

echo ""
echo "=== 3. 左模糊 LIKE ==="
grep -rn "LIKE %:" src/main/java/ --include="*.java" | wc -l

echo ""
echo "=== 4. 巨型类 (>500行) ==="
wc -l src/main/java/com/cretas/aims/service/impl/*.java | \
  awk '$1 > 500 {print}'

echo ""
echo "=== 5. 缓存使用 ==="
grep -rn "@Cacheable" src/main/java/ --include="*.java" | wc -l

echo ""
echo "=== 6. 异步调用 ==="
grep -rn "@Async" src/main/java/ --include="*.java" | wc -l
```

---

## 参考文档

- 完整审计报告: `backend-java/BACKEND_AUDIT_REPORT.md`
- 项目规范: `CLAUDE.md`
