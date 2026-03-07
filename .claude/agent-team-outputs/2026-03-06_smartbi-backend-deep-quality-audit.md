# SmartBI 后端代码深度质量评估报告

**日期**: 2026-03-06
**范围**: backend/python/smartbi/ + backend/java/cretas-api SmartBI 相关 Controller/Service
**方法**: Agent Team Full Mode (3 Researcher + Analyst + Critic + Integrator)

---

## 执行摘要

SmartBI 后端代码库（Python ~66K行 + Java ~143K行）在 MVP 内部使用阶段质量可接受。Analyst 原判的 6 个 P0 经 Critic 代码验证后大幅下调：JWT 拦截器已覆盖所有 `/api/mobile/**` 路径，exec() 沙箱有三层防御，8083 端口不直接对公网暴露。**最终确认 0 个 P0（当前 MVP），4 个 P1，7 个 P2**。若系统对外上线，内部密钥硬编码（B3）和 PublicDemo 无限速（B5）需升级为 P0。

---

## 共识与分歧

| 维度 | 共识（Analyst + Critic 一致） | 最终裁定 |
|------|---------------------------|---------|
| 内部密钥泄露 | `common.ts:113` 硬编码 `'cretas-internal-2026'` | **P1** -- 确认泄露，当前 MVP 影响有限 |
| str(e) 信息泄露 | Python 42 文件 134 处直返异常 | **P2** -- 广泛存在但多为内部路径 |
| 双重 pd.read_excel | excel.py:600-601 冗余全表读取 | **P2** -- 确认，修复简单 |
| 无界线程池 | 7 处 newCachedThreadPool 确认存在 | **P1** -- 低并发可容忍，上线前必修 |
| ~~commonPool 9查询~~ | **Critic 否定** -- 实为 FixedThreadPool(4) | **删除** -- 研究员误报 |
| ~~零 @PreAuthorize~~ | **Critic 验证** -- JWT 拦截器已覆盖认证 | **删除** -- P0->P2(架构债务) |
| exec() 沙箱逃逸 | Analyst P0 vs Critic P1 | **P2** -- 三层防御有效，无具体 PoC |
| PUBLIC_PREFIXES | Analyst P0 vs Critic P1 | **P2** -- 8083 不直接暴露公网 |

---

## 最终发现清单

| ID | 发现 | 优先级 | 置信度 | 修复难度 |
|----|------|--------|--------|---------|
| **B3** | 内部密钥 `'cretas-internal-2026'` 硬编码在前端 JS 包 (`common.ts:113`) | **P1** | 95% | Easy |
| **B4** | 7 处 `newCachedThreadPool` 无界线程池（SSE 场景线程数无上限） | **P1** | 90% | Medium |
| **B5** | PublicDemo/AIDemo 无 IP 限速，可被滥用消耗 LLM 配额 | **P1** | 85% | Medium |
| **A1** | `data_sync.py:449` 路径遍历 -- `req.file_path` 直传 `openpyxl` 无校验 | **P1** | 85% | Easy |
| **A4** | 42 个 Python 文件 134 处 `str(e)` 直返客户端，泄露内部信息 | **P2** | 95% | Easy |
| **A3** | `excel.py:600` 双重 `pd.read_excel` 仅取行数，性能浪费 | **P2** | 95% | Easy |
| **A5** | `insight.py:197` 全量 50000 行查询无分页 | **P2** | 80% | Medium |
| **A2** | `data_cleaner.py:752` exec() 沙箱 -- ast.Attribute 理论可绕过 | **P2** | 70% | Hard |
| **C1** | 超时不匹配：前端 200s > Nginx 120s > Java 30-60s | **P2** | 75% | Easy |
| **A7** | `analysis.py` 35 路由 1824 行中 60% 样板重复 | **P2** | 90% | Medium |
| **DUP** | 5 对重复文件 ~66K 行（structure_detector 等） | **P2** | 85% | Hard |

---

## 修复路线图

### (A) 立即修复 -- 当前 MVP（1-2 天）

1. **B3**: `common.ts:113` 硬编码密钥改为空字符串，通过 `VITE_PYTHON_SECRET` 环境变量注入
2. **B5**: AIPublicDemoController 添加 IP 滑动窗口限速（10次/分钟）
3. **A4**: Python API 层 `str(e)` 批量替换为通用错误消息（保留日志详情）

### (B) 上线前必修（3-5 天）

