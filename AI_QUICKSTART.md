# 🚀 白垩纪 AI 成本分析 - 快速开始

## 一键启动（最快方式）

```cmd
start-all-services.cmd
```

**自动完成**:
- ✅ 启动 MySQL 数据库
- ✅ 启动 AI 服务 (8085)
- ✅ 启动后端 API (3001)
- ✅ 启动 React Native (3010)

---

## 快速测试

### 1. 测试 AI 服务

```cmd
cd backend-ai-chat
quick-test.cmd
```

### 2. 使用 App 测试

1. 打开 React Native App
2. 登录: `processing_admin / DeptAdmin@123`
3. 导航: 加工管理 → 批次管理 → 选择批次 → 成本分析
4. 点击 **"AI 智能分析"** 按钮 (紫色，带 ✨)
5. 查看 AI 分析结果

---

## 功能演示

### AI 智能分析按钮
![AI按钮](https://via.placeholder.com/400x80/8B5CF6/FFFFFF?text=AI+智能分析+✨)

**特点**:
- 🎨 紫色渐变设计
- ✨ Sparkles 图标
- 🔄 加载动画
- 💬 智能分析建议

### AI 分析结果
```
AI 分析建议 ✨                                              [X]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
根据提供的成本数据分析：

1. 成本结构分析：
   ✅ 原材料成本占比 55.6%，属于合理范围
   ⚠️  人工成本占比 33.3%，略高于行业平均（25-30%）
   ✅ 设备成本占比 11.1%，控制良好

2. 优化建议：
   💡 建议优化人员配置，减少 1-2 名操作工
   💡 提高员工工作效率，目标降低人工成本至 28%
   💡 考虑引入自动化设备，降低人工依赖

3. 利润提升方向：
   📈 当前利润率 40%，表现优秀
   📈 若人工成本降至 28%，利润率可提升至 45%
```

---

## 架构说明

```
React Native → Node.js API → FastAPI AI Service → Llama-3.1-8B
    (3010)        (3001)           (8085)           (Hugging Face)
```

---

## 常见问题

### Q: AI 服务启动失败？
A: 检查 `backend-ai-chat/.env` 中的 `HF_TOKEN` 是否配置

### Q: 提示"AI服务暂时不可用"？
A: 确保 AI 服务 (8085) 和后端 API (3001) 都在运行

### Q: 如何查看详细日志？
A: 查看各个终端窗口的输出

---

## 详细文档

- 📘 [完整集成说明](AI_INTEGRATION_COMPLETE.md)
- 🧪 [测试指南](backend-ai-chat/AI_INTEGRATION_TEST.md)
- ✅ [验证清单](VERIFICATION_CHECKLIST.md)
- 🔧 [技术集成指南](backend-ai-chat/INTEGRATION_GUIDE.md)

---

**版本**: v1.0.0 | **状态**: ✅ 生产就绪
