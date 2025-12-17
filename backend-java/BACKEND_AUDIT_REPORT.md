# Spring Boot 后端完整体检报告 — my-prototype-logistics (最新版本)

**分析日期**: 2025-12-12
**代码版本**: 最新 pull (含 Austin 分支合并、Qwen AI 模型、原材料三板块优化)

---

## 【后端总体风险概览】

### 最高风险点列表

| 风险等级 | 问题 | 影响 | 文件位置 |
|---------|------|------|---------|
| **P0 致命** | Spring Security 被完全禁用 | 任何人都可以访问任何 API | `application.properties:51` |
| **P0 致命** | JWT 密钥硬编码在源码中 | 可伪造任意用户 Token | `application.properties:40` |
| **P0 致命** | 文件上传路径穿越漏洞 | 可上传 webshell 或覆盖文件 | `MobileServiceImpl.java:326` |
| **P0 致命** | 数据库凭据硬编码 + 空密码 | 数据库完全暴露 | `application.properties:8-9` |
| **P0 致命** | JPA DDL-auto=update | 生产环境自动修改表结构 | `application.properties:13` |
| **P1 高危** | N+1 查询问题 (5处) | 性能严重下降，100用户=101次查询 | `MobileServiceImpl.java` |
| **P1 高危** | 21/25 Controller 缺少权限验证 | 水平权限提升 | 多个 Controller |
| **P1 高危** | AI 服务同步阻塞 + 无超时 | 线程池耗尽，服务不可用 | `AIAnalysisService.java:103` |
| **P2 中危** | 巨型 Service 类 (1923行) | 难以维护和测试 | `MobileServiceImpl.java` |
| **P2 中危** | Redis 被禁用 | 缓存失效，重复查询 | `application.properties:51` |

### 需要优先修复的 5 项

1. **启用 Spring Security** - 从 exclude 中移除 SecurityAutoConfiguration
2. **更换 JWT 密钥** - 使用环境变量 `${JWT_SECRET}`
3. **修复文件上传漏洞** - 添加路径验证、文件类型白名单
4. **修复 N+1 查询** - 改为批量查询或 JOIN
5. **添加 factoryId 权限验证** - 统一在拦截器中验证

### 可能导致未来推倒重写的结构性问题

1. **MobileServiceImpl 1923 行** - 包含 50+ 个不相关功能
2. **Controller 直接返回 Entity** - API 契约与数据库耦合
3. **内存存储关键数据** - 设备信息、验证码存在 ConcurrentHashMap
4. **无统一权限框架** - 权限验证分散在各处

---

## 【模块级诊断报告】

---

### 模块 1: 安全配置 (application.properties)

#### ① 发现的问题

**1.1 Spring Security 完全禁用 - CRITICAL**

**文件**: `application.properties:51`
```properties
spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration
```

**影响**: 所有 API 端点无任何认证保护，任何人可直接调用

---

**1.2 JWT 密钥硬编码 - CRITICAL**

**文件**: `application.properties:40`
```properties
cretas.jwt.secret=cretas-food-traceability-system-secret-key-2025-do-not-change-in-production
```

**影响**:
- 密钥在 Git 仓库中公开
- 任何人可伪造有效 JWT Token
- `JwtUtil.java:28` 还有默认密钥降级

---

**1.3 数据库凭据暴露 - CRITICAL**

**文件**: `application.properties:7-10`
```properties
spring.datasource.url=jdbc:mysql://localhost:3306/cretas_db?useUnicode=true...
spring.datasource.username=root
spring.datasource.password=
```

**影响**: root 账户 + 空密码，数据库完全暴露

---

**1.4 JPA DDL-auto=update - CRITICAL**

**文件**: `application.properties:13`
```properties
spring.jpa.hibernate.ddl-auto=update
```

**影响**: Hibernate 自动修改生产数据库表结构，可能导致数据丢失

---

#### ② 风险等级: **致命**

#### ③ 修复建议

```properties
# application.properties (开发环境)
spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration

# application-prod.properties (生产环境)
cretas.jwt.secret=${JWT_SECRET}
spring.datasource.username=${DB_USER}
spring.datasource.password=${DB_PASSWORD}
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=false

# 环境变量
export JWT_SECRET="$(openssl rand -base64 64)"
export DB_USER="cretas_app"
export DB_PASSWORD="secure-password-here"
```

