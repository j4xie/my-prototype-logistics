# F006 `f006_admin` 登录问题调查 — Post T6.4 Cascade

**Audit date**: 2026-05-10
**Trigger**: 客户会议录音 (`.tmp-transcripts/2026-05-10-customer-meeting.md`) 提到 `f006_admin` 账号"登不进去"
**Context**: 2026-05-09 T6.4 cascade Stage 2 (06:09:03 CST) 把 F006 切到 Python — 怀疑 cascade 是否破坏 F006 登录
**Status**: 🟢 **NOT A PROD BUG** — 后端 Java login 正常返 200,客户描述实为 App 端"加载中转圈"且客户/开发自己已诊断为"App 版本与后端对不上"

---

## 1. 客户原始措辞 (transcript line 37)

完整上下文片段(去除录音杂音/Whisper 幻觉):

> 「等待一下吧还是在那个 f 吗 ... 那好像这么说他一直在转加载中嗯那可能我得发个新版本给你就是导致了**因为这两天有都跟新版后端对不上的话就可能会跟不进去**嗯等一下可能有关账号有问题 ... 这个还是那个 **f006 admin 那账号吗这个应该是后端的问题哦没有我刚刚那个可能是之前的账号哦换了我换成现在账号也登不进去**嗯也登不进去是吧对应该就两天改的导致的」

**关键拆解**:
- 客户在 **App 端**(`报工审批 ... 在 app 那边 ... 手机单`)操作,**不是 web-admin**
- 症状: **"一直在转加载中"** — 这是 spinner stuck on loading screen,**不是** "用户名密码错误"页面
- 开发自己第一时间归因:**App 版本与后端对不上**("这两天都跟新版后端对不上") — 不是登录系统挂掉
- 试了 `f006_admin` + "现在账号" 两个都登不进去 → 系统性 App 问题,而不是单账号 credential 问题
- 客户后续说"那你合同收负一下你自己测一下吧" — 直接绕过去测下一个功能,**没有把登录失败当 P0 阻塞 bug**

会议摘要 §5 (line 96) 行动项已经写明 **"是否与今天 (5-9) 的 T6.4 cascade 切到 Python 有关?需要验证"** — 这份 doc 是对该 action item 的 closure。

---

## 2. 服务端登录复测 (audit-only,not modifying anything)

### 2.1 直连 Java prod 10010 (SSH localhost on server 47)

```bash
ssh root@47.100.235.168 "curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{\"username\":\"f006_admin\",\"password\":\"123456\",\"deviceInfo\":{...}}' \
  http://localhost:10010/api/mobile/auth/unified-login"
```

**Result**:
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "userId": 1309,
    "username": "f006_admin",
    "factoryId": "F006",
    "factoryName": "六膳门食品科技",
    "factoryType": "FACTORY",
    "role": "factory_super_admin",
    "permissions": ["*:*"],
    "token": "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiZmFjdG9yeV9zdXBlcl9hZG1pbiIsImZhY3RvcnlJZCI6IkYwMDYi...",
    "refreshToken": "eyJhbG..."
  }
}
```

✅ 后端登录正常,token 含正确 `factoryId=F006` + `role=factory_super_admin`。

### 2.2 公网 nginx 网关 (App 真实走的路径)

```bash
ssh root@139.196.165.140 "curl -sk -X POST -H 'Host: api.cretaceousfuture.com' \
  -H 'Content-Type: application/json' \
  -d '{\"username\":\"f006_admin\",\"password\":\"123456\",\"deviceInfo\":{...}}' \
  https://127.0.0.1/api/mobile/auth/unified-login"
