# Mock数据一致性验证报告

**验证时间**: 2025/6/4 02:07:46
**验证范围**: Mock API与OpenAPI Schema一致性

## 📊 验证结果汇总

| 指标 | 数值 | 状态 |
|------|------|------|
| 🎯 总体得分 | 100.0% | ✅ 良好 |
| 📊 端点总数 | 9 | - |
| ✅ 一致端点 | 9 | 100.0% |
| ❌ 不一致端点 | 0 | 0.0% |
| 🚨 严重问题 | 0 | ✅ |
| ⚠️ 警告问题 | 0 | ✅ |

## 📋 详细验证结果

### ✅ 一致的端点 (9个)

#### /users
- **文件路径**: `web-app-next\src\app\api\users\route.ts`
- **一致性得分**: 100%
- **Schema路径**: `/users`

#### /products
- **文件路径**: `web-app-next\src\app\api\products\route.ts`
- **一致性得分**: 100%
- **Schema路径**: `/products`

#### /users/profile
- **文件路径**: `web-app-next\src\app\api\users\profile\route.ts`
- **一致性得分**: 100%
- **Schema路径**: `/users/profile`

#### /trace/{id}
- **文件路径**: `web-app-next\src\app\api\trace\[id]\route.ts`
- **一致性得分**: 100%
- **Schema路径**: `/trace/{id}`

#### /auth/verify
- **文件路径**: `web-app-next\src\app\api\auth\verify\route.ts`
- **一致性得分**: 100%
- **Schema路径**: `/auth/verify`

#### /auth/logout
- **文件路径**: `web-app-next\src\app\api\auth\logout\route.ts`
- **一致性得分**: 100%
- **Schema路径**: `/auth/logout`

#### /auth/status
- **文件路径**: `web-app-next\src\app\api\auth\status\route.ts`
- **一致性得分**: 100%
- **Schema路径**: `/auth/status`

#### /auth/login
- **文件路径**: `web-app-next\src\app\api\auth\login\route.ts`
- **一致性得分**: 100%
- **Schema路径**: `/auth/login`

#### /trace/{id}/verify
- **文件路径**: `web-app-next\src\app\api\trace\[id]\verify\route.ts`
- **一致性得分**: 100%
- **Schema路径**: `/trace/{id}/verify`

## 💡 改进建议

暂无改进建议，一致性验证通过。

---

*报告生成于: 2025/6/4 02:07:46*
*验证工具: Mock数据一致性验证器 v1.0.0*
