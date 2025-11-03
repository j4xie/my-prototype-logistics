# 服务器地址更新总结

## ✅ 已完成的修改

### 新服务器地址
- **旧服务器**: `http://106.14.165.234:10010`
- **新服务器**: `http://139.196.165.140:10010`

### 修改的文件

#### 1. 前端配置
**文件**: `frontend/CretasFoodTrace/src/constants/config.ts`
```typescript
export const API_BASE_URL = 'http://139.196.165.140:10010';
```

#### 2. 测试脚本
**文件**: `test_server_106.sh`
- 登录URL: 已更新为 `139.196.165.140:10010`
- Dashboard API URL: 已更新为 `139.196.165.140:10010`

---

## 📋 下一步操作

### 1. 在新服务器上执行SQL

```bash
# 上传SQL文件到新服务器
scp ~/Downloads/cretas-backend-system-main/fix-document/init-final-users.sql root@139.196.165.140:/root/

# SSH登录新服务器
ssh root@139.196.165.140

# 执行SQL初始化
mysql -u root -p cretas < /root/init-final-users.sql
```

### 2. 重启React Native应用

```bash
cd ~/my-prototype-logistics/frontend/CretasFoodTrace
npx expo start --clear
```

### 3. 测试新服务器

```bash
cd ~/my-prototype-logistics
bash test_server_106.sh
```

---

## 🧪 验证清单

- [ ] SQL已上传到新服务器 (139.196.165.140)
- [ ] SQL已在新服务器执行成功
- [ ] 后端服务正常运行
- [ ] 测试脚本通过 (bash test_server_106.sh)
- [ ] React Native应用可以登录
- [ ] Dashboard显示数据

---

## 🔧 测试命令

### 测试登录
```bash
curl -X POST "http://139.196.165.140:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"proc_admin","password":"123456","factoryId":"F001"}'
```

### 测试Dashboard
```bash
# 先登录获取Token
TOKEN=$(curl -s -X POST "http://139.196.165.140:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"proc_admin","password":"123456","factoryId":"F001"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin).get('data', {}).get('accessToken', ''))")

# 测试Dashboard API
curl -X GET "http://139.196.165.140:10010/api/mobile/F001/processing/dashboard/production" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📚 相关文档

- **SQL初始化**: `~/Downloads/cretas-backend-system-main/fix-document/init-final-users.sql`
- **测试账号**: `TEST_ACCOUNTS.md`
- **快速指南**: `~/Downloads/cretas-backend-system-main/fix-document/README_QUICK_START.md`

---

## 🎯 测试账号

**工厂用户** (需要先执行SQL):
- 用户名: `proc_admin`
- 密码: `123456`
- 工厂ID: `F001`

**平台管理员**:
- 用户名: `admin`
- 密码: `123456`

---

**更新时间**: 2025-11-02
**新服务器**: 139.196.165.140:10010
**工厂ID**: F001
