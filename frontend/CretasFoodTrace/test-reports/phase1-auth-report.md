# Phase 1 认证测试报告

**生成时间**: 2025-11-20 19:10:42
**Backend**: http://localhost:10010
**测试账号**: 8个真实账号 (密码: 123456)

## 测试汇总

| 指标 | 数值 |
|------|------|
| 总测试数 | 10 |
| 通过 | 8 ✅ |
| 失败 | 2 ❌ |
| 通过率 | 80.0% |

## 测试账号

### 平台用户 (PLATFORM)
- admin (factory_super_admin) - 平台管理员
- developer (factory_super_admin) - 开发者
- platform_admin (factory_super_admin) - 平台超管

### 工厂用户 (CRETAS_2024_001)
- perm_admin (permission_admin) - 权限管理员
- proc_admin (department_admin/processing) - 加工部管理
- farm_admin (department_admin/farming) - 养殖部管理
- logi_admin (department_admin/logistics) - 物流部管理
- proc_user (operator/processing) - 加工操作员

**所有账号密码**: 123456

## 测试项

1. ✓ 8个账号登录测试
2. ✓ Token刷新测试
3. ✓ 错误密码拒绝测试

---

**报告生成完成**
