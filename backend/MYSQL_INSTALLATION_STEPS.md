# MySQL 安装步骤指南

## 当前状态
- 系统：Ubuntu 22.04.5 LTS
- MySQL状态：未安装
- 需要sudo权限进行安装

## 安装步骤

### 1. 更新包索引
```bash
sudo apt update
```

### 2. 安装MySQL服务器
```bash
sudo apt install mysql-server
```

### 3. 启动MySQL服务
```bash
sudo systemctl start mysql
sudo systemctl enable mysql
```

### 4. 配置MySQL安全设置
```bash
sudo mysql_secure_installation
```

在此过程中会询问：
- 是否设置密码验证插件：选择 `No` 或 `Low`
- 设置root密码：输入 `password`（或您选择的密码）
- 删除匿名用户：选择 `Yes`
- 禁用root远程登录：选择 `Yes`
- 删除test数据库：选择 `Yes`
- 重新加载权限表：选择 `Yes`

### 5. 验证MySQL安装
```bash
mysql --version
systemctl status mysql
```

### 6. 登录MySQL测试
```bash
mysql -u root -p
```
输入密码后应能成功登录。

## 安装完成后的下一步

1. 确认MySQL服务正在运行
2. 确认root密码已设置
3. 运行数据库设置脚本：
   ```bash
   cd /mnt/c/Users/Steve/heiniu/backend
   node scripts/setup-database.js
   ```

## 注意事项
- 如果您选择了不同的root密码，请记住修改：
  - `backend/.env` 文件中的 `DATABASE_URL`
  - `backend/scripts/setup-database.js` 中的 `DB_CONFIG.password`
- 确保MySQL服务在系统启动时自动启动
- 防火墙需要允许3306端口访问（如果需要远程连接）

## 故障排除
如果遇到问题，可以：
1. 检查MySQL服务状态：`sudo systemctl status mysql`
2. 查看MySQL日志：`sudo journalctl -u mysql`
3. 重启MySQL服务：`sudo systemctl restart mysql`