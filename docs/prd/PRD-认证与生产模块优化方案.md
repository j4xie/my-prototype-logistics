# 白垩纪食品溯源系统 - 认证与生产模块优化方案

**文档版本**: v1.0
**创建日期**: 2025-01-05
**优化周期**: 8-10周
**当前状态**: Phase 0-3 已完成，开始优化

---

## 📋 目录

1. [当前状态分析](#当前状态分析)
2. [问题诊断](#问题诊断)
3. [优化方案](#优化方案)
4. [实施计划](#实施计划)
5. [验收标准](#验收标准)

---

## 📊 当前状态分析

### ✅ 已完成的核心功能（Phase 0-3）

#### 1. 认证系统

**后端API**:
- ✅ `POST /api/mobile/auth/unified-login` - 统一登录（平台+工厂用户）
- ✅ `POST /api/mobile/auth/register-phase-one` - 手机验证
- ✅ `POST /api/mobile/auth/register-phase-two` - 完成注册
- ✅ `POST /api/mobile/auth/bind-device` - 设备绑定
- ✅ `POST /api/mobile/auth/refresh-token` - Token刷新
- ✅ `GET /api/mobile/auth/profile` - 用户信息
- ✅ `GET /api/mobile/auth/devices` - 设备列表
- ✅ `POST /api/mobile/auth/logout` - 登出

**权限系统**:
- ✅ 7级角色权限体系
  - Platform: `platform_admin`
  - Factory: `factory_super_admin`, `permission_admin`, `department_admin`, `operator`, `viewer`, `unactivated`
- ✅ 批量权限检查 API
- ✅ 部门权限隔离（farming, processing, logistics, quality, management）

**前端页面**:
- ✅ `EnhancedLoginScreen.tsx` - 登录页面
- ✅ 支持生物识别登录
- ✅ 支持自动登录
- ✅ 支持记住密码

#### 2. 生产管理系统

**后端API - 批次管理**:
- ✅ `POST /api/mobile/processing/batches` - 创建批次
- ✅ `GET /api/mobile/processing/batches` - 批次列表（分页、筛选）
- ✅ `GET /api/mobile/processing/batches/:id` - 批次详情
- ✅ `PUT /api/mobile/processing/batches/:id` - 更新批次
- ✅ `DELETE /api/mobile/processing/batches/:id` - 删除批次
- ✅ `POST /api/mobile/processing/batches/:id/start` - 开始生产
- ✅ `POST /api/mobile/processing/batches/:id/complete` - 完成生产
- ✅ `GET /api/mobile/processing/batches/:id/timeline` - 批次时间线

**后端API - 质检管理**:
- ✅ `POST /api/mobile/processing/quality/inspections` - 创建质检
- ✅ `GET /api/mobile/processing/quality/inspections` - 质检列表
- ✅ `GET /api/mobile/processing/quality/statistics` - 质检统计
- ✅ `GET /api/mobile/processing/quality/trends` - 质检趋势

**后端API - 员工管理**:
- ✅ `POST /api/mobile/timeclock/clock-in` - 上班打卡
- ✅ `POST /api/mobile/timeclock/clock-out` - 下班打卡
- ✅ `GET /api/mobile/timeclock/status` - 打卡状态
- ✅ `GET /api/mobile/timeclock/history` - 打卡历史
- ✅ `GET /api/mobile/time-stats/daily` - 日统计
- ✅ `GET /api/mobile/time-stats/weekly` - 周统计
- ✅ `GET /api/mobile/time-stats/monthly` - 月统计

**后端API - 设备监控**:
- ✅ `GET /api/mobile/processing/equipment/monitoring` - 设备监控
- ✅ `GET /api/mobile/processing/equipment/:id/status` - 设备状态
- ✅ `GET /api/mobile/processing/alerts` - 告警列表

**后端API - 成本分析**:
- ✅ `GET /api/mobile/processing/batches/:id/cost-analysis` - 批次成本分析
- ✅ `POST /api/mobile/processing/ai-cost-analysis` - AI成本分析（Mock）
- ✅ `GET /api/mobile/processing/dashboard/overview` - 仪表板概览

**数据库表**:
- ✅ `processing_batches` - 批次管理
- ✅ `quality_inspections` - 质检记录
- ✅ `employee_time_clocks` - 打卡记录
- ✅ `employee_work_sessions` - 工作时段
- ✅ `factory_equipment` - 设备管理
- ✅ `device_monitoring_data` - 设备监控数据
- ✅ `alert_notifications` - 告警通知

**前端页面**:
- ✅ `TimeClockScreen.tsx` - 打卡主页
- ✅ `ClockHistoryScreen.tsx` - 打卡历史
- ✅ `TimeStatisticsScreen.tsx` - 工时统计
- ✅ `ProcessingDashboardScreen.tsx` - 生产仪表板
- ✅ `MaterialReceiptScreen.tsx` - 原料接收
- ✅ `CostAnalysisDashboard.tsx` - 成本仪表板
- ✅ `DeepSeekAnalysisScreen.tsx` - AI分析

### 📊 功能完成度统计

| 模块 | 后端API | 数据库 | 前端UI | 完成度 |
|-----|---------|--------|--------|--------|
| **认证系统** | 100% | 100% | 80% | 93% |
| **批次管理** | 100% | 100% | 30% | 77% |
| **质检管理** | 100% | 100% | 20% | 73% |
| **员工管理** | 100% | 100% | 70% | 90% |
| **设备监控** | 100% | 100% | 10% | 70% |
| **成本分析** | 80% | 100% | 40% | 73% |

**总体完成度**: **约77%**

---

## ⚠️ 问题诊断

### 1. 代码质量问题

#### 1.1 Mock代码未清理

**位置**: `backend/src/routes/mobile.js`

**问题1**: 旧版登录接口使用Mock数据（第60-114行）
```javascript
// ❌ 问题代码
router.post('/auth/mobile-login', async (req, res) => {
  const mockUser = {
    id: 1,
    username: username,
    role: 'developer',
    permissions: ['admin:all'],
  };
  // ... Mock响应
});
```

**影响**:
- 存在两个登录接口，容易混淆
- Mock数据绕过了真实认证逻辑
- 潜在安全风险

**解决方案**: 删除此接口，统一使用 `unified-login`

---

**问题2**: DeepSeek分析使用Mock结果（第154-184行）
```javascript
// ❌ 问题代码
router.post('/analysis/deepseek', mobileAuthMiddleware, async (req, res) => {
  const mockAnalysisResult = {
    analysis: '基于提供的数据，系统检测到以下问题...',
    recommendations: ['建议调整温度控制', '增加质检频率'],
    confidence: 0.85,
    cost: 0.02
  };
  res.json({ result: mockAnalysisResult });
});
```

**影响**:
- AI分析功能不可用
- 无法提供真实的成本优化建议
- 用户体验差

**解决方案**: 集成真实DeepSeek API

---

**问题3**: 激活码硬编码（第187-240行）
```javascript
// ❌ 问题代码
const validCodes = ['DEV_TEST_2024', 'HEINIU_MOBILE_2024', 'PROD_ACTIVATION'];
if (!validCodes.includes(activationCode)) {
  return res.status(400).json({ message: '无效的激活码' });
}
```

**影响**:
- 激活码无法动态管理
- 无法追踪激活记录
- 无法设置过期时间

**解决方案**: 从数据库 `activation_codes` 表读取

---

#### 1.2 临时代码未优化

**位置**: `backend/src/middleware/mobileAuth.js`

**问题**: 平台管理员临时分配工厂ID（第78-90行）
```javascript
// ❌ 问题代码
const availableFactory = await prisma.factory.findFirst({
  where: { isActive: true }
});

req.factoryId = availableFactory?.id || null; // 临时分配
```

**影响**:
- 平台管理员无法正确访问所有工厂
- 权限验证逻辑不准确

**解决方案**: 优化平台管理员权限逻辑，支持跨工厂访问

---

### 2. 前端UI缺失问题

#### 2.1 批次管理界面缺失

**缺失页面**:
- ❌ `BatchListScreen.tsx` - 批次列表页
- ❌ `BatchDetailScreen.tsx` - 批次详情页
- ❌ `BatchCreateScreen.tsx` - 创建批次页
- ❌ `BatchTimelineScreen.tsx` - 批次时间线页

**影响**:
- 用户无法在移动端创建批次
- 无法查看批次详情
- 无法进行批次操作（开始生产、完成生产）

**当前状态**:
- 后端API已完成 ✅
- 数据库表已完成 ✅
- 前端UI未开发 ❌

---

#### 2.2 质检管理界面缺失

**缺失页面**:
- ❌ `QualityInspectionListScreen.tsx` - 质检列表
- ❌ `QualityInspectionCreateScreen.tsx` - 创建质检
- ❌ `QualityInspectionDetailScreen.tsx` - 质检详情
- ❌ `QualityStatisticsScreen.tsx` - 质检统计

**影响**:
- 质检员无法录入质检记录
- 无法查看历史质检数据
- 质检统计功能无法使用

---

#### 2.3 设备监控界面缺失

**缺失页面**:
- ❌ `EquipmentListScreen.tsx` - 设备列表
- ❌ `EquipmentDetailScreen.tsx` - 设备详情
- ❌ `EquipmentMonitoringScreen.tsx` - 实时监控
- ❌ `EquipmentAlertsScreen.tsx` - 设备告警

**影响**:
- 无法在移动端查看设备状态
- 无法实时监控设备参数
- 告警无法及时查看

---

### 3. 用户体验问题

#### 3.1 登录体验待优化

**问题清单**:
1. 错误提示不够友好
   - 当前: `"登录失败"` （过于笼统）
   - 期望: `"密码错误，还剩2次尝试机会"` 或 `"网络连接失败，请检查网络设置"`

2. 加载状态不明显
   - 缺少加载动画
   - 用户不知道是否正在处理

3. 自动登录逻辑不完善
   - Token过期后无提示
   - 自动登录失败后未引导用户

---

#### 3.2 批次操作流程不清晰

**问题**:
- 批次状态流转规则不明确
- 用户不知道何时可以进行什么操作
- 缺少操作确认提示

**期望**:
```
planning (计划中)
  ↓ 可操作: [开始生产] [编辑] [删除]
in_progress (进行中)
  ↓ 可操作: [暂停] [完成生产]
quality_check (质检中)
  ↓ 可操作: [通过] [不通过]
completed (已完成)
  ✓ 只读
```

---

#### 3.3 数据加载性能问题

**问题**:
- 批次列表加载慢（未分页优化）
- 图片加载慢（未压缩）
- API响应慢（未缓存）

**性能目标**:
- API响应时间: <500ms
- 页面加载时间: <2秒
- 首屏渲染: <1秒

---

### 4. 功能完整性问题

#### 4.1 离线功能缺失

**缺失功能**:
- 打卡数据无法离线缓存
- 批次数据无法离线查看
- 离线数据无自动同步

**影响**:
- 网络不稳定时无法正常工作
- 用户体验差

---

#### 4.2 AI分析功能不可用

**问题**:
- DeepSeek API未集成
- 无法提供真实的成本分析
- 无法给出优化建议

**期望**:
- 真实AI分析
- 月度成本<¥30
- 缓存命中率>60%

---

## 🚀 优化方案

### 阶段1: 认证系统优化 (1-2周)

#### 1.1 移除Mock代码

**任务清单**:

1. **删除旧版登录接口**
   - [ ] 删除 `POST /api/mobile/auth/mobile-login` 接口
   - [ ] 更新前端代码，统一使用 `unified-login`
   - [ ] 添加接口废弃警告（兼容性过渡）

2. **优化激活码管理**
   - [ ] 创建激活码管理Controller
   - [ ] 从数据库读取激活码
   - [ ] 支持激活码创建、过期管理
   - [ ] 添加激活记录追踪

3. **优化平台管理员权限**
   - [ ] 修复临时工厂ID分配逻辑
   - [ ] 支持平台管理员跨工厂访问
   - [ ] 优化权限验证中间件

**技术实现**:

```javascript
// backend/src/controllers/activationController.js（优化）
export const verifyActivationCode = async (req, res, next) => {
  try {
    const { activationCode, deviceId } = req.body;

    // 从数据库查询激活码
    const code = await prisma.activationCode.findUnique({
      where: { code: activationCode }
    });

    if (!code) {
      throw new ValidationError('无效的激活码');
    }

    // 检查状态
    if (code.status !== 'active') {
      throw new ValidationError(`激活码已${code.status === 'expired' ? '过期' : '失效'}`);
    }

    // 检查使用次数
    if (code.usedCount >= code.maxUses) {
      throw new ValidationError('激活码已达使用上限');
    }

    // 检查有效期
    const now = new Date();
    if (now < code.validFrom || (code.validUntil && now > code.validUntil)) {
      throw new ValidationError('激活码不在有效期内');
    }

    // 创建激活记录
    await prisma.activationRecord.create({
      data: {
        activationCodeId: code.id,
        deviceId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // 更新使用次数
    await prisma.activationCode.update({
      where: { id: code.id },
      data: { usedCount: code.usedCount + 1 }
    });

    res.json({
      success: true,
      message: '激活成功',
      data: {
        activatedAt: new Date(),
        validUntil: code.validUntil
      }
    });
  } catch (error) {
    next(error);
  }
};
```

---

#### 1.2 前端登录体验优化

**优化内容**:

1. **优化错误提示**

```typescript
// frontend/CretasFoodTrace/src/hooks/useLogin.ts
const ERROR_MESSAGES = {
  'INVALID_CREDENTIALS': '用户名或密码错误',
  'ACCOUNT_LOCKED': '账号已锁定，请联系管理员',
  'NETWORK_ERROR': '网络连接失败，请检查网络设置',
  'TOKEN_EXPIRED': '登录已过期，请重新登录',
  'MAX_RETRIES_EXCEEDED': '登录失败次数过多，请稍后再试',
};

const handleLoginError = (error: any) => {
  const errorCode = error.code || 'UNKNOWN';
  const friendlyMessage = ERROR_MESSAGES[errorCode] || '登录失败，请重试';

  Alert.alert('登录失败', friendlyMessage, [
    { text: '重试', onPress: retry },
    { text: '取消', style: 'cancel' }
  ]);
};
```

2. **添加加载动画**

```typescript
// frontend/CretasFoodTrace/src/screens/auth/EnhancedLoginScreen.tsx
{isLoading && (
  <View style={styles.loadingOverlay}>
    <ActivityIndicator size="large" color="#007AFF" />
    <Text style={styles.loadingText}>正在登录...</Text>
  </View>
)}
```

3. **优化自动登录逻辑**

```typescript
useEffect(() => {
  const attemptAutoLogin = async () => {
    try {
      const hasValidToken = await checkTokenValidity();
      if (hasValidToken) {
        const success = await autoLogin();
        if (success) {
          navigateToMain();
        }
      }
    } catch (error) {
      // Token过期，静默处理
      console.log('Auto login failed, showing login form');
    }
  };

  attemptAutoLogin();
}, []);
```

---

#### 1.3 权限系统优化

**优化内容**:

1. **添加权限缓存**

```javascript
// backend/src/services/permissionCache.js（新建）
import NodeCache from 'node-cache';

class PermissionCache {
  constructor() {
    this.cache = new NodeCache({ stdTTL: 300 }); // 5分钟缓存
  }

  getUserPermissions(userId, userType) {
    const key = `${userType}_${userId}`;
    return this.cache.get(key);
  }

  setUserPermissions(userId, userType, permissions) {
    const key = `${userType}_${userId}`;
    this.cache.set(key, permissions);
  }

  clearUserPermissions(userId, userType) {
    const key = `${userType}_${userId}`;
    this.cache.del(key);
  }
}

export default new PermissionCache();
```

2. **优化批量权限检查**

```javascript
// backend/src/routes/mobile.js
router.post('/permissions/batch-check', mobileAuthMiddleware, async (req, res) => {
  const userId = req.user?.id || req.admin?.adminId;
  const userType = req.user ? 'factory_user' : 'platform_admin';

  // 尝试从缓存获取
  let userPermissions = permissionCache.getUserPermissions(userId, userType);

  if (!userPermissions) {
    // 缓存未命中，计算权限
    userPermissions = calculateUserPermissions(userType, userRole, department);
    permissionCache.setUserPermissions(userId, userType, userPermissions);
  }

  // 批量检查权限...
});
```

3. **添加权限审计日志**

```javascript
// backend/src/middleware/permissionAudit.js（新建）
export const auditPermissionCheck = async (req, res, next) => {
  const originalJson = res.json;

  res.json = function(data) {
    // 记录权限检查结果
    prisma.permissionAuditLog.create({
      data: {
        userId: req.user?.id,
        action: req.method + ' ' + req.path,
        result: data.success ? 'success' : 'failed',
        ipAddress: req.ip,
      }
    }).catch(console.error);

    return originalJson.call(this, data);
  };

  next();
};
```

---

### 阶段2: 生产模块UI开发 (3-4周)

#### 2.1 批次管理界面

**页面结构**:

```
frontend/CretasFoodTrace/src/screens/processing/
├── batch/
│   ├── BatchListScreen.tsx              # 批次列表
│   ├── BatchDetailScreen.tsx            # 批次详情
│   ├── BatchCreateScreen.tsx            # 创建批次
│   ├── BatchEditScreen.tsx              # 编辑批次
│   ├── BatchTimelineScreen.tsx          # 批次时间线
│   └── components/
│       ├── BatchCard.tsx                # 批次卡片组件
│       ├── BatchStatusBadge.tsx         # 状态徽章
│       ├── BatchFilterModal.tsx         # 筛选弹窗
│       └── BatchActionButtons.tsx       # 操作按钮组
└── index.ts
```

**功能清单**:

**1. BatchListScreen.tsx - 批次列表页**

```typescript
// 功能需求:
- [ ] 批次列表展示（卡片式）
- [ ] 下拉刷新
- [ ] 上拉加载更多（分页）
- [ ] 状态筛选（planning/in_progress/completed等）
- [ ] 日期范围筛选
- [ ] 搜索（批次号、产品类型）
- [ ] 排序（按开始时间、状态）
- [ ] 快捷操作（开始生产、完成、查看详情）

// UI设计:
<View>
  <SearchBar /> {/* 搜索栏 */}
  <FilterTabs /> {/* 状态标签页 */}
  <FlatList>
    <BatchCard batch={item}>
      <BatchStatusBadge status={item.status} />
      <View>批次号: {item.batchNumber}</View>
      <View>产品: {item.productType}</View>
      <View>开始: {item.startDate}</View>
      <BatchActionButtons batch={item} />
    </BatchCard>
  </FlatList>
</View>
```

**2. BatchDetailScreen.tsx - 批次详情页**

```typescript
// 功能需求:
- [ ] 批次基本信息展示
- [ ] 批次状态流转可视化
- [ ] 关联质检记录
- [ ] 关联工时记录
- [ ] 成本分析（原料/人工/设备）
- [ ] 批次时间线
- [ ] 操作按钮（开始生产/暂停/完成/编辑）

// UI设计:
<ScrollView>
  <BatchHeader batch={batch} />
  <BatchStatusFlow currentStatus={batch.status} />

  <Section title="基本信息">
    <InfoRow label="批次号" value={batch.batchNumber} />
    <InfoRow label="产品类型" value={batch.productType} />
    <InfoRow label="负责人" value={batch.supervisor.fullName} />
    <InfoRow label="生产线" value={batch.productionLine} />
  </Section>

  <Section title="产量信息">
    <ProgressBar
      current={batch.actualQuantity}
      target={batch.targetQuantity}
    />
  </Section>

  <Section title="成本分析">
    <CostPieChart costs={batch.costs} />
  </Section>

  <Section title="质检记录">
    <QualityInspectionList batchId={batch.id} />
  </Section>

  <Section title="批次时间线">
    <Timeline events={batch.timeline} />
  </Section>

  <ActionButtons>
    <Button onPress={handleStart}>开始生产</Button>
    <Button onPress={handleComplete}>完成生产</Button>
  </ActionButtons>
</ScrollView>
```

**3. BatchCreateScreen.tsx - 创建批次页**

```typescript
// 功能需求:
- [ ] 表单验证
- [ ] 产品类型选择
- [ ] 原料选择（多选）
- [ ] 数量输入
- [ ] 生产线选择
- [ ] 负责人选择
- [ ] 开始日期选择
- [ ] 备注输入
- [ ] 提交前确认

// 表单字段:
const formFields = {
  productType: string,       // 产品类型（必填）
  rawMaterials: Array,       // 原料列表（必填）
  targetQuantity: number,    // 目标产量（必填）
  productionLine: string,    // 生产线（必填）
  supervisorId: number,      // 负责人（必填）
  startDate: Date,           // 开始日期（必填）
  notes: string,             // 备注（可选）
};

// UI设计:
<KeyboardAvoidingView>
  <Form>
    <FormField label="产品类型*">
      <Picker
        items={productTypes}
        onValueChange={setProductType}
      />
    </FormField>

    <FormField label="原料选择*">
      <MultiSelect
        items={rawMaterials}
        onSelectionChange={setSelectedMaterials}
      />
    </FormField>

    <FormField label="目标产量*">
      <TextInput
        keyboardType="numeric"
        placeholder="请输入目标产量"
      />
    </FormField>

    <FormField label="生产线*">
      <Picker items={productionLines} />
    </FormField>

    <FormField label="负责人*">
      <UserPicker
        department="processing"
        onSelect={setSupervisor}
      />
    </FormField>

    <FormField label="开始日期*">
      <DatePicker onDateChange={setStartDate} />
    </FormField>

    <FormField label="备注">
      <TextInput
        multiline
        numberOfLines={4}
      />
    </FormField>

    <SubmitButton
      onPress={handleSubmit}
      disabled={!isFormValid}
    >
      创建批次
    </SubmitButton>
  </Form>
</KeyboardAvoidingView>
```

**4. BatchTimelineScreen.tsx - 批次时间线页**

```typescript
// 功能需求:
- [ ] 时间线可视化展示
- [ ] 事件详情查看
- [ ] 按时间排序
- [ ] 支持筛选事件类型

// 事件类型:
const EVENT_TYPES = {
  CREATED: '创建批次',
  STARTED: '开始生产',
  PAUSED: '暂停生产',
  RESUMED: '恢复生产',
  QUALITY_CHECK: '质检',
  COMPLETED: '完成生产',
  FAILED: '生产失败',
};

// UI设计:
<ScrollView>
  <Timeline>
    {events.map(event => (
      <TimelineItem key={event.id}>
        <TimelineDot color={getEventColor(event.type)} />
        <TimelineContent>
          <Text style={styles.eventType}>
            {EVENT_TYPES[event.type]}
          </Text>
          <Text style={styles.eventTime}>
            {formatDateTime(event.timestamp)}
          </Text>
          <Text style={styles.eventDetail}>
            {event.description}
          </Text>
          {event.operator && (
            <Text style={styles.operator}>
              操作人: {event.operator.fullName}
            </Text>
          )}
        </TimelineContent>
      </TimelineItem>
    ))}
  </Timeline>
</ScrollView>
```

---

#### 2.2 质检管理界面

**页面结构**:

```
frontend/CretasFoodTrace/src/screens/quality/
├── QualityInspectionListScreen.tsx      # 质检列表
├── QualityInspectionCreateScreen.tsx    # 创建质检
├── QualityInspectionDetailScreen.tsx    # 质检详情
├── QualityStatisticsScreen.tsx          # 质检统计
└── components/
    ├── InspectionCard.tsx               # 质检卡片
    ├── InspectionForm.tsx               # 质检表单
    ├── PhotoUploader.tsx                # 照片上传
    └── QualityChart.tsx                 # 质量图表
```

**功能清单**:

**1. QualityInspectionCreateScreen.tsx - 创建质检**

```typescript
// 功能需求:
- [ ] 选择批次
- [ ] 选择质检类型（raw_material/process/final_product）
- [ ] 录入质检项（温度、pH值、微生物等）
- [ ] 拍照上传（最多10张）
- [ ] 质检结果判定（pass/fail/conditional_pass）
- [ ] 不合格项记录
- [ ] 纠正措施记录

// 质检表单:
const inspectionForm = {
  batchId: string,             // 批次ID
  inspectionType: string,      // 质检类型
  testItems: {
    temperature: number,       // 温度
    ph: number,                // pH值
    moisture: number,          // 水分
    // 更多检测项...
  },
  overallResult: string,       // 总体结果
  qualityScore: number,        // 质量评分 0-100
  defectDetails: string,       // 缺陷详情
  correctiveActions: string,   // 纠正措施
  photos: Array,               // 照片列表
};
```

**2. QualityStatisticsScreen.tsx - 质检统计**

```typescript
// 功能需求:
- [ ] 质检合格率趋势图
- [ ] 不合格项TOP10
- [ ] 质检员绩效排名
- [ ] 按产品类型统计
- [ ] 按时间段统计（日/周/月）

// UI组件:
<ScrollView>
  <StatCard title="今日合格率" value="98.5%" />
  <StatCard title="本周质检次数" value="156" />

  <LineChart
    title="质检合格率趋势"
    data={qualityTrends}
  />

  <BarChart
    title="不合格项TOP10"
    data={defectTypes}
  />

  <RankingList
    title="质检员绩效排名"
    data={inspectorPerformance}
  />
</ScrollView>
```

---

#### 2.3 ���备监控界面

**页面结构**:

```
frontend/CretasFoodTrace/src/screens/equipment/
├── EquipmentListScreen.tsx              # 设备列表
├── EquipmentDetailScreen.tsx            # 设备详情
├── EquipmentMonitoringScreen.tsx        # 实时监控
├── EquipmentAlertsScreen.tsx            # 设备告警
└── components/
    ├── EquipmentCard.tsx                # 设备卡片
    ├── MonitoringChart.tsx              # 监控图表
    ├── AlertBadge.tsx                   # 告警徽章
    └── EquipmentStatusIndicator.tsx     # 状态指示器
```

**功能清单**:

**1. EquipmentMonitoringScreen.tsx - 实时监控**

```typescript
// 功能需求:
- [ ] 多设备监控面板
- [ ] 实时参数展示（温度/湿度/压力/运行时长）
- [ ] 实时曲线图
- [ ] 状态指示灯（normal/warning/error）
- [ ] 异常告警提示
- [ ] 自动刷新（每30秒）

// UI设计:
<ScrollView>
  <RefreshControl onRefresh={fetchData} />

  {equipmentList.map(equipment => (
    <MonitoringCard key={equipment.id}>
      <EquipmentHeader>
        <Text>{equipment.equipmentName}</Text>
        <StatusIndicator status={equipment.status} />
      </EquipmentHeader>

      <MetricsGrid>
        <MetricItem
          label="温度"
          value={equipment.metrics.temperature}
          unit="°C"
          isNormal={checkRange(equipment.metrics.temperature)}
        />
        <MetricItem
          label="湿度"
          value={equipment.metrics.humidity}
          unit="%"
        />
        <MetricItem
          label="压力"
          value={equipment.metrics.pressure}
          unit="Pa"
        />
        <MetricItem
          label="运行时长"
          value={equipment.metrics.runtime}
          unit="h"
        />
      </MetricsGrid>

      <RealtimeChart
        data={equipment.historyData}
        interval={30000} // 30秒刷新
      />
    </MonitoringCard>
  ))}
</ScrollView>
```

**2. EquipmentAlertsScreen.tsx - 设备告警**

```typescript
// 功能需求:
- [ ] 告警列表
- [ ] 按严重程度筛选（low/medium/high/critical）
- [ ] 按状态筛选（active/acknowledged/resolved）
- [ ] 告警详情查看
- [ ] 告警确认
- [ ] 告警处理记录

// 告警卡片:
<AlertCard alert={alert}>
  <SeverityBadge severity={alert.severity} />
  <Text>{alert.title}</Text>
  <Text>{alert.message}</Text>
  <Text>设备: {alert.equipment.name}</Text>
  <Text>时间: {formatDateTime(alert.createdAt)}</Text>

  {alert.status === 'active' && (
    <Button onPress={() => acknowledgeAlert(alert.id)}>
      确认告警
    </Button>
  )}
</AlertCard>
```

---

#### 2.4 成本分析界面

**页面结构**:

```
frontend/CretasFoodTrace/src/screens/analysis/
├── CostAnalysisDashboard.tsx            # 成本仪表板（已有）
├── BatchCostDetailScreen.tsx            # 批次成本详情
├── CostTrendScreen.tsx                  # 成本趋势分析
├── CostComparisonScreen.tsx             # 成本对比分析
└── components/
    ├── CostPieChart.tsx                 # 成本饼图
    ├── CostBreakdown.tsx                # 成本明细
    └── OptimizationSuggestions.tsx      # 优化建议
```

**功能清单**:

**1. BatchCostDetailScreen.tsx - 批次成本详情**

```typescript
// 功能需求:
- [ ] 成本构成饼图（原料/人工/设备/其他）
- [ ] 成本明细表
- [ ] 单位成本计算
- [ ] 利润率计算
- [ ] 成本对比（与目标成本、历史平均）
- [ ] AI优化建议

// UI设计:
<ScrollView>
  <CostSummary>
    <SummaryCard
      label="总成本"
      value={batch.totalCost}
      unit="元"
    />
    <SummaryCard
      label="单位成本"
      value={batch.costPerKg}
      unit="元/kg"
    />
    <SummaryCard
      label="利润率"
      value={batch.profitRate}
      unit="%"
    />
  </CostSummary>

  <CostPieChart
    data={[
      { label: '原料成本', value: batch.rawMaterialCost },
      { label: '人工成本', value: batch.laborCost },
      { label: '设备成本', value: batch.equipmentCost },
      { label: '其他成本', value: batch.otherCost },
    ]}
  />

  <CostBreakdown>
    <BreakdownItem
      label="原料成本"
      value={batch.rawMaterialCost}
      percentage={calculatePercentage(batch.rawMaterialCost, batch.totalCost)}
    />
    <BreakdownItem
      label="人工成本"
      value={batch.laborCost}
      details={`${batch.totalWorkMinutes}分钟 × ${batch.avgCcrRate}元/分钟`}
    />
    <BreakdownItem
      label="设备成本"
      value={batch.equipmentCost}
      details={`${batch.totalEquipmentMinutes}分钟 × ${batch.avgEquipmentCost}元/分钟`}
    />
  </CostBreakdown>

  <OptimizationSuggestions
    batchId={batch.id}
    currentCost={batch.totalCost}
  />
</ScrollView>
```

---

### 阶段3: DeepSeek AI集成 (1-2周)

#### 3.1 创建DeepSeek服务

**文件**: `backend/src/services/deepseekService.js`

```javascript
import axios from 'axios';
import NodeCache from 'node-cache';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class DeepSeekService {
  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY;
    this.baseURL = 'https://api.deepseek.com/v1';
    this.cache = new NodeCache({ stdTTL: 300 }); // 5分钟缓存
    this.monthlyLimit = 30; // ¥30月度限额
  }

  /**
   * 分析批次成本
   */
  async analyzeBatchCost(batchData) {
    try {
      // 1. 生成缓存key
      const cacheKey = this.generateCacheKey(batchData);

      // 2. 检查缓存
      const cachedResult = this.cache.get(cacheKey);
      if (cachedResult) {
        console.log('DeepSeek缓存命中');
        return { ...cachedResult, fromCache: true };
      }

      // 3. 检查月度预算
      const monthlyUsage = await this.getMonthlyUsage();
      if (monthlyUsage >= this.monthlyLimit) {
        console.warn('DeepSeek月度预算已用完，使用降级分析');
        return this.getFallbackAnalysis(batchData);
      }

      // 4. 构建Prompt
      const prompt = this.buildCostAnalysisPrompt(batchData);

      // 5. 调用DeepSeek API
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // 6. 解析响应
      const analysis = this.parseResponse(response.data);

      // 7. 计算成本
      const cost = this.calculateApiCost(response.data.usage);

      // 8. 记录使用
      await this.recordUsage(batchData.batchId, cost);

      // 9. 缓存结果
      const result = {
        analysis: analysis.text,
        recommendations: analysis.recommendations,
        confidence: analysis.confidence,
        cost: cost,
        fromCache: false
      };
      this.cache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error('DeepSeek API调用失败:', error);
      // 降级到规则引擎
      return this.getFallbackAnalysis(batchData);
    }
  }

  /**
   * 系统Prompt
   */
  getSystemPrompt() {
    return `你是食品加工行业的成本分析专家，擅长分析生产批次的成本构成，发现成本异常，并提供切实可行的优化建议。

分析要求:
1. 分析成本构成（原料、人工、设备）的合理性
2. 识别成本超标的主要原因
3. 提供3-5条具体的优化建议
4. ���议应该具有可操作性和实际意义
5. 使用简洁专业的中文表达

输出格式:
{
  "analysis": "成本分析结论...",
  "recommendations": ["建议1", "建议2", "建议3"],
  "confidence": 0.85
}`;
  }

  /**
   * 构建成本分析Prompt
   */
  buildCostAnalysisPrompt(batchData) {
    return `请分析以下生产批次的成本数据:

批次信息:
- 批次号: ${batchData.batchNumber}
- 产品类型: ${batchData.productType}
- 目标产量: ${batchData.targetQuantity} kg
- 实际产量: ${batchData.actualQuantity} kg

成本数据:
- 总成本: ¥${batchData.totalCost}
- 单位成本: ¥${batchData.costPerKg}/kg
- 目标成本: ¥${batchData.targetCost}

成本构成:
- 原料成本: ¥${batchData.rawMaterialCost} (${this.calcPercentage(batchData.rawMaterialCost, batchData.totalCost)}%)
- 人工成本: ¥${batchData.laborCost} (${this.calcPercentage(batchData.laborCost, batchData.totalCost)}%)
- 设备成本: ¥${batchData.equipmentCost} (${this.calcPercentage(batchData.equipmentCost, batchData.totalCost)}%)

${batchData.historicalAvgCost ? `历史平均成本: ¥${batchData.historicalAvgCost}/kg` : ''}

请分析成本是否合理，成本超标的主要原因，并提供优化建议。`;
  }

  /**
   * 解析AI响应
   */
  parseResponse(response) {
    try {
      const content = response.choices[0].message.content;

      // 尝试解析JSON格式
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          text: parsed.analysis,
          recommendations: parsed.recommendations,
          confidence: parsed.confidence || 0.8
        };
      }

      // 如果不是JSON，尝试提取文本
      return {
        text: content,
        recommendations: this.extractRecommendations(content),
        confidence: 0.7
      };
    } catch (error) {
      console.error('解析DeepSeek响应失败:', error);
      throw error;
    }
  }

  /**
   * 提取建议列表
   */
  extractRecommendations(text) {
    const recommendations = [];
    const lines = text.split('\n');

    for (const line of lines) {
      if (/^[\d一二三四五六七八九十][\.\、\s]/.test(line)) {
        recommendations.push(line.replace(/^[\d一二三四五六七八九十][\.\、\s]+/, ''));
      }
    }

    return recommendations.slice(0, 5); // 最多5条建议
  }

  /**
   * 计算API成本
   */
  calculateApiCost(usage) {
    // DeepSeek计费: ¥0.001/1K tokens (假设)
    const totalTokens = usage.total_tokens || 0;
    const cost = (totalTokens / 1000) * 0.001;
    return parseFloat(cost.toFixed(4));
  }

  /**
   * 记录使用情况
   */
  async recordUsage(batchId, cost) {
    try {
      await prisma.aIAnalysisLog.create({
        data: {
          batchId,
          service: 'deepseek',
          cost,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('记录DeepSeek使用失败:', error);
    }
  }

  /**
   * 获取月度使用量
   */
  async getMonthlyUsage() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = await prisma.aIAnalysisLog.aggregate({
      where: {
        service: 'deepseek',
        timestamp: { gte: startOfMonth }
      },
      _sum: { cost: true }
    });

    return result._sum.cost || 0;
  }

  /**
   * 降级分析（基于规则引擎）
   */
  getFallbackAnalysis(batchData) {
    const analysis = [];
    const recommendations = [];

    // 规则1: 成本超标分析
    const costOverrun = batchData.totalCost - batchData.targetCost;
    if (costOverrun > 0) {
      const percentage = (costOverrun / batchData.targetCost * 100).toFixed(1);
      analysis.push(`成本超标${percentage}%（超出¥${costOverrun.toFixed(2)}）`);

      // 找出超标最多的成本项
      const costs = {
        '原料': batchData.rawMaterialCost,
        '人工': batchData.laborCost,
        '设备': batchData.equipmentCost
      };
      const maxCostItem = Object.entries(costs).reduce((a, b) => a[1] > b[1] ? a : b);
      recommendations.push(`${maxCostItem[0]}成本占比最高，建议重点优化`);
    }

    // 规则2: 人工成本分析
    const laborPercentage = (batchData.laborCost / batchData.totalCost * 100).toFixed(1);
    if (laborPercentage > 40) {
      analysis.push(`人工成本占比${laborPercentage}%偏高`);
      recommendations.push('建议优化生产流程，提高员工效率');
      recommendations.push('考虑引入自动化设备减少人工依赖');
    }

    // 规则3: 设备成本分析
    const equipmentPercentage = (batchData.equipmentCost / batchData.totalCost * 100).toFixed(1);
    if (equipmentPercentage > 30) {
      analysis.push(`设备成本占比${equipmentPercentage}%偏高`);
      recommendations.push('检查设备利用率，避免空转浪费');
    }

    // 规则4: 产量分析
    if (batchData.actualQuantity < batchData.targetQuantity * 0.9) {
      const shortfall = ((batchData.targetQuantity - batchData.actualQuantity) / batchData.targetQuantity * 100).toFixed(1);
      analysis.push(`实际产量低于目标${shortfall}%，影响单位成本`);
      recommendations.push('分析产量不足原因，提高生产良品率');
    }

    // 规则5: 历史对比
    if (batchData.historicalAvgCost && batchData.costPerKg > batchData.historicalAvgCost * 1.1) {
      analysis.push(`单位成本比历史平均高${((batchData.costPerKg - batchData.historicalAvgCost) / batchData.historicalAvgCost * 100).toFixed(1)}%`);
      recommendations.push('对比历史批次，查找成本上涨原因');
    }

    return {
      analysis: analysis.length > 0 ? analysis.join('；') : '成本控制良好，无明显异常',
      recommendations: recommendations.length > 0 ? recommendations : ['继续保持当前生产方式'],
      confidence: 0.6,
      cost: 0,
      fromCache: false,
      usedFallback: true
    };
  }

  /**
   * 生成缓存key
   */
  generateCacheKey(batchData) {
    const keyData = {
      batchId: batchData.batchId,
      totalCost: batchData.totalCost,
      costPerKg: batchData.costPerKg
    };
    return `deepseek_${JSON.stringify(keyData)}`;
  }

  /**
   * 计算百分比
   */
  calcPercentage(part, total) {
    return ((part / total) * 100).toFixed(1);
  }
}

export default new DeepSeekService();
```

---

#### 3.2 更新API路由

**文件**: `backend/src/routes/mobile.js`

```javascript
import deepseekService from '../services/deepseekService.js';

// 替换Mock实现
router.post('/analysis/deepseek', mobileAuthMiddleware, async (req, res) => {
  try {
    const { batchId, data } = req.body;

    // 验证输入
    if (!data || !data.totalCost) {
      throw new ValidationError('缺少必要的成本数据');
    }

    // 调用DeepSeek服务
    const result = await deepseekService.analyzeBatchCost({
      batchId,
      ...data
    });

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('DeepSeek分析失败:', error);
    res.status(500).json({
      success: false,
      message: '智能分析服务暂时不可用',
      error: error.message
    });
  }
});
```

---

#### 3.3 添加AI分析日志表

**文件**: `backend/prisma/schema.prisma`（新增）

```prisma
model AIAnalysisLog {
  id        String   @id @default(uuid())
  batchId   String?  @map("batch_id")
  service   String   @map("service") // "deepseek"
  cost      Decimal  @map("cost") @db.Decimal(10, 4)
  timestamp DateTime @default(now()) @map("timestamp")

  batch ProcessingBatch? @relation(fields: [batchId], references: [id])

  @@index([service, timestamp], map: "idx_service_time")
  @@index([batchId], map: "idx_batch_analysis")
  @@map("ai_analysis_logs")
}
```

---

#### 3.4 前端集成

**文件**: `frontend/CretasFoodTrace/src/services/deepseekService.ts`

```typescript
import { apiClient } from './api/apiClient';

export interface CostAnalysisRequest {
  batchId: string;
  data: {
    batchNumber: string;
    productType: string;
    targetQuantity: number;
    actualQuantity: number;
    totalCost: number;
    costPerKg: number;
    targetCost: number;
    rawMaterialCost: number;
    laborCost: number;
    equipmentCost: number;
    historicalAvgCost?: number;
  };
}

export interface CostAnalysisResult {
  analysis: string;
  recommendations: string[];
  confidence: number;
  cost: number;
  fromCache: boolean;
  usedFallback?: boolean;
}

class DeepSeekService {
  async analyzeCost(request: CostAnalysisRequest): Promise<CostAnalysisResult> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        result: CostAnalysisResult;
      }>('/api/mobile/analysis/deepseek', request);

      if (!response.data.success) {
        throw new Error('分析失败');
      }

      return response.data.result;
    } catch (error) {
      console.error('AI成本分析失败:', error);
      throw error;
    }
  }
}

export default new DeepSeekService();
```

**使用示例**:

```typescript
// frontend/CretasFoodTrace/src/screens/analysis/BatchCostDetailScreen.tsx
import deepseekService from '../../services/deepseekService';

const BatchCostDetailScreen = ({ route }) => {
  const { batch } = route.params;
  const [analysis, setAnalysis] = useState<CostAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await deepseekService.analyzeCost({
        batchId: batch.id,
        data: {
          batchNumber: batch.batchNumber,
          productType: batch.productType,
          targetQuantity: batch.targetQuantity,
          actualQuantity: batch.actualQuantity,
          totalCost: batch.totalCost,
          costPerKg: batch.costPerKg,
          targetCost: batch.targetCost,
          rawMaterialCost: batch.rawMaterialCost,
          laborCost: batch.laborCost,
          equipmentCost: batch.equipmentCost,
        }
      });

      setAnalysis(result);
    } catch (error) {
      Alert.alert('错误', 'AI分析失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView>
      {/* 成本详情展示 */}

      <Button onPress={handleAnalyze} disabled={loading}>
        {loading ? '分析中...' : 'AI智能分析'}
      </Button>

      {analysis && (
        <View style={styles.analysisSection}>
          <Text style={styles.sectionTitle}>AI分析结果</Text>
          {analysis.usedFallback && (
            <Text style={styles.fallbackNote}>
              (当前使用规则引擎分析)
            </Text>
          )}
          <Text style={styles.analysisText}>{analysis.analysis}</Text>

          <Text style={styles.sectionTitle}>优化建议</Text>
          {analysis.recommendations.map((rec, index) => (
            <View key={index} style={styles.recommendationItem}>
              <Text>• {rec}</Text>
            </View>
          ))}

          <Text style={styles.confidence}>
            置信度: {(analysis.confidence * 100).toFixed(0)}%
          </Text>
          {analysis.cost > 0 && (
            <Text style={styles.cost}>
              分析成本: ¥{analysis.cost.toFixed(4)}
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
};
```

---

### 阶段4: 性能与用户体验优化 (1-2周)

#### 4.1 性能优化

**1. 添加Redis缓存**

```javascript
// backend/src/services/redisCache.js（新建）
import Redis from 'ioredis';

class RedisCache {
  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: 0
    });
  }

  async get(key) {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key, value, ttl = 300) {
    await this.client.setex(key, ttl, JSON.stringify(value));
  }

  async del(key) {
    await this.client.del(key);
  }
}

export default new RedisCache();
```

**2. 数据库查询优化**

```javascript
// 添加索引
await prisma.$executeRaw`
  CREATE INDEX idx_batch_factory_status
  ON processing_batches(factory_id, status, start_date DESC);

  CREATE INDEX idx_inspection_batch_date
  ON quality_inspections(batch_id, inspection_date DESC);
`;

// 优化查询（使用select减少数据传输）
const batches = await prisma.processingBatch.findMany({
  where: { factoryId, status },
  select: {
    id: true,
    batchNumber: true,
    productType: true,
    status: true,
    startDate: true,
    targetQuantity: true,
    actualQuantity: true,
    supervisor: {
      select: {
        id: true,
        fullName: true
      }
    }
  },
  orderBy: { startDate: 'desc' },
  take: 20
});
```

**3. 图片压缩与优化**

```typescript
// frontend/CretasFoodTrace/src/utils/imageOptimizer.ts
import * as ImageManipulator from 'expo-image-manipulator';

export const compressImage = async (uri: string, maxSize: number = 1024) => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxSize } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
};
```

---

#### 4.2 离线功能

```typescript
// frontend/CretasFoodTrace/src/services/offlineStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

class OfflineStorage {
  async saveClockRecord(record: ClockRecord) {
    const key = `offline_clock_${Date.now()}`;
    await AsyncStorage.setItem(key, JSON.stringify(record));
  }

  async syncOfflineData() {
    const keys = await AsyncStorage.getAllKeys();
    const offlineKeys = keys.filter(k => k.startsWith('offline_'));

    for (const key of offlineKeys) {
      const data = await AsyncStorage.getItem(key);
      if (data) {
        try {
          await this.uploadToServer(JSON.parse(data));
          await AsyncStorage.removeItem(key);
        } catch (error) {
          console.log('同步失败，保留离线数据');
        }
      }
    }
  }
}
```

---

## 📋 实施计划

### 时间规划（8-10周）

| 周次 | 阶段 | 主要任务 | 产出物 |
|------|------|---------|--------|
| Week 1 | 阶段1 | 移除Mock代码、优化认证 | 清理后的代码 |
| Week 2 | 阶段1 | 前端登录优化、权限优化 | 优化后的登录体验 |
| Week 3-4 | 阶段2 | 批次管理UI开发 | 5个批次页面 |
| Week 5 | 阶段2 | 质检管理UI开发 | 4个质检页面 |
| Week 6 | 阶段2 | 设备监控UI开发 | 4个设备页面 |
| Week 7 | 阶段3 | DeepSeek集成 | AI分析功能 |
| Week 8 | 阶段4 | 性能优化 | Redis缓存、查询优化 |
| Week 9 | 阶段4 | 离线功能、UX优化 | 离线支持 |
| Week 10 | 测试 | 系统测试、Bug修复 | 发布版本 |

---

## ✅ 验收标准

### 功能完整性
- [ ] 所有Mock代码已移除
- [ ] 15个以上UI页面完成
- [ ] 完整的批次管理流程
- [ ] 质检、设备监控可用
- [ ] AI分析功能可用

### 性能指标
- [ ] App启动<3秒
- [ ] API响应<500ms
- [ ] 列表滚动流畅（60fps）
- [ ] 图片加载<2秒

### 用户体验
- [ ] 登录成功率>99%
- [ ] 错误提示友好
- [ ] 操作流畅无卡顿
- [ ] 离线核心功能可用

### 代码质量
- [ ] 无Mock代码残留
- [ ] 代码注释完整
- [ ] 无严重Bug
- [ ] 通过单元测试

---

## 💰 预算估算

**人力成本**:
- 后端开发: 1人 × 2.5个月 = 2.5人月
- 前端开发: 2人 × 2个月 = 4人月
- UI设计: 1人 × 0.5个月 = 0.5人月
- 测试: 1人 × 0.75个月 = 0.75人月
- **总计**: 7.75人月

**第三方服务**:
- DeepSeek API: ¥30/月
- Redis服务器: ¥200/月
- 服务器: ¥500/月

**总预算**: 约¥150,000 - ¥200,000（按¥20,000/人月）

---

**文档结束**

*本优化方案将使认证和生产模块达到生产就绪状态*