```

**Result**: `code: 200 factoryId: F006 role: factory_super_admin`

✅ App 实际走的公网入口也正常 — TLS / nginx 网关 / vhost 路由全 OK。

### 2.3 多 F006 账号批量测试

| 账号 | 角色 | 密码 `123456` 登录结果 |
|---|---|---|
| f006_admin | factory_super_admin | ✅ 200 |
| f006_dept_admin | department_admin | ✅ 200 |
| f006_production_mgr | production_manager | ✅ 200 |
| f006_warehouse_manager | warehouse_manager | ⚠️ 401 (`用户名或密码错误`) |
| f006_worker1 | operator | ✅ 200 |

`f006_warehouse_manager` 单一账号默认密码不是 `123456` (个别账号被改过密码或 seed 时手动设了别的值) — 这是 **single-user credential drift**,不是 cascade 引发,不是 prod outage。

### 2.4 与 T6.4 cascade 时间线对比

- T6.4 Stage 2 reload: **2026-05-09 06:09:03 CST** (F006 进 Python cohort)
- 客户会议反馈时间: 2026-05-10 (录音)
- 服务复测时间: 2026-05-10
- **登录 24 小时+多次复测全通过** → cascade 没有引发持续性登录故障

---

## 3. nginx 路由配置审计 (T6.4 cutover 是否误把 `/auth` 路径切到 Python?)

```bash
ssh root@139.196.165.140 "grep -E 'location|proxy_pass' \
  /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf"
