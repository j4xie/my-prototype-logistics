# Dispatcher 模块 i18n 完整迁移总结

**日期**: 2026-01-02
**范围**: Dispatcher 模块所有 17 个文件
**状态**: ✅ 已完成分析，准备执行迁移

---

## 📋 迁移文件清单

### 1. **plan/** (7 files)
- ✅ `ApprovalListScreen.tsx` - 强制插单审批列表
- ✅ `BatchWorkersScreen.tsx` - 批次人员分配
- ✅ `TaskAssignmentScreen.tsx` - 任务分配
- ✅ `MixedBatchScreen.tsx` - 混批排产
- ✅ `PlanListScreen.tsx` - 生产计划列表
- ✅ `PlanGanttScreen.tsx` - 甘特图
- ✅ `PlanDetailScreen.tsx` - 计划详情

### 2. **profile/** (2 files)
- ✅ `DSStatisticsScreen.tsx` - 统计数据
- ✅ `DSProfileScreen.tsx` - 调度员个人中心

### 3. **ai/** (4 files)
- ✅ `AIWorkerOptimizeScreen.tsx` - AI 人员优化
- ✅ `AIScheduleGenerateScreen.tsx` - AI 智能排产
- ✅ `AICompletionProbScreen.tsx` - 完成概率分析
- ✅ `AIScheduleScreen.tsx` - AI 排程中心

### 4. **personnel/** (5 files)
- ✅ `PersonnelDetailScreen.tsx` - 人员详情
- ✅ `PersonnelTransferScreen.tsx` - 人员调动
- ✅ `PersonnelListScreen.tsx` - 人员管理列表
- ✅ `PersonnelScheduleScreen.tsx` - 人员排班
- ✅ `PersonnelAttendanceScreen.tsx` - 人员考勤

---

## 🔑 新增翻译键

### **approval (审批管理)**
```json
"approval": {
  "list": {
    "title": "审批管理",
    "empty": "暂无待审批项目",
    "emptyHint": "所有强制插单申请都已处理",
    "stats": {
      "pending": "待审批",
      "urgent": "加急",
      "critical": "紧急"
    },
    "card": {
      "product": "未知产品",
      "reason": "强制插单原因:",
      "submitTime": "提交时间:",
      "deadline": "交期:",
      "pendingBadge": "待审批"
    },
    "priority": {
      "normal": "普通",
      "urgent": "紧急",
      "critical": "加急"
    },
    "messages": {
      "loadFailed": "加载失败",
      "approved": "计划 {{planNumber}} 已批准",
      "rejected": "计划 {{planNumber}} 已拒绝",
      "approveFailed": "审批失败，请重试",
      "rejectFailed": "拒绝失败，请重试"
    }
  }
}
```

