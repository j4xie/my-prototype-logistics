# SOP 配置界面实现文档

## 任务: S4-2 SOP 配置界面

**实现日期**: 2025-12-31
**状态**: ✅ 完成

---

## 实现文件清单

### 1. API 客户端
**文件**: `/src/services/api/sopConfigApiClient.ts`

#### 类型定义
- `SopStep` - SOP 步骤配置
- `ValidationRulesConfig` - 验证规则配置
- `PhotoConfig` - 拍照配置
- `SopConfig` - SOP 配置实体
- `CreateSopConfigRequest` - 创建请求
- `UpdateSopConfigRequest` - 更新请求
- `PaginatedResponse<T>` - 分页响应

#### API 方法
```typescript
class SopConfigApiClient {
  // 基础 CRUD
  getSopConfigs(params?)              // 获取列表 (分页)
  createSopConfig(data, factoryId?)   // 创建
  getSopConfigById(id, factoryId?)    // 获取详情
  updateSopConfig(id, data, factoryId?) // 更新
  deleteSopConfig(id, factoryId?)     // 删除

  // 辅助方法
  toggleSopConfigStatus(id, isActive, factoryId?) // 启用/禁用
  getSopConfigsByEntityType(entityType, factoryId?) // 按实体类型查询
  getSopConfigsByProductType(productTypeId, factoryId?) // 按产品类型查询
  checkCodeExists(code, factoryId?)   // 检查编码是否存在
  batchUpdateStatus(ids, isActive, factoryId?) // 批量更新状态
}
```

#### API 端点映射
```
GET    /api/mobile/{factoryId}/sop-configs                 - 列表 (分页)
POST   /api/mobile/{factoryId}/sop-configs                 - 创建
GET    /api/mobile/{factoryId}/sop-configs/{id}           - 详情
PUT    /api/mobile/{factoryId}/sop-configs/{id}           - 更新
DELETE /api/mobile/{factoryId}/sop-configs/{id}           - 删除
GET    /api/mobile/{factoryId}/sop-configs/check-code     - 检查编码
PUT    /api/mobile/{factoryId}/sop-configs/batch/status   - 批量更新状态
```

---

### 2. 界面组件
**文件**: `/src/screens/management/SopConfigScreen.tsx`

#### 主要功能
1. **SOP 列表展示**
   - 按产品类型分组显示
   - 显示 SOP 名称、编码、描述
   - 显示关联实体类型、产品类型
   - 显示步骤数量、版本号、启用状态
   - 支持刷新数据

2. **新建/编辑 SOP**
   - SOP 名称 (必填)
   - SOP 编码 (可选，后端自动生成)
   - 描述
   - 关联实体类型 (必选: PRODUCTION_BATCH, MATERIAL_BATCH, QUALITY_CHECK, PACKAGING)
   - 关联产品类型 (可选，留空则适用于所有产品)

3. **加工步骤管理**
   - 添加/删除/编辑步骤
   - 调整步骤顺序 (上移/下移)
   - 每个步骤配置:
     - 加工环节类型 (从 ProcessingStageType 选择)
     - 步骤名称 (自定义)
     - 所需技能等级 (1-5)
     - 时间限制 (分钟)
     - 是否必需
     - 是否需要拍照
     - 备注

4. **拍照证据配置**
   - 是否必需拍照
   - 最少照片数/最多照片数

5. **状态管理**
   - 启用/禁用 SOP 配置
   - 删除 SOP 配置

#### 权限控制
- 仅限工厂超管、权限管理员和部门管理员访问
- 使用 `canManageBasicData(user)` 检查权限

#### 统计信息
- 总数
- 启用中数量
- 已配置步骤数量

---

### 3. SOP 步骤编辑器组件
**文件**: `/src/components/sop/SopStepsEditor.tsx`

#### 功能特性
- 专用于 SOP 配置的步骤编辑器
- 支持 SOP 特定字段 (required, photoRequired, timeLimitMinutes)
- 拖拽排序 (上移/下移)
- 加工环节类型选择器
- 技能等级选择 (1-5)
- 时间限制配置
- 必需/拍照开关
- 步骤备注

