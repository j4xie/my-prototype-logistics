# MySQL → PostgreSQL 迁移进度跟踪

> **开始时间**: 2026-01-26
> **预计完成**: 12 周 (Week 12) + MySQL 下线 (Week 21+)
> **当前阶段**: Phase 4 验证测试进行中 - API 功能验证通过

---

## 进度概览

| Phase | 名称 | 状态 | 进度 |
|-------|------|------|------|
| 0 | 评估与准备 | ✅ 完成 | 3/3 |
| 1 | 代码兼容层 | ✅ 完成 | 7/7 |
| 2 | 迁移脚本转换 | ✅ 完成 | 7/7 |
| 3 | 数据迁移 | ✅ 完成 | 5/5 |
| 4 | 验证测试 | 🔄 进行中 | 4/6 |
| 5 | 灰度切换 | ⏳ 等待 | 0/3 |
| 6 | MySQL 处理 | ⏳ 等待 | 0/4 |

**总进度: 27/35 任务完成 (77%)**

---

## 生成的文件清单

### 配置文件
- [x] `application-pg.properties` - PostgreSQL 开发配置 (193 行)
- [x] `application-pg-prod.properties` - PostgreSQL 生产配置
- [x] `application-pg-test.properties` - PostgreSQL 测试配置

### 迁移脚本
- [x] `db/migration-pg/V0001__create_enum_types.sql` - ENUM 类型定义 (369 行, 29 类型)
- [x] `db/migration-pg/V0002__create_update_triggers.sql` - 更新触发器 (738 行, 173 表)
- [x] `db/migration-pg/V9999__setup_pg_cron_jobs.sql` - 定时任务 (158 行, 2 任务)

### 转换后的迁移脚本
- [x] `db/migration-pg-converted/` - 153 个 MySQL 脚本转换为 PostgreSQL 格式
  - 自动转换: 数据类型、AUTO_INCREMENT、字符集、引擎等
  - 需手动审查: 65 个文件 (COMMENT=, ENUM, INSERT IGNORE, GROUP_CONCAT)

### 工具脚本
- [x] `scripts/convert-mysql-to-pg.sh` - 自动转换工具 (12KB)
- [x] `scripts/migrate.load` - pgloader 配置 (157 行)
- [x] `scripts/fix-sequences.sql` - 序列修复 (49 行)

### 报告文档
- [x] `docs/migration/insert-ignore-conversion-report.md` - INSERT 转换 (15KB, 251 处)
- [x] `docs/migration/date-function-conversion-report.md` - 日期函数 (7.5KB, 7 处)
- [x] `docs/migration/dual-datasource-merge-plan.md` - 合并方案 (15KB)
- [x] `docs/migration/manual-review-summary.md` - 手动审查摘要

---

## 关键统计

| 指标 | 数量 |
|------|------|
| Entity 总数 | 182 |
| 迁移脚本 | 153 |
| ENUM 类型 | 29 |
| JSON 字段 | ~156 |
| INSERT IGNORE | 211 处 |
| 日期函数 | 38 处 |
| 存储过程 | 4 个 |
| EVENT | 2 个 |

---

### 服务器脚本
- [x] `scripts/install-postgresql-server.sh` - PostgreSQL 安装脚本
- [x] `scripts/backup-mysql-for-migration.sh` - MySQL 备份脚本

---

## 下一步操作

### 服务器操作 (需要 SSH)

```bash
# 1. SSH 登录服务器
ssh root@139.196.165.140

# 2. 上传脚本
scp scripts/install-postgresql-server.sh root@139.196.165.140:/tmp/
scp scripts/backup-mysql-for-migration.sh root@139.196.165.140:/tmp/

# 3. 执行 MySQL 备份
bash /tmp/backup-mysql-for-migration.sh

# 4. 安装 PostgreSQL
bash /tmp/install-postgresql-server.sh

# 5. 执行数据迁移
pgloader scripts/migrate.load
```

---

## 更新日志

### 2026-01-27 (API 功能验证通过)
- 应用使用 PostgreSQL 成功启动 (354秒)
- 修复剩余 28 个 TEXT→BOOLEAN 列转换 (factory_settings, dahua_devices 等)
- 核心 API 验证通过:
  - `/api/mobile/system/health` ✅
  - `/api/mobile/auth/unified-login` ✅ (JWT 生成成功)
  - `/api/mobile/F001/users` ✅
  - `/api/mobile/F001/material-batches` ✅
- **完成 27/35 任务 (77%)**

### 2026-01-26 (数据迁移完成)
- 使用 Python 脚本完成数据迁移 (pgloader 不可用)
- **180/180 表迁移成功**
- 数据完整性验证通过:
  - users: 39 条
  - factories: 3 条
  - intent_match_records: 83,290 条
  - material_batches: 8 条
- 执行 V0002 触发器脚本 (168 个触发器)
- 创建必要索引
- **完成 25/35 任务 (71%)**

### 2026-01-26 (服务器操作)
- SSH 连接服务器 139.196.165.140 成功
- 发现 PostgreSQL 13 已安装并运行
- 创建 `cretas_db` 数据库和 `cretas_user` 用户
- 配置 pg_hba.conf 允许应用连接
- 验证 PostgreSQL 连接成功
- 上传迁移脚本到服务器 `/tmp/migration-pg/`
- 执行 V0001 ENUM 类型创建 (29 个类型)
- pgloader 不可用 (Docker 超时, yum 无包) - 需替代方案
- **完成 20/35 任务 (57%)**

### 2026-01-26 (续2)
- 验证 pom.xml 已包含 PostgreSQL 驱动 (Task #4 完成)
- 验证主代码编译成功
- 发现测试编译问题 (TwoStageIntentClassifier 签名变更) - 独立问题

### 2026-01-26 (续)
- 执行迁移脚本转换: 153 个文件 → `db/migration-pg-converted/`
- 修复 MODIFY COLUMN 语法: 30 处 → ALTER COLUMN ... TYPE
- 创建手动审查摘要报告
- **本地可完成的迁移准备任务已全部完成**
- 剩余任务需要服务器操作 (SSH 139.196.165.140)

### 2026-01-26
- 创建迁移任务计划 (35 个任务)
- 启动 14 个并行 Agent 执行准备工作
- 创建目录结构: `docs/migration/`, `db/migration-pg/`, `scripts/`
- 完成 14 个任务 (40%)
- 生成所有配置文件、迁移脚本、转换报告
- 创建服务器安装和备份脚本
