# ⚡ 快速开始指南

## 🎯 5分钟快速启动

### 前置要求
- ✅ Java 17+ 已安装
- ✅ MySQL 已安装
- ✅ Python 3.8+ 已安装
- ✅ Node.js + npm 已安装

### 启动全部服务（推荐）

```bash
# 进入项目根目录
cd /Users/jietaoxie/my-prototype-logistics

# 一键启动所有服务
bash start-complete-system.sh

# 等待所有服务启动完成（约30秒）
```

✅ **完成后，你会看到**:
- MySQL 正在运行
- Python AI 服务在 http://localhost:8085
- Spring Boot 后端在 http://localhost:10010
- React Native Expo 在新窗口中

---

## 🧪 验证系统正常

### 运行集成测试

```bash
bash test-integration.sh
```

✅ **预期输出**: 所有测试通过

---

## 📱 访问应用

### React Native 应用

1. 按 `a` 启动 Android 或 `i` 启动 iOS
2. 扫描二维码或使用 Expo Go 应用
3. 登录：admin / Admin@123456

### 测试时间范围分析

1. 打开应用 → Processing Dashboard
2. 点击"时间范围分析"
3. 选择日期范围
4. 点击"获取AI分析报告"

---

## 🔨 手动启动

### 1. MySQL
```bash
mysql.server start
```

### 2. Python AI
```bash
cd backend-java/backend-ai-chat
source venv/bin/activate
python main_enhanced.py
```

### 3. Spring Boot
```bash
cd backend-java
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home
mvn spring-boot:run
```

### 4. React Native
```bash
cd frontend/CretasFoodTrace
npm start
```

---

## 📚 完整文档

- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - 详细实现
- **[INTEGRATION_TEST_GUIDE.md](INTEGRATION_TEST_GUIDE.md)** - 测试指南

---

**🎉 准备好开始了！**