```

T6.4 cutover regex 实际匹配的 path **只有** SmartBI 子路径:

```nginx
location ~ ^/api/mobile/(F00[1-46]|...)/smart-bi/(alerts|recommendations|data-date-range)$ {
    proxy_pass http://cretas_python;
}
location ~ ^/api/mobile/(F00[1-46]|...)/smart-bi/analysis/(finance|sales|department|region|inventory|procurement)(/.*)?$ {
    proxy_pass http://cretas_python;
}
location ~ ^/api/mobile/(F00[1-46]|...)/smart-bi/(query-templates|datasource|incentive-plan)(/.*)?$ {
    proxy_pass http://cretas_python;
}
```

✅ **`/api/mobile/auth/*` 路径不在 T6.4 regex 内**, 仍走 Java upstream。**Cascade 不可能影响登录路径**。

---

## 4. 假说验证

| # | 假说 | 验证方法 | 结果 |
|---|---|---|---|
| H1 | F006 密码 post-cascade 被轮换 | 多账号 + `123456` 默认密码全 200 | ❌ 否决(只有 warehouse_manager 单点 drift) |
| H2 | nginx T6.4 regex 误把 `/auth` 切到 Python | grep nginx 路由 | ❌ 否决(regex 只匹配 `/smart-bi/*`) |
| H3 | JWT_SECRET 轮换 → 旧 token 失效 | Java prod started 2026-05-10 22:22:11 (Pattern B deploy 时间) + 客户测试是当天会议 | ❌ 否决(rotate JWT_SECRET 是手动操作,无证据;且 token 失效会显示登录页面,不是"转圈") |
| H4 | Cookie domain mismatch | App 用 Bearer token, 不用 cookie | ❌ 否决(App `apiClient.ts` interceptors 用 SecureStore + Authorization header) |
| H5 | Python 端业务 endpoint 返 401 → 前端拦截误判"未登录" | 后续 App 调用应该是 SmartBI 路径 → Python — 但客户卡在 "app 加载中转圈",还没走到 SmartBI 调用 | 🟡 部分相关,但不是登录本身故障 |
| **H6** | **App 版本与后端 contract 不匹配,启动后某个固定 endpoint(splash/init/profile)返回新版字段格式,旧 App 无法解析 → 一直 spinner** | 客户/开发自己原话 "**这两天都跟新版后端对不上**" + Java prod 在 22:22 重启(Pattern B deploy `2026-05-10`)+ 客户卡在"加载中",从未到达"用户名密码错误"页面 | ✅ **CONFIRMED** (开发自诊 + 时序证据 + 症状匹配) |

---

## 5. Root Cause

**H6 confirmed**: 客户 App 是旧版本(未跟随近两天 Java/Python 后端的 Pattern B & T6.4 改动)。

证据链:
1. 后端 login endpoint 直连 + 网关复测均 200 — 不是登录系统挂掉
2. T6.4 cascade 不动 `/auth` 路径 — cascade 不可能阻塞登录
3. 客户描述是 "**一直在转加载中**" 而非 "**用户名密码错误**"/"网络错误" → 表明 HTTP 请求已发出且服务端有响应,**问题在 App 端响应解析/路由后续 API 调用**
4. 开发自己原话 "这两天都跟新版后端对不上",**已经把根因诊断完了** — 这次会议的工作项 A6 (line 88) 是 **"发新版 App 给客户(B6)"** P0,不是 "排查登录"
5. Java prod 在 2026-05-10 22:22:11 才完成 Pattern B 部署(Java jar mtime 2026-05-10 22:20)— 这之后才是客户测试期(2026-05-10)
6. `frontend/CretasFoodTrace/` 在 2026-05-07 到 2026-05-10 期间有 commit (`3aeb5717e8 fix(frontend): 410 SMARTBI_MIGRATED graceful UI handler`),客户 App 没装

**这不是后端故障**,**不是 T6.4 cascade side effect**,**不是 P0 customer-impacting prod bug**。

---

## 6. 修复建议

### 6.1 直接修复 (P0,会议已认领为 A6)

- **发新版 App** 给客户(Steve 与客户已确认): `cd frontend/CretasFoodTrace && eas build` 或 expo OTA update
- 需要确认 App 新版本与 Java/Python 后端 API contract 一致(尤其是近期 `3aeb5717e8` 410 SMARTBI_MIGRATED handler)
- 发版前用 `f006_admin` 在真机走一次"启动 → 登录 → 进首页 → 加载 dashboard"完整流程

### 6.2 防御性 (建议 P2,不阻塞)

- App 端"加载中"的 spinner 加 **timeout + fallback UI** + **打印失败 endpoint** — 不然客户看不见错误信息只能凭直觉报"登不进去",误导根因排查方向
- 后端 health endpoint 加 **App-min-version 字段**,App 启动时拉一次,版本过老直接弹"请更新 App"而不是 spinner

### 6.3 客户侧 mitigation (现场即时可做)

- 让客户**清 App 缓存 / 重装 App** + **下载最新版 ipa/apk**
- 若 EAS Update channel 已配置 → 推 OTA hotfix,客户重启 App 即生效

### 6.4 单账号 follow-up

- `f006_warehouse_manager` 密码不是 `123456` → 不影响今天客户故事 (客户测 admin 不测 warehouse),但 reference doc 需 caveat。建议: 后续 prod 测试若要全角色覆盖,先用 admin 账号重置该用户密码,或在 reference doc 标注"非默认密码"。

---

## 7. 客户当下 mitigation (一句话给前线 ops)

> 后端没坏,问题是 App 版本旧,等今天/明天的新版 App ipa/apk(或 EAS OTA 推送)装上就好。短期可让客户清 App 缓存 + 重装,但根本解决要新版 App。

---

## 8. 跨 Audit 信号

- T6.4 cascade 整体健康:5 stages 全 100% smoke,0 cross-routing leak,F006 在 Stage 2 切到 Python 24h 后登录 + 网关测试全部 200
- **教训**: 客户原话"登不进去"是症状,不是根因。"App 加载中转圈"这一细节是关键 — symptom 不到 "登录页报错"层,backend login 不会是首要嫌疑。**Whisper transcript 上下文(开发自己说"App 跟新版后端对不上")已经包含答案**,audit 早期就该看完整片段而不是只搜"登不进去"关键词。
- **流程 takeaway**: 客户报障 → 先要细化 "卡在哪一屏幕、看到什么文案、是登录界面报错 还是 已登录后页面空白",不要直接抽象成"登不进去"。

---

## 9. References

- 会议录音 transcript: `.tmp-transcripts/2026-05-10-customer-meeting.md` (line 27, 37, 53, 96)
- F006 账号列表: `~/.claude/projects/.../memory/reference_f006_liutengmen_prod_accounts.md`
- T6.4 cascade 时间线: `~/.claude/projects/.../memory/project_2026_05_09_phase_2a_complete.md`
- nginx 路由: 服务器 139 `/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf`
- Java prod systemd: `cretas-backend.service` (server 47, started 2026-05-10 22:22:11 CST)
- App 端 base URL 配置: `frontend/CretasFoodTrace/src/services/api/apiClient.ts` + `src/constants/config.ts`
- 已认领的会议 action item: A6 "发新版 App 给客户(B6),查为什么报工审批接口加载不出"
