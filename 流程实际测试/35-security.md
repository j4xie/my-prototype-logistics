# 35. 安全综合测试 (8 大攻击向量)

> **🟡 R18 QA Smoke (2026-04-17 07:05)**: 跨租户 F002 → **403** "无权访问该工厂数据" ✅. `credentials:omit` 6 endpoints (SO/users/customers/finance/suppliers/SO-detail) 全 **401** "未授权请先登录" ✅. Invalid token → 401. XSS payload `<script>alert(1)</script>` 在 keyword search 未反射 ✅. 认证/授权/XSS 防护 OK.

**来源**: R3 Agent 2 (NFR 安全部分)
**耗时**: 2-3 h (渗透测试, 专业 QA)
**工具**: Burp Suite / Postman / F12 DevTools

---

## 35.1 安全攻击向量

### 35.1.1 SQL 注入 (Critical)
**测试点**:
- 搜索框输入 `' OR 1=1--`
- URL 参数 `?id=1 UNION SELECT *`
- API body 字段: `"name": "'; DROP TABLE users;--"`

**✅ PASS**: 后端参数化查询, 输入被转义, 返回 400 或空结果
**❌ FAIL**: 返回全表数据 / SQL 错误 stack

### 35.1.2 XSS 跨站脚本 (Critical)
| 类型 | 测试 |
|------|------|
| Stored | 备注字段存 `<script>alert(1)</script>` → 详情页弹窗? |
| Reflected | URL `?q=<img src=x onerror=alert(1)>` |
| DOM | v-html 绑定的字段含恶意 html |

**✅ PASS**: 输出被 HTML 编码, 脚本不执行
**❌ FAIL**: 弹窗成功

### 35.1.3 CSRF
- 跨站页面伪造 POST 请求
- **✅ PASS**: 请求需 CSRF token (X-CSRF-Token header)
- Cookie 配 `SameSite=Lax`/`Strict`

### 35.1.4 JWT 生命周期
| 测试 | 期望 |
|------|------|
| Token 篡改 (改 payload) | 后端验签失败 401 |
| 过期 token 仍调用 | 401 |
| 撤销后调用 | 401 (需撤销列表或短 TTL) |
| 登出后 token 仍能用 | ❌ FAIL: 应加入 blacklist |
| Refresh token 窃取 | 限制 refresh 次数或 IP |

### 35.1.5 Cookie 安全
F12 Application → Cookies, 检查:
- `HttpOnly`: ☐ 是 (JS 不可读)
- `Secure`: ☐ 是 (仅 HTTPS)
- `SameSite`: ☐ Lax 或 Strict

### 35.1.6 文件上传绕过
- `.jsp` 改名 `.pdf` 上传 → ✅ 后端检测 MIME 拒绝
- 超大文件 → ✅ 限制
- 路径穿越 `../../etc/passwd` → ✅ 拒绝
- 文件名含 `<script>` → ✅ 转义

### 35.1.7 越权 (水平+垂直)
| 类型 | 测试 |
|------|------|
| 水平 (同角色跨工厂) | F001 的 sales 调 F002 的 customers API → 403 |
| 垂直 (提权) | operator 自改 role='admin' → 后端拒绝 |
| IDOR | 改 URL `/orders/{id}` 访问他人订单 → 403 |

### 35.1.8 敏感信息泄露
| 检查 | 期望 |
|------|------|
| API 返 password_hash | 应不返回 |
| Error stack 暴露 | 生产环境应隐藏 |
| Console 打印密码 | 应不打印 |
| URL 含 token | 应在 header 不在 URL |

---

## 35.2 安全 Checklist (20 项)

| # | 攻击 | 勾选 |
|---|------|------|
| 1 | SQL 注入 (搜索框) | ☐ ⭐ |
| 2 | SQL 注入 (URL 参数) | ☐ ⭐ |
| 3 | SQL 注入 (API body) | ☐ ⭐ |
| 4 | XSS Stored | ☐ ⭐ |
| 5 | XSS Reflected | ☐ |
| 6 | XSS DOM v-html | ☐ |
| 7 | CSRF token 验证 | ☐ |
| 8 | Cookie SameSite | ☐ |
| 9 | JWT 篡改 401 | ☐ ⭐ |
| 10 | 过期 token 拒 | ☐ ⭐ |
| 11 | 登出后 token 失效 | ☐ ⭐ |
| 12 | Refresh 次数限制 | ☐ |
| 13 | Cookie HttpOnly | ☐ |
| 14 | Cookie Secure | ☐ |
| 15 | MIME 绕过文件上传 | ☐ ⭐ |
| 16 | 路径穿越 | ☐ ⭐ |
| 17 | 水平越权跨工厂 | ☐ ⭐⭐ |
| 18 | 垂直越权提权 | ☐ ⭐⭐ |
| 19 | IDOR 直接访问 | ☐ ⭐ |
| 20 | password_hash 不返回 | ☐ ⭐ |

⭐⭐ = P0 必过 / 失败即安全漏洞
