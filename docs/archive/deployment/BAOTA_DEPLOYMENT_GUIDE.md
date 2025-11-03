# 宝塔服务器部署指南 - Python AI服务 + Java后端

## 📋 目录
1. [部署架构](#部署架构)
2. [准备工作](#准备工作)
3. [部署Python AI服务](#部署python-ai服务)
4. [部署Java后端](#部署java后端)
5. [测试验证](#测试验证)
6. [常见问题](#常见问题)

---

## 🏗️ 部署架构

```
宝塔服务器 (106.14.165.234 或 47.251.121.76)
├── Python AI服务
│   ├── 目录: /www/wwwroot/cretas-ai/
│   ├── 端口: 8085
│   └── 进程管理: systemd
│
├── Java Spring Boot
│   ├── 目录: /www/wwwroot/cretas/
│   ├── 文件: cretas-backend-system-1.0.0.jar
│   ├── 端口: 10010
│   └── 进程管理: restart.sh
│
└── MySQL数据库
    ├── 端口: 3306
    ├── 用户: cretas
    └── 数据库: cretas
```

---

## 🎯 准备工作

### 1. 连接服务器

```bash
# 使用SSH连接宝塔服务器
ssh root@106.14.165.234
# 或
ssh root@47.251.121.76
```

### 2. 检查环境

```bash
# 检查Python版本（需要Python 3.8+）
python3 --version

# 检查Java版本（需要Java 17）
java -version

# 检查MySQL
mysql --version
```

---

## 🐍 部署Python AI服务

### 步骤1: 创建目录

```bash
# 创建AI服务目录
mkdir -p /www/wwwroot/cretas-ai
cd /www/wwwroot/cretas-ai
```

### 步骤2: 上传文件

将以下文件上传到 `/www/wwwroot/cretas-ai/`：

```
backend-ai-chat/
├── main.py           # AI服务主文件
├── requirements.txt  # Python依赖
└── .env             # 环境变量配置
```

**使用宝塔面板上传**:
1. 打开宝塔面板: `https://106.14.165.234:8888`
2. 进入 "文件" 管理
3. 导航到 `/www/wwwroot/cretas-ai/`
4. 上传上述文件

**或使用SCP上传**:
```bash
# 在本地电脑执行
scp backend-ai-chat/main.py root@106.14.165.234:/www/wwwroot/cretas-ai/
scp backend-ai-chat/requirements.txt root@106.14.165.234:/www/wwwroot/cretas-ai/
```

### 步骤3: 创建环境变量文件

```bash
cd /www/wwwroot/cretas-ai

# 创建.env文件
cat > .env << 'EOF'
HF_TOKEN=YOUR_HF_TOKEN_HERE
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
EOF

# 设置权限
chmod 600 .env
```

### 步骤4: 安装Python依赖

```bash
cd /www/wwwroot/cretas-ai

# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate

# 升级pip
pip install --upgrade pip

# 安装依赖
pip install -r requirements.txt
```

**requirements.txt 内容**:
```txt
fastapi==0.115.6
uvicorn==0.34.0
pydantic==2.10.4
requests==2.32.3
redis==5.2.1
python-dotenv==1.0.1
```

### 步骤5: 创建启动脚本

```bash
cd /www/wwwroot/cretas-ai

# 创建启动脚本
cat > start.sh << 'EOF'
#!/bin/bash
cd /www/wwwroot/cretas-ai
source venv/bin/activate
nohup python main.py > ai-service.log 2>&1 &
echo $! > ai-service.pid
echo "AI服务已启动，PID: $(cat ai-service.pid)"
EOF

chmod +x start.sh

# 创建停止脚本
cat > stop.sh << 'EOF'
#!/bin/bash
if [ -f /www/wwwroot/cretas-ai/ai-service.pid ]; then
    kill $(cat /www/wwwroot/cretas-ai/ai-service.pid)
    rm /www/wwwroot/cretas-ai/ai-service.pid
    echo "AI服务已停止"
else
    echo "未找到运行的AI服务"
fi
EOF

chmod +x stop.sh

# 创建重启脚本
cat > restart.sh << 'EOF'
#!/bin/bash
bash /www/wwwroot/cretas-ai/stop.sh
sleep 2
bash /www/wwwroot/cretas-ai/start.sh
EOF

chmod +x restart.sh
```

### 步骤6: 配置Systemd服务（推荐）

```bash
# 创建systemd服务文件
sudo cat > /etc/systemd/system/cretas-ai.service << 'EOF'
[Unit]
Description=Cretas AI Cost Analysis Service
After=network.target

[Service]
Type=simple
User=www
WorkingDirectory=/www/wwwroot/cretas-ai
Environment="PATH=/www/wwwroot/cretas-ai/venv/bin"
ExecStart=/www/wwwroot/cretas-ai/venv/bin/python main.py
Restart=always
RestartSec=10
StandardOutput=append:/www/wwwroot/cretas-ai/ai-service.log
StandardError=append:/www/wwwroot/cretas-ai/ai-service.log

[Install]
WantedBy=multi-user.target
EOF

# 重新加载systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start cretas-ai

# 设置开机自启
sudo systemctl enable cretas-ai

# 查看状态
sudo systemctl status cretas-ai
```

### 步骤7: 验证AI服务

```bash
# 检查服务状态
sudo systemctl status cretas-ai

# 查看日志
tail -f /www/wwwroot/cretas-ai/ai-service.log

# 测试接口
curl http://localhost:8085/
```

**预期响应**:
```json
{
  "service": "食品加工数据分析 API",
  "status": "running",
  "model": "Llama-3.1-8B-Instruct"
}
```

### 步骤8: 配置防火墙（如果需要外部访问）

```bash
# 如果需要从外部访问AI服务（通常不需要，只有Java后端内部访问）
# 开放8085端口
firewall-cmd --permanent --add-port=8085/tcp
firewall-cmd --reload
```

---

## ☕ 部署Java后端

### 步骤1: 编译JAR包

**在本地电脑上编译**:
```bash
cd /Users/jietaoxie/Downloads/cretas-backend-system-main

# 使用Maven编译
mvn clean package -DskipTests

# JAR包位置
# target/cretas-backend-system-1.0.0.jar
```

### 步骤2: 上传JAR包到服务器

```bash
# 使用SCP上传
scp target/cretas-backend-system-1.0.0.jar root@106.14.165.234:/www/wwwroot/cretas/
```

**或使用宝塔面板上传**:
1. 打开宝塔面板文件管理
2. 导航到 `/www/wwwroot/cretas/`
3. 上传 `cretas-backend-system-1.0.0.jar`

### 步骤3: 确认restart.sh脚本

```bash
cd /www/wwwroot/cretas

# 查看现有的restart.sh
cat restart.sh
```

**应该包含**:
```bash
#!/bin/bash
cd /www/wwwroot/cretas
ps aux | grep cretas-backend-system | grep -v grep | awk '{print $2}' | xargs -r kill -9
sleep 2
nohup java -jar cretas-backend-system-1.0.0.jar --server.port=10010 > cretas-backend.log 2>&1 &
echo "Started with PID: $!"
```

### 步骤4: 重启Java服务

```bash
cd /www/wwwroot/cretas
bash restart.sh

# 查看日志
tail -f cretas-backend.log
```

### 步骤5: 验证Java服务

```bash
# 检查进程
ps aux | grep cretas-backend-system

# 测试接口
curl http://localhost:10010/api/mobile/F001/processing/ai-service/health
```

---

## ✅ 测试验证

### 测试1: AI服务独立测试

```bash
# 测试AI服务健康检查
curl http://localhost:8085/

# 测试AI对话功能
curl -X POST http://localhost:8085/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "这个批次的人工成本占比45%，设备成本20%，原材料35%。请分析是否合理？",
    "user_id": "test_factory_001"
  }'
```

### 测试2: Java后端AI集成测试

```bash
# 测试Java后端的AI健康检查
curl http://localhost:10010/api/mobile/F001/processing/ai-service/health

# 测试AI成本分析（需要先有批次数据）
curl -X POST http://localhost:10010/api/mobile/F001/processing/batches/1/ai-cost-analysis
```

### 测试3: 完整流程测试

```bash
# 1. 获取批次成本数据
curl http://localhost:10010/api/mobile/F001/processing/batches/1/cost-analysis

# 2. AI分析
curl -X POST http://localhost:10010/api/mobile/F001/processing/batches/1/ai-cost-analysis

# 3. 查看分析结果（从上一步的响应中获取sessionId）
curl http://localhost:10010/api/mobile/F001/processing/ai-sessions/{sessionId}
```

---

## 🔧 服务管理命令

### Python AI服务

```bash
# 查看状态
sudo systemctl status cretas-ai

# 启动服务
sudo systemctl start cretas-ai

# 停止服务
sudo systemctl stop cretas-ai

# 重启服务
sudo systemctl restart cretas-ai

# 查看日志
tail -f /www/wwwroot/cretas-ai/ai-service.log

# 或使用脚本
cd /www/wwwroot/cretas-ai
bash start.sh      # 启动
bash stop.sh       # 停止
bash restart.sh    # 重启
```

### Java后端服务

```bash
# 重启Java服务
cd /www/wwwroot/cretas
bash restart.sh

# 查看日志
tail -f /www/wwwroot/cretas/cretas-backend.log

# 查看进程
ps aux | grep cretas-backend-system

# 停止服务
ps aux | grep cretas-backend-system | grep -v grep | awk '{print $2}' | xargs kill -9
```

---

## 🐛 常见问题

### 问题1: AI服务启动失败

**检查**:
```bash
# 查看日志
cat /www/wwwroot/cretas-ai/ai-service.log

# 常见原因
# 1. HF_TOKEN未配置
cat /www/wwwroot/cretas-ai/.env

# 2. 端口被占用
lsof -i:8085

# 3. Python依赖未安装
cd /www/wwwroot/cretas-ai
source venv/bin/activate
pip list
```

**解决**:
```bash
# 重新安装依赖
cd /www/wwwroot/cretas-ai
source venv/bin/activate
pip install -r requirements.txt

# 检查配置
cat .env

# 重启服务
sudo systemctl restart cretas-ai
```

### 问题2: Java无法连接AI服务

**检查**:
```bash
# 1. AI服务是否运行
curl http://localhost:8085/

# 2. Java配置是否正确
cat /www/wwwroot/cretas/application.yml | grep -A 3 "ai:"

# 3. 网络连接
telnet localhost 8085
```

**解决**:
```bash
# 确保AI服务运行
sudo systemctl status cretas-ai

# 确保Java配置正确 (url: http://localhost:8085)
# 重启Java服务
cd /www/wwwroot/cretas
bash restart.sh
```

### 问题3: AI响应慢或超时

**检查**:
```bash
# 查看AI服务日志
tail -f /www/wwwroot/cretas-ai/ai-service.log

# 测试Hugging Face连接
curl https://router.huggingface.co/
```

**解决**:
```bash
# 调整超时时间（在application.yml中）
timeout: 60000  # 增加到60秒
```

### 问题4: 内存不足

**检查**:
```bash
# 查看内存使用
free -m

# 查看进程内存
ps aux --sort=-%mem | head -10
```

**解决**:
```bash
# 如果内存不足，可以添加swap
dd if=/dev/zero of=/swapfile bs=1M count=2048
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## 📊 监控和维护

### 日志位置

| 服务 | 日志位置 |
|------|---------|
| Python AI | `/www/wwwroot/cretas-ai/ai-service.log` |
| Java后端 | `/www/wwwroot/cretas/cretas-backend.log` |
| MySQL | `/var/log/mysql/error.log` |

### 监控命令

```bash
# 实时查看AI服务日志
tail -f /www/wwwroot/cretas-ai/ai-service.log

# 实时查看Java日志
tail -f /www/wwwroot/cretas/cretas-backend.log

# 查看系统资源
htop

# 查看端口占用
netstat -tlnp | grep -E '(8085|10010|3306)'
```

### 定期维护

```bash
# 每周清理日志（超过100MB）
find /www/wwwroot/cretas-ai/ -name "*.log" -size +100M -exec truncate -s 0 {} \;
find /www/wwwroot/cretas/ -name "*.log" -size +100M -exec truncate -s 0 {} \;

# 每月重启服务
sudo systemctl restart cretas-ai
cd /www/wwwroot/cretas && bash restart.sh
```

---

## 🎯 部署检查清单

部署完成后，确认以下项目：

- [ ] Python AI服务运行在端口8085
- [ ] `curl http://localhost:8085/` 返回正常
- [ ] Java后端运行在端口10010
- [ ] `curl http://localhost:10010/api/mobile/F001/processing/ai-service/health` 返回正常
- [ ] 测试AI分析接口能正常返回结果
- [ ] 日志文件正常写入
- [ ] Systemd服务已设置开机自启
- [ ] 防火墙规则已配置
- [ ] 数据库连接正常

---

## 🚀 下一步

部署完成后：

1. **测试完整流程**
   ```bash
   # 运行集成测试
   bash test-ai-integration.sh
   ```

2. **在React Native中集成**
   - 使用新的API端点
   - 测试AI分析功能
   - 实现多轮对话

3. **监控和优化**
   - 监控AI服务性能
   - 优化提示词
   - 收集用户反馈

---

**部署文档版本**: v1.0.0
**最后更新**: 2025-01-09
**维护人**: Cretas Team

**如有问题，请查看日志或联系技术支持！** 🎉
