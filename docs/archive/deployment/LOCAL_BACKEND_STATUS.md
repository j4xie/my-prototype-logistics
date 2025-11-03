# 本地Java后端对接状态报告

## ✅ 已完成的工作

### 1. 本地MySQL数据库
- ✅ MySQL 9.3.0 运行中
- ✅ 创建了数据库 `cretas`
- ✅ 创建了用户 `cretas`/`sYyS6Jp3pyFMwLdA`

### 2. Java后端启动
- ✅ Spring Boot应用成功启动
- ✅ 端口: `10010`
- ✅ 日志文件: `~/Downloads/cretas-backend-system-main/logs/startup.log`
- ✅ 启动信息: "白垩纪食品溯源系统启动成功！"

### 3. 数据库表结构
- ✅ 所有表由JPA自动创建
- ✅ 手动添加了 `users.role_code` 字段
- ✅ 工厂F001已创建
- ✅ 5个工厂用户已创建
- ✅ 3个平台管理员已创建

### 4. User实体修改
- ✅ 修改了 `/Users/jietaoxie/Downloads/cretas-backend-system-main/src/main/java/com/cretas/aims/entity/User.java`
- ✅ 添加了 `roleCode` 字段
- ✅ 更新了 `getRole()` 方法
- ✅ 重新编译了项目

---

## ❌ 当前问题：密码验证失败

### 问题描述
所有登录请求都返回 `400 - 用户名或密码错误`

```json
{
    "code": 400,
    "message": "用户名或密码错误",
    "data": null,
    "timestamp": "2025-11-02T22:14:24.153141",
    "success": false
}
```

### 根本原因
初始SQL中使用的BCrypt hash是**无效的**：

```python
# 验证结果
old_hash = "$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW"
bcrypt.checkpw("123456".encode(), old_hash.encode())
# 结果: False  ❌
```

### 尝试的解决方案
1. 生成新的BCrypt hash: `$2b$12$ARTuOPpJyXgzZtidbigOpumtka9ND00xpI.gf7QSmn1UbLFl1cSr.`
2. 更新了所有用户的password_hash
3. 但登录仍然失败

### 可能的原因
1. **Hash版本不匹配**: `$2a$` vs `$2b$` 前缀可能有兼容性问题
2. **数据库更新未生效**: 可能UPDATE语句没有正确执行
3. **Spring Security配置**: BCryptPasswordEncoder版本或配置问题

---

## 🔧 建议的解决方案

### 方案1: 使用Java代码生成hash（推荐）

在Spring Boot后端创建一个临时接口生成hash：

```java
// 添加临时Controller
@RestController
@RequestMapping("/api/test")
public class TestController {

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    @GetMapping("/generate-hash")
    public String generateHash(@RequestParam String password) {
        return passwordEncoder.encode(password);
    }
}
```

然后访问: `http://localhost:10010/api/test/generate-hash?password=123456`

### 方案2: 直接在后端代码中临时禁用密码验证

修改 `MobileServiceImpl.java`:

```java
// 临时注释掉密码验证
// if (!passwordEncoder.matches(password, user.getPassword())) {
//     throw new BusinessException("用户名或密码错误");
// }

// 临时直接通过
log.warn("⚠️ 临时跳过密码验证！");
```

### 方案3: 使用明文密码进行测试

暂时修改后端使用明文密码验证，确认其他逻辑正常后再改回加密验证。

---

## 📋 测试账号信息

### 工厂用户
| 用户名 | 密码 | 工厂ID | 角色 | 部门 |
|--------|------|--------|------|------|
| `proc_admin` | `123456` | `F001` | department_admin | processing |
| `perm_admin` | `123456` | `F001` | permission_admin | management |
| `farm_admin` | `123456` | `F001` | department_admin | farming |
| `logi_admin` | `123456` | `F001` | department_admin | logistics |
| `proc_user` | `123456` | `F001` | operator | processing |

### 平台管理员
| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `123456` | PLATFORM_SUPER_ADMIN |
| `developer` | `123456` | SYSTEM_DEVELOPER |
| `platform_admin` | `123456` | PLATFORM_SUPER_ADMIN |

---

## 🚀 下一步行动

### 立即操作（三选一）

**选项1**: 添加临时测试接口生成正确的hash
```bash
# 1. 添加TestController
# 2. 重启后端
# 3. 访问接口获取正确的hash
# 4. 更新数据库
```

**选项2**: 临时禁用密码验证，先验证其他功能
```bash
# 1. 修改MobileServiceImpl.java注释掉密码验证
# 2. 重新编译mvn clean package -DskipTests
# 3. 重启后端
# 4. 测试登录
```

**选项3**: 切换到远程服务器（如果可用）
```bash
# 修改前端配置指向远程服务器
# 让远程服务器管理员执行SQL初始化
```

---

## 📁 相关文件位置

### Java项目
- **项目路径**: `~/Downloads/cretas-backend-system-main/`
- **JAR文件**: `target/cretas-backend-system-1.0.0.jar`
- **配置文件**: `src/main/resources/application.yml`
- **User实体**: `src/main/java/com/cretas/aims/entity/User.java`
- **登录Service**: `src/main/java/com/cretas/aims/service/impl/MobileServiceImpl.java`

### 日志和数据
- **启动日志**: `logs/startup.log`
- **数据库**: `localhost:3306/cretas`
- **MySQL用户**: `cretas` / `sYyS6Jp3pyFMwLdA`

### 前端配置
- **配置文件**: `/Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace/src/constants/config.ts`
- **当前API地址**: `http://139.196.165.140:10010` (远程服务器)
- **本地地址应该是**: `http://localhost:10010`

---

## 💡 推荐方案

**立即执行**: 采用**方案2 - 临时禁用密码验证**

### 原因
1. ✅ 最快速 - 只需修改一行代码
2. ✅ 可验证其他功能 - Dashboard API等
3. ✅ 可以先对接前端 - 验证整体流程
4. ✅ 后续可以回头修复密码问题

### 具体步骤
```bash
# 1. 修改密码验证逻辑
vim ~/Downloads/cretas-backend-system-main/src/main/java/com/cretas/aims/service/impl/MobileServiceImpl.java
# 找到密码验证部分，注释掉并添加临时通过逻辑

# 2. 重新编译
cd ~/Downloads/cretas-backend-system-main
mvn clean package -DskipTests

# 3. 停止当前后端
lsof -ti :10010 | xargs kill -9

# 4. 启动新版本
java -jar target/cretas-backend-system-1.0.0.jar > logs/test.log 2>&1 &

# 5. 测试登录
curl -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"proc_admin","password":"123456","factoryId":"F001"}'
```

---

**最后更新**: 2025-11-02 22:15
**状态**: 后端启动成功，等待密码验证问题修复