#### 与 ProcessingStepsEditor 的区别
- `ProcessingStepsEditor`: 用于产品类型的加工步骤配置 (简化版)
- `SopStepsEditor`: 用于 SOP 配置，支持更多字段和功能

---

## 对接后端实体

### 后端实体: `SopConfig.java`
位置: `/backend-java/src/main/java/com/cretas/aims/entity/config/SopConfig.java`

#### 字段映射
| 前端字段 | 后端字段 | 类型 | 说明 |
|---------|---------|------|------|
| id | id | String | UUID |
| factoryId | factoryId | String | 工厂ID |
| name | name | String | SOP名称 |
| code | code | String | SOP编码 |
| description | description | String | 描述 |
| entityType | entityType | String | 实体类型 |
| productTypeId | productTypeId | String | 产品类型ID |
| ruleGroupId | ruleGroupId | String | 规则组ID |
| steps | stepsJson | JSON | 步骤配置 |
| validationRules | validationRulesJson | JSON | 验证规则 |
| photoConfig | photoConfigJson | JSON | 拍照配置 |
| version | version | Integer | 版本号 |
| isActive | isActive | Boolean | 是否启用 |
| createdBy | createdBy | Long | 创建者 |
| createdAt | createdAt | DateTime | 创建时间 |
| updatedAt | updatedAt | DateTime | 更新时间 |

#### JSON 格式示例

**stepsJson** (步骤配置):
```json
[
  {
    "stageType": "RECEIVING",
    "orderIndex": 1,
    "name": "原料接收",
    "requiredSkillLevel": 2,
    "required": true,
    "photoRequired": true,
    "timeLimitMinutes": 30,
    "validationRuleIds": ["rule-check-temp"],
    "notes": "检查温度需在-18°C以下"
  }
]
```

**photoConfigJson** (拍照配置):
```json
{
  "required": true,
  "stages": ["RECEIVING", "PACKAGING"],
  "minPhotosPerStage": 1,
  "maxPhotosPerStage": 5
}
```

**validationRulesJson** (验证规则):
```json
{
  "onStart": ["rule-check-material"],
  "onComplete": ["rule-check-output"],
  "crossStep": ["rule-check-temp-chain"]
}
```

---

## 技术要求验证

### ✅ 使用 react-native-paper
- 所有 UI 组件使用 react-native-paper
- 包括: Card, List, Chip, Button, TextInput, Modal, FAB, IconButton, Menu, Divider, SegmentedButtons, Switch

### ✅ TypeScript 严格类型
- 所有类型明确定义
- 无 `any` 类型 (除 API 响应处理时的类型转换)
- 使用类型守卫和可选链
- 遵循 `.claude/rules/typescript-type-safety.md` 规范

### ✅ 参考 ProductTypeManagementScreen 模式
- 统一的界面布局 (Header + Content + Stats + List + FAB)
- 统一的权限检查模式
- 统一的错误处理和日志记录
- 统一的 Modal 使用方式
- 统一的下拉菜单和表单交互

### ✅ 遵循项目规范
- API 响应处理规范 (`.claude/rules/api-response-handling.md`)
- 字段命名规范 (`.claude/rules/field-naming-convention.md`)
- 数据库实体同步规范 (`.claude/rules/database-entity-sync.md`)

---

## 使用示例

### 从管理界面进入
```typescript
// 在管理员主界面添加入口
import { SopConfigScreen } from '../../screens/management';

// 导航
navigation.navigate('SopConfig');
```

### 创建 SOP 配置
1. 点击右下角 "+" FAB 按钮
2. 填写 SOP 名称、描述
3. 选择关联实体类型 (如: PRODUCTION_BATCH)
4. 可选: 选择关联产品类型
5. 点击"创建"

### 配置 SOP 步骤
1. 在 SOP 列表中找到目标配置
2. 点击"配置步骤"按钮
3. 添加加工步骤:
   - 选择加工环节 (接收、切片、包装等)
   - 设置技能等级
   - 设置时间限制
   - 配置是否必需、是否需拍照