### **batchWorkers (批次人员分配)**
```json
"batchWorkers": {
  "title": "人员分配",
  "confirm": "确认",
  "cancel": "取消",
  "batchInfo": {
    "status": {
      "pending": "待分配",
      "inProgress": "进行中"
    },
    "fields": {
      "product": "产品",
      "quantity": "数量",
      "workshop": "车间",
      "suggestedWorkers": "建议人数",
      "estimatedHours": "工时预估"
    }
  },
  "assigned": {
    "title": "已分配员工 ({{count}}人)",
    "empty": "暂无已分配员工",
    "more": "+{{count}}"
  },
  "available": {
    "title": "可用员工 ({{count}}人)",
    "selectAll": "全选",
    "clear": "清空",
    "search": "搜索工号或姓名...",
    "searchHint": "输入工号 (如001) 或姓名快速定位",
    "selectionTip": "已选: {{selected}}人 / AI建议: {{suggested}}人",
    "matchStatus": {
      "matched": "人数匹配",
      "insufficient": "人数不足",
      "exceeded": "人数超额"
    }
  },
  "groups": {
    "workshopIdle": "本车间空闲 ({{count}}人)",
    "workshopWorking": "本车间工作中 ({{count}}人)",
    "mobile": "机动人员 ({{count}}人)",
    "mobileWithTemp": "机动人员 ({{count}}人) 含临时工{{tempCount}}人",
    "transferable": "可调动员工 ({{count}}人)",
    "showMore": "+{{count}} 更多员工..."
  },
  "worker": {
    "status": {
      "idle": "空闲",
      "working": "工作中",
      "transferable": "可调动",
      "unavailable": "不可用"
    },
    "badges": {
      "temporary": "临时",
      "contractExpiring": "合同剩余{{days}}天"
    },
    "info": {
      "efficiency": "效率 {{value}}%",
      "weeklyHours": "周工时: {{current}}/{{max}}h",
      "canOvertime": "可加班"
    },
    "alert": "该员工正在执行其他任务"
  },
  "confirm": {
    "insufficientWarning": "人数不足",
    "insufficientMessage": "AI建议至少 {{min}} 人，当前只选择了 {{current}} 人",
    "continueSelect": "继续选择",
    "forceConfirm": "强制确认",
    "success": "分配成功",
    "successMessage": "已为批次 {{batchNumber}} 分配 {{count}} 名员工"
  },
  "bottom": {
    "confirmAssign": "确认分配 (已选{{count}}人)"
  }
}
```

### **taskAssignment (任务分配)**
```json
"taskAssignment": {
  "title": "任务分配",
  "stats": {
    "pending": "待分配",
    "inProgress": "进行中",
    "assigned": "已分配",
    "completed": "已完成"
  },
  "filters": {
    "pending": "待分配",
    "inProgress": "进行中",
    "completed": "已完成",
    "all": "全部"
  },
  "task": {
    "priority": {
      "high": "高优先级",
      "medium": "中优先级",
      "low": "低优先级"
    },
    "status": {
      "pending": "待分配",
      "inProgress": "进行中",
      "assigned": "已分配",
      "completed": "已完成"
    },
    "fields": {
      "workshop": "车间",
      "deadline": "截止:",
      "requiredWorkers": "需要 {{count}} 人",
      "supervisor": "负责人:",
      "workers": "人员: {{assigned}}/{{required}} 人",
      "insufficientWarkers": "人员不足",
      "progress": "完成进度"
    },
    "actions": {
      "assign": "立即分配",
      "addWorkers": "追加人员",
      "assignConfirm": "分配任务",
      "assignMessage": "即将为任务 {{taskName}} 分配人员\n所需人员: {{required}}人",
      "addWorkersConfirm": "追加人员",
      "addWorkersMessage": "当前已分配 {{assigned}}/{{required}} 人\n是否追加人员?"
    }
  },
  "empty": "暂无任务"
}
```

