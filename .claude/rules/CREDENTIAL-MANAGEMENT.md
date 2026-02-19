# 凭证配置

**最后更新**: 2026-02-19

---

## 必需环境变量

### Java 后端 (生产环境 pg-prod)

| 变量 | 用途 | 示例 |
|------|------|------|
| `DB_PASSWORD` | 主数据库 (cretas_db) 密码 | `cretas123` |
| `SMARTBI_DB_PASSWORD` | SmartBI 数据库 (smartbi_db) 密码 | `smartbi_secure_password_2025` |
| `JWT_SECRET` | JWT 签名密钥 | 随机长字符串 |
| `IFLYTEK_APPID` | 讯飞语音 AppID | `f1017f5d` |
| `IFLYTEK_API_KEY` | 讯飞语音 API Key | - |
| `IFLYTEK_API_SECRET` | 讯飞语音 API Secret | - |
| `ALIBABA_ACCESSKEY_ID` | 阿里云 OSS AccessKey | - |
| `ALIBABA_SECRET_KEY` | 阿里云 OSS Secret | - |

### Java 后端 (本地开发 pg)

| 变量 | 值 |
|------|-----|
| `DB_PASSWORD` | `cretas_pass` |
| `POSTGRES_SMARTBI_PASSWORD` | `smartbi_pass` |

### Python 服务

| 变量 | 用途 | 位置 |
|------|------|------|
| `DASHSCOPE_API_KEY` | 通义千问 LLM API Key | `backend/python/.env` |
| PostgreSQL 连接 | 在 `.env` 中配置 | `backend/python/.env` |

---

## Spring Boot 配置

```properties
# 通过环境变量注入，禁止硬编码
spring.datasource.password=${DB_PASSWORD}
smartbi.postgres.password=${SMARTBI_DB_PASSWORD}
cretas.jwt.secret=${JWT_SECRET}
```

---

## 安全规范

- **禁止** 在代码/配置文件中硬编码密码
- **禁止** 将 `.env` 文件提交到 Git
- 服务器环境变量通过 `restart.sh` 或 `/etc/environment` 设置
- 本地开发通过命令行参数或 shell export 传入