---

### 模块 2: Controller 层 (25 个文件, 8653 行)

#### ① 发现的问题

**2.1 权限验证缺失 - CRITICAL**

只有 4 个 Controller 使用 @PreAuthorize:
- WhitelistController ✅
- WorkTypeController ✅
- DepartmentController ✅
- PlatformController ✅

**缺少权限验证的 21 个 Controller**:
- MobileController (670行, 15+ 端点) ❌
- ProcessingController (678行, 18+ 端点) ❌
- MaterialBatchController (920行, 20+ 端点) ❌
- AIController (409行, 8+ 端点) ❌
- UserController (314行, 8+ 端点) ❌
- EquipmentController (502行, 12+ 端点) ❌
- ... 等

---

**2.2 factoryId 参数未验证用户归属**

**示例** - `ProcessingController.java:67-72`:
```java
@PostMapping("/batches")
public ApiResponse<ProductionBatch> createBatch(
        @PathVariable String factoryId,  // 用户可自行修改
        @RequestBody ProductionBatch batch) {
    // 没有验证用户是否属于该工厂
    ProductionBatch result = processingService.createBatch(factoryId, batch);
    return ApiResponse.success(result);
}
```

**影响**: 用户可访问任意工厂的数据

---

**2.3 Controller 直接返回 Entity**

**示例** - `ProcessingController.java:67`:
```java
public ApiResponse<ProductionBatch> createBatch(...) {
    return ApiResponse.success(result);  // 返回 Entity，非 DTO
}
```

**影响**:
- 可能泄露敏感字段
- API 与数据库结构耦合

---

#### ② 风险等级: **高**

#### ③ 修复建议

```java
// 1. 添加统一权限验证拦截器
@Component
public class FactoryAccessInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, ...) {
        String factoryId = extractFactoryId(request);
        Integer userId = SecurityUtils.getCurrentUserId();
        if (!userBelongsToFactory(userId, factoryId)) {
            throw new AuthorizationException("无权访问此工厂");
        }
        return true;
    }
}

// 2. 添加 @PreAuthorize 注解
@PreAuthorize("hasAnyAuthority('factory_admin', 'supervisor')")
@PostMapping("/batches")
public ApiResponse<ProductionBatchDTO> createBatch(...) { }

// 3. 返回 DTO 而非 Entity
ProductionBatchDTO dto = mapper.toDTO(result);
return ApiResponse.success(dto);
```

---

### 模块 3: Service 层 (26 个实现类, 13646 行)

#### ① 发现的问题

**3.1 N+1 查询问题 - 5 处 HIGH**

| 位置 | 行号 | 问题代码 |
|------|------|---------|
| MobileServiceImpl | 990-995 | 人员统计：for 循环中查询打卡记录 |
| MobileServiceImpl | 1061-1064 | 工时排行：同上 |
| MobileServiceImpl | 1141-1142 | 加班统计：同上 |
| MobileServiceImpl | 1228-1231 | 人员绩效：同上 |
| MobileServiceImpl | 1621-1623 | 告警转换：循环中查询设备名称 |

**问题代码示例** (行 990-995):
```java
for (User user : allUsers) {
    // ❌ 100 个用户 = 100 次数据库查询
    List<TimeClockRecord> userRecords = timeClockRecordRepository
            .findByFactoryIdAndUserIdAndClockDateBetween(
                factoryId, Long.valueOf(user.getId()), startDateTime, endDateTime);
    allRecords.addAll(userRecords);
}
```

---

**3.2 巨型 Service 类**

| 文件 | 行数 | 方法数 | 职责数 |
|------|------|--------|--------|
| MobileServiceImpl | **1923** | 50+ | 12+ (登录、设备、仪表盘、文件、通知等) |
| ProcessingServiceImpl | **1285** | 30+ | 8+ |
| MaterialBatchServiceImpl | **1039** | 25+ | 6+ |
| ReportServiceImpl | **934** | 20+ | 5+ |

---

**3.3 文件上传路径穿越漏洞 - CRITICAL**