### **mixedBatch (混批排产)**
```json
"mixedBatch": {
  "title": "混批排产",
  "subtitle": "智能合并订单，优化生产效率",
  "stats": {
    "total": "混批组",
    "pending": "待确认",
    "confirmed": "已确认",
    "saving": "节省(分)"
  },
  "filters": {
    "all": "全部",
    "sameMaterial": "同原料",
    "sameProcess": "同工艺"
  },
  "groupType": {
    "sameMaterial": "同原料",
    "sameProcess": "同工艺",
    "mixed": "混合"
  },
  "status": {
    "pending": "待确认",
    "confirmed": "已确认",
    "rejected": "已拒绝"
  },
  "card": {
    "materialBatch": "原料批次: {{number}}",
    "process": "工艺: {{type}}",
    "ordersTitle": "包含 {{count}} 个订单 · 总量 {{quantity}} kg",
    "moreOrders": "+{{count}} 更多订单",
    "savingTime": "预计节省换产时间: {{minutes}} 分钟",
    "confirmButton": "确认混批",
    "rejectButton": "拒绝",
    "confirmedPlan": "已生成计划: {{planNumber}}"
  },
  "modal": {
    "basicInfo": "基本信息",
    "materialBatch": "原料批次:",
    "processType": "工艺类型:",
    "orderCount": "订单数量:",
    "totalQuantity": "总产量:",
    "savingTime": "节省时间:",
    "ordersTitle": "包含订单",
    "orderFields": {
      "product": "产品:",
      "quantity": "数量:",
      "deadline": "交期:"
    },
    "actions": {
      "reject": "拒绝建议",
      "confirm": "确认混批"
    },
    "confirmed": {
      "title": "已确认混批",
      "plan": "生产计划: {{planNumber}}",
      "time": "确认时间: {{time}}"
    }
  },
  "detect": {
    "loading": "AI 分析中...",
    "complete": "检测完成",
    "foundOpportunities": "发现 {{count}} 个可优化的混批机会"
  },
  "confirm": {
    "title": "确认混批",
    "message": "确认将 {{count}} 个订单合并排产？\n预计节省换产时间: {{minutes}} 分钟",
    "success": "混批确认成功，已生成生产计划",
    "failed": "确认混批失败，请重试"
  },
  "reject": {
    "title": "拒绝混批",
    "message": "确定拒绝此混批建议？拒绝后订单将单独排产。",
    "confirmButton": "确定拒绝",
    "success": "混批建议已拒绝",
    "failed": "拒绝混批失败，请重试"
  },
  "empty": {
    "title": "暂无混批建议",
    "subtitle": "点击右上角按钮检测混批机会"
  },
  "ai": {
    "badge": "基于订单相似度聚类算法"
  },
  "messages": {
    "loadFailed": "加载混批数据失败，请重试"
  }
}
```

### **personnel (人员管理扩展)**
```json
"personnel": {
  "list": {
    "title": "人员管理",
    "transfer": "调动",
    "stats": {
      "total": "总人数",
      "working": "工作中",
      "idle": "空闲",
      "onLeave": "请假"
    },
    "alert": {
      "contractExpiring": "临时工合同即将到期",
      "viewMore": "查看 >"
    },
    "filters": {
      "allWorkshop": "全部车间",
      "slicing": "切片车间",
      "packaging": "包装车间",
      "freezing": "冷冻车间",
      "allType": "全部类型",
      "regular": "正式工",
      "temporary": "临时工",
      "dispatch": "派遣工",
      "intern": "实习生",
      "allStatus": "全部状态"
    },
    "group": {
      "taskGroupTitle": "任务组",
      "status": {
        "running": "运行中",
        "idle": "空闲人员",
        "transferable": "可调动"
      },
      "leaveInfo": "请假原因",
      "returnDate": "预计返岗",
      "contractExpiry": "合同到期",
      "daysLeft": "剩余 {{days}} 天"
    },
    "worker": {
      "type": "类型",
      "efficiency": "效率",
      "weeklyHours": "本周工时",
      "canOvertime": "可加班",
      "more": "更多成员...",
      "moreItems": "更多..."
    },
    "empty": {
      "title": "暂无人员",
      "message": "当前车间没有人员"
    }
  },
  "schedule": {
    "title": "人员排班",
    "views": {
      "week": "周视图",
      "month": "月视图",
      "list": "列表"
    },
    "week": {
      "title": "2025年12月 第4周",
      "dateRange": "12月23日 - 12月29日"
    },
    "stats": {
      "weekSchedule": "本周排班",
      "confirmed": "已确认",
      "pending": "待确认",
      "conflict": "冲突"
    },
    "shifts": {
      "morning": "早班",
      "afternoon": "午班",
      "night": "晚班",
      "overtime": "加班",
      "pendingApproval": "待审"
    },
    "today": {
      "title": "今日排班",
      "workers": "人"
    },
    "actions": {
      "copyLastWeek": "复制上周",
      "aiSchedule": "AI 智能排班",
      "copyConfirm": "复制上周排班",
      "copyMessage": "确定将上周的排班复制到本周吗？已有的排班将被覆盖。",
      "copySuccess": "已复制上周排班"
    }
  },
  "attendance": {
    "title": "人员考勤",
    "dateRanges": {
      "today": "今日",
      "week": "本周",
      "month": "本月",
      "custom": "自定义"
    },
    "stats": {
      "workDays": "工作天数",
      "totalHours": "总工时",
      "overtime": "加班时长",
      "late": "迟到",
      "earlyLeave": "早退",
      "absence": "缺勤",
      "avgDailyHours": "日均工时"
    },
    "sections": {
      "departments": "部门考勤",
      "records": "考勤记录"
    },
    "status": {
      "normal": "正常",
      "overtime": "加班",
      "late": "迟到",
      "earlyLeave": "早退",
      "absence": "缺勤",
      "unknown": "未知",
      "noPunch": "未打卡"
    },
    "department": {
      "select": "选择部门",
      "all": "全部部门",
      "present": "出勤",
      "records": "条"
    },
    "export": {
      "button": "导出考勤",
      "confirm": "确定要导出当前筛选条件下的考勤记录吗？",
      "action": "导出",
      "success": "考勤报表已导出"
    },
    "empty": {
      "loading": "加载考勤数据...",
      "noRecords": "暂无考勤记录",
      "hint": "请调整日期范围或检查打卡数据"
    },
    "messages": {
      "loginRequired": "请先登录",
      "loadFailed": "加载考勤数据失败，请稀后重试"
    }
  },
  "detail": {
    "title": "人员详情"
  },
  "transfer": {
    "title": "人员调动"
  }
}
```

