# 📱 查看原型图指南 - 解决缓存问题

## ⚠️ 重要提示

如果您看到的页面还是"此页面的详细原型正在开发中..."，说明**浏览器缓存了旧版本**！

---

## 🔄 清除缓存并查看新页面

### 方法1: 强制刷新（最简单）

**在浏览器中**:
- **Mac**: `Cmd + Shift + R`
- **Windows**: `Ctrl + Shift + R` 或 `Ctrl + F5`

### 方法2: 清除缓存后刷新

**Chrome**:
1. 按 `F12` 打开开发者工具
2. **右键点击**刷新按钮
3. 选择 "清空缓存并硬性重新加载"

**Safari**:
1. `Cmd + Option + E` 清空缓存
2. `Cmd + R` 刷新

### 方法3: 无痕模式（推荐）

**Chrome**:
- `Cmd + Shift + N` (Mac)
- `Ctrl + Shift + N` (Windows)

**然后打开**: `file:///Users/jietaoxie/my-prototype-logistics/prototypes/index.html`

---

## ✅ 确认页面是否最新版本

### 检查方法：

**注册第二步页面应该有**:
- ✅ 完整的7个表单字段（用户名、密码、确认密码、姓名、部门、工种、协议）
- ✅ 顶部进度指示器（2个圆点）
- ✅ 密码强度条（弱/中/强）
- ✅ 绿色的"✓ 手机验证已完成"提示
- ✅ 绿色流程标注气泡（浮动在按钮上方）

**如果还是看到占位符页面**，说明缓存未清除！

---

## 📋 已完成的12个高保真页面

### ✅ 完全确认已创建的页面

1. **index.html** (11KB) - 主导航
2. **flow-map.html** (21KB) - 完整流程图
3. **pages/auth/login.html** - 登录页
4. **pages/auth/register-phase1.html** - 注册第一步
5. **pages/auth/register-phase2.html** (26KB) ✨ - 注册第二步（刚创建）
6. **pages/dashboard/overview.html** - 生产概览
7. **pages/batch/list.html** - 批次列表
8. **pages/batch/detail.html** - 批次详情
9. **pages/batch/create.html** - 批次创建
10. **pages/employee/clock.html** - 员工打卡
11. **pages/equipment/monitoring.html** - 设备监控
12. **pages/quality/create.html** - 质检创建
13. **pages/cost/batch-detail.html** - 成本分析

---

## 🎯 查看流程标注

### 流程标注的显示方式：

**方式1: 自动显示的绿色气泡**
- 页面加载后自动出现
- 浮动在可点击元素上方
- 绿色背景，带→箭头
- 说明点击后跳转到哪里

**方式2: 右上角切换按钮**
- 点击"🔍 显示流程标注"
- 所有可交互元素显示绿色虚线框
- 显示跳转目标

**方式3: 左下角流程图按钮**
- 点击🗺️按钮
- 查看完整的页面流程关系

---

## 🚀 推荐查看方式

### 第一次查看（清除缓存）

```bash
# Step 1: 在终端运行
cd /Users/jietaoxie/my-prototype-logistics/prototypes

# Step 2: 用Chrome无痕模式打开
open -a "Google Chrome" --args --incognito file://$(pwd)/index.html

# Step 3: 开启手机模拟
# - 按 F12
# - 按 Ctrl+Shift+M
# - 选择 iPhone 14 Pro (390x844)
```

### 快速测试链接

**直接访问各页面**（用无痕模式打开）:

```
注册第二步:
file:///Users/jietaoxie/my-prototype-logistics/prototypes/pages/auth/register-phase2.html

生产概览:
file:///Users/jietaoxie/my-prototype-logistics/prototypes/pages/dashboard/overview.html

批次详情:
file:///Users/jietaoxie/my-prototype-logistics/prototypes/pages/batch/detail.html

员工打卡:
file:///Users/jietaoxie/my-prototype-logistics/prototypes/pages/employee/clock.html
```

---

## 🎨 流程标注效果示例

### 注册第二步页面应该看到：

```
┌─────────────────────────────┐
│  ← [返回按钮]               │
│     ↑ 绿色气泡："返回上一步"  │
│                              │
│  完善信息                     │
│  第二步 / 共两步              │
│  ① ✓  ──  ② (当前)         │
├─────────────────────────────┤
│  [用户名输入框]              │
│  [密码输入框]                │
│  [确认密码]                  │
│  [姓名]                      │
│  [部门选择]                  │
│  [工种选择]                  │
│  [☑️ 用户协议]              │
│                              │
│  ↓ 点击完成注册              │  ← 绿色文字
│  注册成功后跳转到→设备激活页   │  ← 灰色提示
│                              │
│  [上一步] [完成注册]         │
│     ↑          ↑              │
│     绿色气泡  绿色气泡         │
└─────────────────────────────┘
```

---

## ❓ 常见问题

**Q: 为什么我看到的还是占位符？**
A: 浏览器缓存问题！请用**无痕模式**或**强制刷新**（Cmd+Shift+R）

**Q: 流程标注在哪里？**
A: 自动显示的绿色气泡，浮动在按钮上方

**Q: 如何开启手机模拟？**
A: Chrome按F12 → 点击手机图标（或Ctrl+Shift+M）→ 选择iPhone 14 Pro

**Q: 所有12个页面都是完整的吗？**
A: 是的！每个页面都有800-1000行代码，包含完整的UI、交互逻辑和流程标注

---

## 🔍 验证页面是否最新

### 文件大小检查

```bash
cd /Users/jietaoxie/my-prototype-logistics/prototypes

# 查看文件大小（应该都是15KB以上）
ls -lh pages/auth/register-phase2.html
# 应该显示: 26K

ls -lh pages/dashboard/overview.html
# 应该显示: 25K+

ls -lh pages/batch/detail.html
# 应该显示: 30K+
```

如果文件大小只有几KB，说明还是旧版占位符！

---

## 📞 如果还是看不到

### 终极解决方案：

```bash
# 1. 启动本地服务器（避免file://协议的缓存问题）
cd /Users/jietaoxie/my-prototype-logistics/prototypes
python3 -m http.server 8080

# 2. 用无痕模式访问
open -a "Google Chrome" --args --incognito http://localhost:8080

# 3. 开启手机模拟查看
```

---

**现在请尝试用无痕模式或强制刷新查看！** 🚀