**文件**: `MobileServiceImpl.java:304-350`
```java
public MobileDTO.UploadResponse uploadFiles(List<MultipartFile> files, ...) {
    for (MultipartFile file : files) {
        // ❌ 直接使用原始文件名，可能包含 ../
        String filename = UUID.randomUUID().toString() + "_" + file.getOriginalFilename();
        // ❌ 没有路径规范化验证
        Path filepath = uploadDir.resolve(filename);
        file.transferTo(filepath.toFile());
    }
}
```

**攻击向量**: `filename = "../../etc/passwd"` 或 `"../webapp/shell.jsp"`

---

**3.4 内存存储关键数据**

**设备信息** (行 108):
```java
private final Map<Integer, List<MobileDTO.DeviceInfo>> userDevices = new ConcurrentHashMap<>();
```

**验证码** (行 800):
```java
private final Map<String, VerificationCodeData> verificationCodes = new ConcurrentHashMap<>();
```

**影响**:
- 服务重启数据丢失
- 不支持分布式部署
- 内存泄漏风险

---

#### ② 风险等级: **高**

#### ③ 修复建议

```java
// 1. 修复 N+1：批量查询
List<TimeClockRecord> allRecords = timeClockRecordRepository
    .findByFactoryIdAndUserIdInAndClockDateBetween(
        factoryId, userIds, startDateTime, endDateTime);

// 按用户分组
Map<Long, List<TimeClockRecord>> recordsByUser = allRecords.stream()
    .collect(Collectors.groupingBy(TimeClockRecord::getUserId));

// 2. 修复文件上传
String extension = getSecureExtension(file.getOriginalFilename());
if (!ALLOWED_EXTENSIONS.contains(extension)) {
    throw new BusinessException("不支持的文件类型");
}
String filename = UUID.randomUUID().toString() + "." + extension;
Path filepath = uploadDir.resolve(filename).normalize();
if (!filepath.startsWith(uploadDir.normalize())) {
    throw new SecurityException("非法的文件路径");
}

// 3. 数据持久化：迁移到 Redis 或数据库
@Autowired
private RedisTemplate<String, Object> redisTemplate;
```

---

### 模块 4: Repository 层 (39 个文件)

#### ① 发现的问题

**4.1 模糊搜索全表扫描**

| 文件 | 行号 | 搜索模式 |
|------|------|---------|
| CustomerRepository | 49 | `LIKE %:keyword%` |
| SupplierRepository | 49 | `LIKE %:keyword%` |
| FactoryRepository | 41-43 | `LIKE + CONCAT` |
| MaterialBatchRepository | 126 | `LIKE %:keyword%` |
| UserRepository | 73-75 | `LIKE %:keyword%` |

**示例** - `CustomerRepository.java:49`:
```java
@Query("SELECT c FROM Customer c WHERE c.factoryId = :factoryId " +
       "AND (c.name LIKE %:keyword% OR c.customerCode LIKE %:keyword%)")
List<Customer> findByNameOrCodeLike(...);
```

**影响**: 无法使用索引，全表扫描

---

**4.2 未分页的 findAll()**

| 文件 | 行号 | 问题 |
|------|------|------|
| PlatformServiceImpl | 50-52 | `factoryRepository.findAll()` |
| AIReportScheduler | 61-63 | `findAll().stream().filter()` |
| FactoryServiceImpl | 38-40 | `findAll()` |

---

#### ② 风险等级: **高**

#### ③ 修复建议

```java
// 1. 右模糊搜索（可用索引）
@Query("SELECT c FROM Customer c WHERE c.factoryId = :factoryId " +
       "AND (c.name LIKE CONCAT(:keyword, '%') OR c.customerCode LIKE CONCAT(:keyword, '%'))")

// 2. 添加分页
Page<Factory> findByIsActive(boolean isActive, Pageable pageable);

// 3. 数据库层过滤
List<Factory> findByIsActive(boolean isActive);  // 替代 findAll().filter()
```

---

### 模块 5: AI 服务集成

#### ① 发现的问题

**5.1 同步阻塞调用 + 无超时配置**

**文件**: `AIAnalysisService.java:36-38, 103-104`
```java
public AIAnalysisService() {
    this.restTemplate = new RestTemplate();  // ❌ 没有超时配置
}

@Value("${cretas.ai.service.timeout:30000}")
private int timeout;  // ❌ 定义了但没用

// 调用时同步阻塞
ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);
```