4. **A1**: `data_sync.py` 添加 `os.path.realpath()` + 白名单目录校验
5. **B4**: 7 处 `newCachedThreadPool` -> `newFixedThreadPool(N)` 或共享有界线程池
6. **A3**: `excel.py:601` 改用 `openpyxl.ws.max_row` 获取行数
7. **B3 升 P0**: 若 web-admin 对外可访问，构建时必须注入真实密钥

### (C) 长期架构改善（5-10 天）

8. **A2**: exec 沙箱迁移至 subprocess + seccomp 或 WASM 隔离
9. **C1**: 统一超时策略文档（前端 > 网关 > 后端 > LLM）
10. **A5**: insight 大数据集引入流式分页
11. **DUP**: 合并 5 对重复文件，预计可减少 ~30K 行

---

## 开放问题

1. **8083 端口监听地址**: `0.0.0.0` 还是 `127.0.0.1`？决定多个 P2 是否需升级
2. **data_sync 端点调用方**: 仅内部还是有前端入口？决定 A1 实际攻击面
3. **LLM 配额隔离**: PublicDemo 是否共享生产 LLM 配额？
4. **chart/ 子目录状态**: git status 已标记删除，重复文件是否已部分清理？

---

## 详细研究数据

### Researcher A: Python SmartBI

| # | 发现 | 来源 | 可靠度 |
|---|------|------|--------|
| 1 | 路径遍历: data_sync.py:449 直传 file_path | 代码 | 5/5 |
| 2 | exec() 沙箱: data_cleaner.py:752 ast.Attribute 可绕过 | 代码 | 5/5 |
| 3 | 双重 pd.read_excel: excel.py:600 性能浪费 | 代码 | 5/5 |
| 4 | 5 对重复文件: 66150 行代码 | 代码 | 5/5 |
| 5 | 20+ 全局单例无锁 | 代码 | 5/5 |
| 6 | 50000 行全量查询: insight.py:205 | 代码 | 5/5 |
| 7 | 35 路由样板重复: analysis.py 1824 行 | 代码 | 5/5 |
| 8 | 12+ 处 str(e) 信息泄露 | 代码 | 5/5 |

### Researcher B: Java SmartBI

| # | 发现 | 来源 | 可靠度 |
|---|------|------|--------|
| 1 | ~~ForkJoinPool.commonPool 9查询~~ (误报) | 代码 | 5/5 |
| 2 | 5 Controller 缺 @PreAuthorize (JWT 覆盖) | 代码 | 5/5 |
| 3 | PythonSmartBIClient 密钥硬编码 | 代码 | 5/5 |
| 4 | 7 处 newCachedThreadPool 无界 | 代码 | 5/5 |
| 5 | SSE 上传裸 new Thread() | 代码 | 5/5 |
| 6 | PublicDemo 无速率限制 | 代码 | 5/5 |
| 7 | catch-log-sanitize 重复 40+ 次 | 代码 | 5/5 |
| 8 | PythonSmartBIConfig 576 行上帝配置 | 代码 | 5/5 |

### Researcher C: Integration

| # | 发现 | 来源 | 可靠度 |
|---|------|------|--------|
| 1 | snake_case/camelCase 混用 | 代码 | 5/5 |
| 2 | X-Internal-Secret 前端泄露 | 代码 | 5/5 |
| 3 | 超时链路断裂 60s vs 120s | 代码 | 5/5 |
| 4 | 不区分可重试/不可重试错误 | 代码 | 5/5 |
| 5 | 无 HTTP 层面熔断器 | 代码 | 5/5 |
| 6 | 17 个 PUBLIC_PREFIXES 豁免 | 代码 | 5/5 |
| 7 | 错误信息不透传 | 代码 | 5/5 |
| 8 | 浅层健康检查 | 代码 | 5/5 |

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (Python / Java / Integration)
- Total sources: 30+ source files examined
- Key disagreements: 3 resolved (B1 deleted, B2 downgraded, A2 downgraded), 0 unresolved
- Phases: Research (parallel x3) -> Analysis -> Critique -> Integration -> Heal
- Fact-check: disabled (codebase-grounded)
- Healer: 5 checks passed, 1 note (B2 deletion rationale clarified)

### Healer Notes
- [Note] B2 删除理由引用"129处@PreAuthorize" -- 实际是指整个项目中其他 Controller 有注解，SmartBI Controller 确实缺失。但核心结论（JWT 拦截器已提供认证保护）正确，严重度下调合理
- [Passed] 所有其他检查 OK