4. 配置拍照证据要求
5. 点击"保存配置"

---

## 待实现功能 (后端依赖)

### 1. 规则组关联
- 当前前端未实现 `ruleGroupId` 选择器
- 需要后端提供 `/api/mobile/{factoryId}/rule-groups` API
- 待 Sprint 2 S2-3 完成后补充

### 2. 验证规则配置
- 当前前端未实现 `validationRules` 编辑器
- 需要后端提供验证规则列表 API
- 待 Sprint 2 完成后补充

### 3. SOP 应用到实际业务
- 生产批次、原料批次、质检等业务模块需要读取并应用 SOP 配置
- 需要后端提供 SOP 执行跟踪 API

---

## 测试清单

### 功能测试
- [ ] 创建 SOP 配置 (名称、编码、实体类型、产品类型)
- [ ] 编辑 SOP 配置
- [ ] 删除 SOP 配置
- [ ] 启用/禁用 SOP 配置
- [ ] 添加加工步骤
- [ ] 编辑加工步骤
- [ ] 删除加工步骤
- [ ] 调整步骤顺序 (上移/下移)
- [ ] 配置拍照要求
- [ ] 按产品类型分组显示
- [ ] 刷新数据

### 权限测试
- [ ] 工厂超管可访问
- [ ] 权限管理员可访问
- [ ] 部门管理员可访问
- [ ] 普通员工无法访问 (显示权限提示)

### 数据验证
- [ ] SOP 名称不能为空
- [ ] 实体类型必须选择
- [ ] 产品类型可选
- [ ] 步骤顺序自动编号
- [ ] 技能等级范围 1-5
- [ ] 时间限制 >= 0

### API 测试
- [ ] 列表查询 (分页)
- [ ] 创建 SOP (后端自动生成 code)
- [ ] 更新 SOP
- [ ] 删除 SOP
- [ ] 启用/禁用切换
- [ ] 步骤配置 JSON 正确序列化/反序列化
- [ ] 拍照配置 JSON 正确序列化/反序列化

---

## 注意事项

1. **后端 API 未实现时的处理**
   - API 客户端已完整实现
   - 如果后端 API 未完成，会抛出 404 错误
   - 前端会显示友好错误提示

2. **JSON 字段序列化**
   - 后端使用 `@Column(columnDefinition = "JSON")` 存储步骤配置
   - Spring Boot 需要配置 JSON 序列化器 (Jackson)
   - 确保前后端 JSON 格式一致

3. **版本控制**
   - SOP 配置有版本号 (`version`)
   - 每次更新递增版本
   - 前端暂未实现版本历史查看

4. **多租户隔离**
   - 所有 API 路径包含 `factoryId`
   - 后端需验证用户工厂权限

---

## 相关文件

### 前端
- `/src/services/api/sopConfigApiClient.ts` - API 客户端
- `/src/screens/management/SopConfigScreen.tsx` - 主界面
- `/src/components/sop/SopStepsEditor.tsx` - 步骤编辑器
- `/src/components/sop/index.ts` - 组件导出

### 后端
- `/backend-java/src/main/java/com/cretas/aims/entity/config/SopConfig.java` - 实体
- 待实现: Controller, Service, Repository

### 规范文档
- `/.claude/rules/api-response-handling.md`
- `/.claude/rules/typescript-type-safety.md`
- `/.claude/rules/field-naming-convention.md`
- `/.claude/rules/database-entity-sync.md`

---

## 总结

**任务 S4-2 SOP 配置界面已完成**，包括:
- ✅ 完整的 API 客户端实现
- ✅ 功能完整的管理界面
- ✅ 专用的 SOP 步骤编辑器
- ✅ 类型安全的 TypeScript 代码
- ✅ 遵循项目规范和最佳实践
- ✅ 对接后端 SopConfig 实体

**待后端实现 API 后即可完整运行测试。**