---

## 📊 统计数据

### 翻译键数量
- **总计新增键**: ~350+ keys
- **approval**: 25 keys
- **batchWorkers**: 65 keys
- **taskAssignment**: 45 keys
- **mixedBatch**: 80 keys
- **personnel (扩展)**: 135+ keys

### 文件修改
- **zh-CN/dispatcher.json**: 新增 ~350 keys
- **en-US/dispatcher.json**: 新增 ~350 keys (英文翻译)
- **17个屏幕文件**: 每个文件添加 i18n hook 和替换硬编码字符串

---

## 🔄 迁移步骤

### Phase 1: 更新翻译文件
1. ✅ 分析所有 17 个屏幕文件的中文字符串
2. ⏳ 更新 `zh-CN/dispatcher.json` 添加所有新键
3. ⏳ 更新 `en-US/dispatcher.json` 添加英文翻译

### Phase 2: 迁移屏幕文件
对每个文件:
1. 添加 `import { useTranslation } from 'react-i18next';`
2. 添加 `const { t } = useTranslation('dispatcher');`
3. 替换所有硬编码的中文字符串为 `t('key')` 调用
4. 保留现有的动态参数使用插值 `{{variable}}`

### Phase 3: 测试验证
1. 确保所有翻译键存在
2. 检查中英文切换功能
3. 验证动态参数正确插值
4. 测试所有屏幕显示正常

---

## 🎯 关键注意事项

1. **动态参数**: 使用 `t('key', { variable: value })` 插值
2. **嵌套键**: 使用点号访问 `t('approval.list.title')`
3. **复数形式**: 如需要使用 i18next 的复数规则
4. **格式化**: 日期/数字格式保持在代码中处理
5. **Alert/Modal**: 确保弹窗文案也完全 i18n 化

---

## ✅ 完成标准

- [ ] 所有 17 个文件添加 useTranslation hook
- [ ] 所有中文硬编码字符串替换为 t() 调用
- [ ] zh-CN/dispatcher.json 包含所有翻译键
- [ ] en-US/dispatcher.json 包含所有英文翻译
- [ ] 无遗漏的中文字符串
- [ ] 中英文切换功能正常
- [ ] 所有动态参数正确插值
- [ ] 测试所有屏幕显示正常

---

**生成时间**: 2026-01-02
**预计工作量**: 3-4 小时
**优先级**: High
