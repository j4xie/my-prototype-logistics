---
name: deploy-backend
description: 部署后端到服务器。当用户说"部署后端"、"deploy backend"、"发布后端"、"上传JAR"时触发此 Skill。支持 6 种并行上传方式。
allowed-tools:
  - Bash
---

# 部署后端

## 方式1: JAR 部署 (推荐，默认)

```bash
./deploy-backend.sh              # 一键部署
./deploy-backend.sh --jar v1.2   # 指定版本
```

### 上传策略 (两阶段)

**阶段1: GitHub 并行 (6路竞争，超时60秒)**
| 方式 | 说明 |
|------|------|
| GitHub直连 | 服务器直接从 GitHub 下载 |
| ghproxy.cc | 镜像加速 |
| mirror.ghproxy.com | 镜像加速 |
| ghfast.top | 镜像加速 |
| gh-proxy.com | 镜像加速 |
| cf.ghproxy.cc | 镜像加速 |

**阶段2: Fallback (GitHub 失败时启用)**
| 方式 | 说明 | 依赖 |
|------|------|------|
| SCP | 直接上传 | SSH |
| SCP+gzip | 压缩后上传 | SSH |
| OSS加速 | 全球加速上传 + 内网下载 | ossutil |
| R2 | Cloudflare CDN 中转 | aws CLI |

## 方式2: Git 部署 (旧方式)

```bash
./deploy-backend.sh --git
./deploy-backend.sh --git steven
```

## 服务器操作

```bash
# 仅重启服务
ssh root@47.100.235.168 "bash /www/wwwroot/cretas/restart.sh"

# 查看日志
ssh root@47.100.235.168 "tail -50 /www/wwwroot/cretas/cretas-backend.log"

# 健康检查
curl http://47.100.235.168:10010/api/mobile/health
```

## 配置信息

| 项目 | 值 |
|------|-----|
| 服务端口 | 10010 |
| JAR 路径 | /www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar |
| 日志 | /www/wwwroot/cretas/cretas-backend.log |

### Cloudflare R2

| 项目 | 值 |
|------|-----|
| Bucket | cretas |
| Account ID | 7ff7cc2e7bc3af46147d5c7df18062db |
| Public URL | https://pub-70da4e6da1f3446d9e055f2793d05837.r2.dev |

### GitHub 镜像

`ghproxy.cc`, `mirror.ghproxy.com`, `ghfast.top`, `gh-proxy.com`, `cf.ghproxy.cc`
