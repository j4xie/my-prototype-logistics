# 测试命令快速参考

## 🎯 必须执行的命令

### 1. TypeScript编译检查
```bash
cd frontend/CretasFoodTrace
npx tsc --noEmit
```

**预期输出**: 无错误信息
**如果有错误**: 记录错误信息并修复

---

### 2. 启动开发服务器
```bash
cd frontend/CretasFoodTrace
npx expo start
```

**选项**:
- 按 `a` - 在Android模拟器/设备上打开
- 按 `i` - 在iOS模拟器上打开（仅macOS）
- 按 `w` - 在浏览器中打开
- 按 `r` - 重新加载应用

---

## 📱 测试账号

### 工厂管理员
```
用户名: admin
密码: Admin@123456
权限: factory_super_admin
用途: 测试批次编辑、管理功能
```

### 平台管理员
```
用户名: platform_admin (待确认)
密码: (待确认)
权限: platform_admin
用途: 测试平台管理功能
```

### 普通员工
```
用户名: operator (待确认)
密码: (待确认)
权限: operator
用途: 测试考勤功能、权限控制
```

---

## 🧪 可选的额外命令

### 清除缓存重启
```bash
npx expo start --clear
```

### 检查依赖
```bash
npm install
```

### 查看日志
```bash
# 在另一个终端窗口
npx expo start --log
```

---

## 📊 测试流程

### 快速测试（20分钟）
1. 运行 TypeScript 检查
2. 启动 Expo 服务器
3. 按照 `QUICK_TEST_CHECKLIST.md` 执行核心功能测试

### 完整测试（2-3小时）
1. 运行 TypeScript 检查
2. 启动 Expo 服务器
3. 按照 `TESTING_GUIDE.md` 执行完整测试

---

## 🐛 常见问题

### Q: TypeScript检查报错
**A**:
1. 检查是否所有依赖已安装: `npm install`
2. 检查node版本: `node --version` (需要 >= 18)
3. 查看具体错误信息并修复

### Q: Expo服务器启动失败
**A**:
1. 检查端口是否被占用（默认3010）
2. 清除缓存: `npx expo start --clear`
3. 重新安装依赖: `rm -rf node_modules && npm install`

### Q: 应用在设备上无法连接
**A**:
1. 确保设备和电脑在同一网络
2. Android: 检查USB调试是否开启
3. iOS: 检查开发者模式是否开启

### Q: 后端API调用失败（404错误）
**A**:
这是正常的！后端的 `updateBatch` API尚未实现
- 前端功能已完成
- 只需要记录此情况即可
- 等待后端实现后再测试完整流程

---

## ✅ 测试通过标准

### 必须通过（P0）
- [ ] TypeScript编译无错误
- [ ] 应用能启动并运行
- [ ] 批次详情页显示编辑按钮
- [ ] 考勤页面显示统计入口
- [ ] 平台管理员能看到平台Tab

### 应该通过（P1）
- [ ] 批次编辑页面能正确加载数据
- [ ] 所有导航功能正常
- [ ] 权限控制正确
- [ ] 无应用崩溃

### 最好通过（P2）
- [ ] 批次更新API调用成功（需后端支持）
- [ ] 所有数据正确保存

---

## 📞 需要帮助？

### 文档参考
- **快速测试**: `QUICK_TEST_CHECKLIST.md`
- **详细测试**: `TESTING_GUIDE.md`
- **完成总结**: `PHASE1-4_COMPLETION_SUMMARY.md`

### 测试重点
1. **批次编辑**: 最重要的新功能
2. **考勤统计**: 用户体验优化
3. **平台管理**: Phase 4核心功能

---

**开始测试**: 执行以下命令开始
```bash
cd frontend/CretasFoodTrace
npx tsc --noEmit && npx expo start
```

祝测试顺利！🎉
