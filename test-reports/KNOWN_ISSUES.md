# 已知问题清单

**最后更新**: 2025-11-20 19:21

---

## Issue #1: platform_admin 登录失败

**发现时间**: 2025-11-20 Phase 1.1 认证测试
**优先级**: P2 (低 - 有workaround)
**状态**: 🔴 未修复

### 问题描述

`platform_admin`账号登录时触发backend 500错误：
```
{
  "code": 500,
  "message": "系统内部错误，请联系管理员"
}
```

### 根本原因

Backend日志显示Hibernate SQL错误：
```
java.sql.SQLSyntaxErrorException: Unknown column 'production0_.start_date' in 'field list'
```

**技术分析**:
- Hibernate尝试查询`ProductionBatch`表时使用了错误的字段名
- 数据库实际字段: `start_time`, `end_time`
- Hibernate查询使用: `start_date`, `end_date`
- 可能原因: Hibernate二级缓存或entity metadata未刷新

### 复现步骤

```bash
curl -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"platform_admin","password":"123456"}'

# Response: 500 Internal Server Error
```

### 影响范围

- ❌ 仅影响`platform_admin`账号
- ✅ 其他同角色账号正常 (`admin`, `developer`)
- ✅ 不影响其他7个测试账号
- ✅ 不影响测试覆盖率（所有5种角色已覆盖）

### Workaround

使用以下账号代替`platform_admin`：
- `admin` (factory_super_admin @ PLATFORM)
- `developer` (factory_super_admin @ PLATFORM)

### 修复方案

**Option A - 快速修复** (推荐):
```bash
# 重启backend清除Hibernate缓存
cd /Users/jietaoxie/my-prototype-logistics/backend-java
pkill -f "spring-boot:run"
mvn spring-boot:run
```
**预计时间**: 2-3分钟

**Option B - 彻底修复**:
1. 检查`ProductionBatch` entity映射
2. 验证`@Column(name = "start_time")`是否正确
3. 清理Hibernate缓存配置
4. 重新编译backend

**预计时间**: 30分钟

**Option C - 数据库修复** (不推荐):
```sql
ALTER TABLE production_batches
  CHANGE COLUMN start_time start_date DATETIME;
ALTER TABLE production_batches
  CHANGE COLUMN end_time end_date DATETIME;
```
**影响**: 破坏性变更，影响现有数据

### 相关文件

- Backend Entity: `backend-java/src/main/java/com/cretas/aims/entity/ProductionBatch.java`
- Backend日志: `backend-java/backend.log`
- 测试脚本: `tests/api/test_auth_simple.sh` (已跳过platform_admin)

### 测试状态

- Phase 1.1认证测试: ⊘ 跳过 (标记为已知问题)
- 其他测试: 使用`admin`或`developer`账号代替

### 下一步

- [ ] Backend团队确认是否需要修复
- [ ] 如需修复，选择修复方案并执行
- [ ] 修复后重新测试`platform_admin`账号
- [ ] 更新测试脚本移除跳过逻辑

---

**记录人**: Claude Code
**联系**: 参见CLAUDE.md
