# 🔧 安装Temurin JDK 11指南

**目的**: 安装与Lombok兼容的JDK版本以解决编译问题
**预计时间**: 5-10分钟

---

## 步骤1: 安装Temurin JDK 11

在终端执行以下命令（需要输入管理员密码）：

```bash
# 1. 安装Temurin 11
brew install --cask temurin@11
```

**说明**:
- 系统会提示输入管理员密码
- 下载大小约 180MB
- 安装时间 1-2分钟

---

## 步骤2: 验证安装

安装完成后，执行：

```bash
# 查看已安装的JDK版本
/usr/libexec/java_home -V
```

**预期输出**:
```
Matching Java Virtual Machines (2):
    11.0.29 (arm64) "Eclipse Adoptium" - "Temurin 11" /Library/Java/JavaVirtualMachines/temurin-11.jdk/Contents/Home
    11.0.29 (arm64) "Homebrew" - "OpenJDK 11" /opt/homebrew/Cellar/openjdk@11/11.0.29/libexec/openjdk.jdk/Contents/Home
```

---

## 步骤3: 切换到Temurin JDK

### 方案A: 临时切换（推荐）

```bash
# 在当前终端会话中使用Temurin
export JAVA_HOME=$(/usr/libexec/java_home -v 11)
export PATH="$JAVA_HOME/bin:$PATH"

# 验证切换成功
java -version
# 应该显示: OpenJDK Runtime Environment Temurin-11.0.29+7
```

### 方案B: 永久切换（可选）

如果您想让所有终端都使用Temurin：

```bash
# 1. 编辑shell配置文件
# 如果使用bash:
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 11)' >> ~/.bash_profile
echo 'export PATH="$JAVA_HOME/bin:$PATH"' >> ~/.bash_profile
source ~/.bash_profile

# 如果使用zsh（macOS默认）:
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 11)' >> ~/.zshrc
echo 'export PATH="$JAVA_HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

---

## 步骤4: 重新编译后端项目

```bash
# 1. 进入项目目录
cd /Users/jietaoxie/my-prototype-logistics/backend-java

# 2. 清理并编译
mvn clean package -DskipTests

# 3. 检查编译结果
# 应该看到: [INFO] BUILD SUCCESS
ls -lh target/cretas-backend-system-1.0.0.jar
```

**预期结果**:
```
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  XX.XXX s
```

---

## 步骤5: 重启后端服务

```bash
# 1. 停止旧服务（如果运行中）
kill $(lsof -ti:10010)

# 2. 启动新服务
cd /Users/jietaoxie/my-prototype-logistics/backend-java
java -jar target/cretas-backend-system-1.0.0.jar --server.port=10010 &

# 3. 查看日志（等待5秒）
sleep 5
tail -50 nohup.out 2>/dev/null || echo "服务启动中..."

# 4. 验证服务运行
curl http://localhost:10010/api/mobile/health
```

---

## 步骤6: 执行API测试

```bash
# 1. 准备测试数据
cd /Users/jietaoxie/my-prototype-logistics
mysql -u root -p cretas_db < prepare_test_data.sql

# 2. 执行API测试
bash test_backend_apis.sh
```

---

## ❌ 如果遇到问题

### 问题1: brew命令未找到

```bash
# 安装Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 问题2: 安装失败（权限问题）

```bash
# 检查Homebrew权限
sudo chown -R $(whoami) /opt/homebrew

# 重新尝试安装
brew install --cask temurin@11
```

### 问题3: 编译仍然失败

```bash
# 确认使用的是Temurin JDK
java -version | grep Temurin

# 如果不是，重新设置JAVA_HOME
export JAVA_HOME=$(/usr/libexec/java_home -v 11)

# 清理Maven缓存
rm -rf ~/.m2/repository/org/projectlombok

# 重新编译
mvn clean package -DskipTests
```

### 问题4: 端口10010被占用

```bash
# 查找占用端口的进程
lsof -i:10010

# 强制终止
kill -9 $(lsof -ti:10010)
```

---

## ✅ 成功标准

安装和测试成功的标志：

1. **JDK安装成功**:
   ```bash
   java -version
   # 输出包含 "Temurin"
   ```

2. **编译成功**:
   ```bash
   # 看到 BUILD SUCCESS
   # JAR文件存在: target/cretas-backend-system-1.0.0.jar
   ```

3. **服务运行**:
   ```bash
   lsof -i:10010
   # 显示Java进程
   ```

4. **API测试通过**:
   ```bash
   # test_backend_apis.sh 输出 "✅ 测试通过"
   ```

---

## 📞 快速命令汇总

复制以下所有命令到终端一次性执行：

```bash
# 完整安装和测试流程
brew install --cask temurin@11
export JAVA_HOME=$(/usr/libexec/java_home -v 11)
export PATH="$JAVA_HOME/bin:$PATH"
java -version

cd /Users/jietaoxie/my-prototype-logistics/backend-java
mvn clean package -DskipTests

kill $(lsof -ti:10010) 2>/dev/null
java -jar target/cretas-backend-system-1.0.0.jar --server.port=10010 &
sleep 5

cd /Users/jietaoxie/my-prototype-logistics
mysql -u root -p cretas_db < prepare_test_data.sql
bash test_backend_apis.sh
```

---

**创建时间**: 2025-11-20
**预计完成时间**: 5-10分钟
**状态**: 等待用户执行