**影响**:
- AI 服务响应慢时，请求线程被阻塞
- 无超时，可能无限等待
- 高并发时 Tomcat 线程池耗尽

---

#### ② 风险等级: **高**

#### ③ 修复建议

```java
// 配置超时
@Bean
public RestTemplate restTemplate() {
    HttpComponentsClientHttpRequestFactory factory = new HttpComponentsClientHttpRequestFactory();
    factory.setConnectTimeout(5000);
    factory.setReadTimeout(timeout);
    return new RestTemplate(factory);
}

// 异步调用
@Async
public CompletableFuture<AIResponse> analyzeAsync(...) {
    return CompletableFuture.supplyAsync(() -> restTemplate.exchange(...));
}
```

---

## 【重点文件深度分析】

### 危险文件 Top 10

| # | 文件 | 行数 | 风险等级 | 主要问题 |
|---|------|------|---------|---------|
| 1 | `application.properties` | 51 | **致命** | Security禁用、JWT硬编码、DB空密码、DDL-auto |
| 2 | `MobileServiceImpl.java` | 1923 | **致命** | 文件上传漏洞、N+1查询x5、内存存储、巨型类 |
| 3 | `AIAnalysisService.java` | 335 | **高** | 同步阻塞、无超时配置 |
| 4 | `ProcessingController.java` | 678 | **高** | 无权限验证、返回Entity |
| 5 | `MaterialBatchController.java` | 920 | **高** | 无权限验证 |
| 6 | `JwtAuthInterceptor.java` | 78 | **高** | 无Token也放行 |
| 7 | `PlatformServiceImpl.java` | 273 | **中** | findAll() 无分页 |
| 8 | `AIReportScheduler.java` | 166 | **中** | findAll().filter() |
| 9 | `UserRepository.java` | 75 | **中** | 模糊搜索全表扫描 |
| 10 | `CustomerRepository.java` | 49 | **中** | 模糊搜索全表扫描 |

---

## 【总结：是否需要重构？】

### 1. 系统承载能力评估

| 指标 | 当前估计 | 瓶颈原因 |
|------|---------|---------|
| **并发用户数** | 50-100 | AI 同步调用阻塞 |
| **QPS (普通接口)** | 100-200 | N+1 查询、无缓存 |
| **QPS (AI接口)** | **5-10** | 同步等待 2-10秒 |
| **数据量上限** | 10万条/表 | findAll() 全表加载 |

### 2. 修复优先级

| 优先级 | 模块 | 原因 | 工作量 |
|--------|------|------|--------|
| **P0 立即** | application.properties | 安全致命，可被攻击 | 0.5天 |
| **P0 立即** | 文件上传漏洞 | 可上传 webshell | 1天 |
| **P0 本周** | 权限验证 | 数据泄露风险 | 3天 |
| **P1 本周** | N+1 查询 | 性能严重下降 | 2天 |
| **P1 本周** | AI 超时配置 | 服务可用性 | 0.5天 |
| **P2 本月** | Redis 启用 | 性能优化 | 1天 |
| **P2 本月** | Service 拆分 | 可维护性 | 5天 |
| **P2 本月** | Entity→DTO | API 稳定性 | 3天 |

### 3. 是否需要预备拆服务

**短期 (1-3个月)**: 不需要拆服务，但必须修复安全问题

**中期 (3-6个月)**: 建议拆分
- `AI分析服务` - 异步队列 + 独立部署
- `文件服务` - 独立存储
- `报表服务` - 独立计算

### 4. 总结

**当前状态**:
- 代码能跑，但**生产环境存在 5+ 个致命安全漏洞**
- Security 禁用 + JWT 公开 + 文件上传漏洞 = **系统可被完全控制**

**立即行动** (本周必须完成):
1. 启用 Spring Security
2. JWT 密钥迁移到环境变量
3. 修复文件上传路径穿越
4. 数据库密码不能为空
5. DDL-auto 改为 validate

**系统重构路线图**:
1. **Phase 1 (1周)**: 安全修复
2. **Phase 2 (2周)**: 性能优化 (N+1, 分页, Redis)
3. **Phase 3 (4周)**: 架构重构 (Service拆分, DTO)
4. **Phase 4 (持续)**: 监控、告警、CI/CD
