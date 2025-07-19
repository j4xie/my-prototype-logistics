# 🚀 立即安装MySQL

## 执行安装脚本

在终端中运行以下命令：

```bash
# 进入后端目录
cd /mnt/c/Users/Steve/heiniu/backend

# 执行MySQL安装脚本
./scripts/install-mysql-ubuntu.sh
```

## 安装脚本将完成以下操作：

1. ✅ 更新Ubuntu包索引
2. ✅ 安装MySQL服务器
3. ✅ 启动并启用MySQL服务
4. ✅ 设置root密码为: `password`
5. ✅ 创建数据库 `heiniu_db`
6. ✅ 验证安装和连接

## 如果遇到权限问题

如果脚本无法执行，请确保：
- 您有sudo权限
- 脚本有执行权限：`chmod +x scripts/install-mysql-ubuntu.sh`

## 手动安装（备选方案）

如果脚本无法运行，请手动执行：

```bash
# 1. 更新包索引
sudo apt update

# 2. 安装MySQL
sudo apt install mysql-server -y

# 3. 启动服务
sudo systemctl start mysql
sudo systemctl enable mysql

# 4. 设置root密码
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password';"
sudo mysql -e "FLUSH PRIVILEGES;"

# 5. 创建数据库
sudo mysql -u root -ppassword -e "CREATE DATABASE IF NOT EXISTS heiniu_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 6. 验证安装
mysql --version
mysql -u root -ppassword -e "SELECT VERSION();"
```

## 安装完成后

MySQL安装完成后，我们将继续：
1. 运行数据库迁移脚本
2. 创建初始数据
3. 测试API接口

**请执行安装脚本，然后告诉我安装结果！**