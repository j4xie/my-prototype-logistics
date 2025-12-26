# 服务器 SSH 访问配置

## 服务器信息

| 项目 | 值 |
|------|-----|
| IP 地址 | 139.196.165.140 |
| SSH 用户 | root |
| SSH 端口 | 22 (默认) |
| 认证方式 | SSH 密钥 |

## SSH 连接命令

```bash
ssh root@139.196.165.140
```

## 目录结构

```
/www/wwwroot/project/
├── mall_center/                    # MallCenter 后端
│   ├── logistics-admin.jar         # 后端 JAR
│   ├── mall-admin.log              # 后端日志
│   ├── mall-backend.log            # 后端日志
│   └── logs/sys-error.log          # 错误日志
├── mall_admin_ui/                  # 前端静态文件
├── cretas-backend-system-1.0.0.jar # Cretas 后端
├── cretas-backend.log              # Cretas 日志
└── nohup.out                       # 启动输出日志
```

## 服务端口

| 服务 | 端口 |
|------|------|
| MallCenter 后端 | 8080 |
| MallCenter 前端 | 8081 (Nginx) |
| Cretas 后端 | 10010 |

## 常用命令

### 查看后端日志
```bash
ssh root@139.196.165.140 "tail -100 /www/wwwroot/project/mall_center/mall-admin.log"
```

### 查看错误日志
```bash
ssh root@139.196.165.140 "tail -50 /www/wwwroot/project/mall_center/logs/sys-error.log"
```

### 查看运行中的 Java 进程
```bash
ssh root@139.196.165.140 "ps aux | grep java | grep -v grep"
```

### 重启 MallCenter 后端
```bash
ssh root@139.196.165.140 "cd /www/wwwroot/project/mall_center && bash restart.sh"
```

## 数据库

| 项目 | 值 |
|------|-----|
| 数据库类型 | MySQL |
| 数据库名称 | joolun (MallCenter) |
| 主机 | localhost |
| 端口 | 3306 |

---
**最后更新**: 2025-12-27
