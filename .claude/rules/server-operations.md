# 服务器运维规范

## 服务器信息

| 项目 | 值 |
|------|-----|
| IP | 139.196.165.140 |
| 系统 | CentOS / Alibaba Cloud Linux |
| 面板 | 宝塔 (端口 17400) |
| 内存 | 7.3GB |
| 磁盘 | 40GB |

---

## 目录结构

```
/www/wwwroot/
├── cretas/          # Cretas 食品溯源 (主项目)
├── mall/            # 商城系统
│   ├── admin/       # 前端
│   ├── backend/     # 后端
│   └── data/        # 数据
├── showcase/        # 展示站点
└── web-admin/       # Web 管理
```

---

## 服务管理

| 服务 | 端口 | 管理方式 | 命令 |
|------|------|----------|------|
| Mall 后端 | 8080 | systemd | `systemctl restart mall-backend` |
| Cretas 后端 | 10010 | 脚本 | `bash /www/wwwroot/cretas/restart.sh` |
| Nginx | 80/443 | systemd | `systemctl restart nginx` |
| MySQL | 3306 | systemd | `systemctl restart mysql` |
| Redis | 6379 | systemd | `systemctl restart redis` |
| FRP | 7501 | systemd | `systemctl restart frps` |

---

## 常用运维命令

```bash
# 磁盘空间
df -h

# 内存使用
free -h

# 查看 Java 进程
ps aux | grep java

# 查看端口占用
netstat -tlnp | grep LISTEN

# 清理临时文件
rm -rf /tmp/onnxruntime-*

# 查看日志
tail -f /www/wwwroot/cretas/cretas-backend.log
tail -f /www/wwwroot/mall/backend/mall-admin.log
```

---

## 注意事项

1. **不要直接删除** `/www/wwwroot` 下的目录，先确认内容
2. **备份 jar 包**会自动生成 `.bak.*` 文件，定期清理
3. **日志文件**在 `logs/` 目录，会持续增长，需定期清理
4. **SSL 证书**在宝塔面板管理，注意过期时间
