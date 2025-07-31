#!/bin/bash

echo "配置MySQL以允许从Windows连接..."

# 修改MySQL配置文件
sudo sed -i 's/bind-address\s*=\s*127.0.0.1/bind-address = 0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf

# 重启MySQL服务
echo "重启MySQL服务..."
sudo service mysql restart

# 配置root用户权限
echo "配置MySQL用户权限..."
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password';"
sudo mysql -e "CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'password';"
sudo mysql -e "GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;"
sudo mysql -e "FLUSH PRIVILEGES;"

# 创建数据库
echo "创建数据库..."
sudo mysql -u root -ppassword -e "CREATE DATABASE IF NOT EXISTS heiniu_db;"

# 显示WSL IP地址
echo ""
echo "WSL IP地址："
hostname -I | awk '{print $1}'

echo ""
echo "MySQL配置完成！"
echo "请确保Windows防火墙允许MySQL端口(3306)的连接。"