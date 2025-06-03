# 任务：状态管理现代化

<!-- updated for: TASK-P3-003状态管理现代化任务创建 -->

- **任务ID**: TASK-P3-003
- **优先级**: P1
- **状态**: 🚀 进行中
- **开始日期**: 2025-05-28
- **完成日期**: -
- **负责人**: Phase-3技术栈现代化团队
- **估计工时**: 21人天 (3周)

## 任务描述

实现从分散状态管理迁移到现代化统一状态管理架构，采用Zustand + React Query方案，建立清晰的客户端状态和服务端状态分离，支持离线功能和缓存优化。

### 🎯 核心目标

1. **统一状态管理**: 建立Zustand全局状态管理体系
2. **服务端状态优化**: 实现React Query数据获取和缓存
3. **离线功能支持**: 实现农场环境离线状态管理
4. **类型安全**: 完整的TypeScript类型系统
5. **性能优化**: 状态持久化和智能缓存

### 📊 技术范围

| 状态类型 | 当前状态 | 目标状态 | 实施方案 |
|---------|---------|---------|---------|
| 认证状态 | 分散在组件 | Zustand Store | useAuthStore ✅ |
| 用户偏好 | localStorage分散 | Zustand Persist | useUserStore ✅ |
| 业务数据 | 组件state | React Query | useQuery/useMutation |
| 缓存策略 | 无统一管理 | React Query缓存 | 分层缓存策略 |
| 离线支持 | 无 | 离线状态同步 | 离线队列+同步 |

## 实施步骤

### 第1周：核心状态架构搭建 ✅

#### 1.1 Zustand核心Store设计 (2天) ✅ 已完成
- [x] 设计全局状态架构 (AppState, AuthState, UserState) ✅
- [x] 实现useAppStore全局应用状态 ✅
- [x] 完善useAuthStore认证状态管理 (扩展现有) ✅
- [x] 实现useUserStore用户偏好状态 ✅

**实施记录**:
- ✅ `types/state.ts`: 完整的TypeScript状态类型定义 (306行)
- ✅ `store/appStore.ts`: 全局应用状态管理，支持主题、语言、通知等 (268行)
- [ ] 完善useAuthStore认证状态管理 (扩展现有)
- [ ] 实现useUserStore用户偏好状态

#### 1.2 React Query集成 (2天)
- [ ] 配置QueryClient和Provider
- [ ] 实现API客户端封装 (api/client.ts)
- [ ] 建立查询键管理 (queryKeys.ts)
- [ ] 设置默认查询配置 (缓存时间、重试策略)

#### 1.3 TypeScript类型系统 (1天)
- [ ] 定义完整状态类型 (types/state.ts)
- [ ] 实现API响应类型 (types/api.ts)
- [ ] 建立Store类型推导系统
- [ ] 配置严格类型检查

### 第2周：业务状态实现 ✅

#### 2.1 溯源查询状态管理 (3天) ✅ 已完成
- [x] 实现useTraceStore (当前批次、搜索历史) ✅
- [x] 实现useTraceQuery Hook (批次数据查询) ✅
- [x] 实现useTraceHistory (搜索历史管理) ✅
- [x] 缓存策略优化 (5分钟fresh，30分钟cache) ✅

**实施记录**:
- ✅ `store/traceStore.ts`: 完整的溯源查询状态管理 (356行)
  - 批次数据类型定义 (Batch, TraceStep, QualityMetric, Certification)
  - 搜索历史和书签管理
  - 视图状态控制 (timeline/detailed/summary)
  - React Query集成 (useTraceQuery, useTraceSearch, useTraceHistory)
  - 选择性持久化策略 (不保存临时状态)
  - 性能优化的选择器Hooks

#### 2.2 仪表板状态管理 (2天) ✅ 已完成
- [x] 实现useDashboardStore (视图状态、筛选器) ✅
- [x] 实现统计数据查询 Hook ✅
- [x] 实现数据更新 Mutation ✅
- [x] 实时数据同步策略 ✅

**实施记录**:
- ✅ `store/dashboardStore.ts`: 完整的仪表板状态管理 (416行)
  - 仪表板数据类型定义 (DashboardStats, OverviewData, ReportData)
  - 筛选器和布局管理 (DashboardFilters, DashboardLayout)
  - 实时刷新配置 (自动刷新、刷新间隔控制)
  - React Query集成 (useDashboardStats, useDashboardOverview, useDashboardReports)
  - 数据更新Mutation和实时同步Hook
  - 拖拽布局和收藏图表功能支持

### 第3周：性能优化和离线支持

#### 3.1 状态持久化 (2天)
- [ ] 配置Zustand persist中间件
- [ ] 实现选择性状态持久化
- [ ] 优化localStorage存储策略
- [ ] 实现状态迁移版本控制

#### 3.2 离线功能支持 (2天)
- [ ] 实现网络状态检测
- [ ] 建立离线队列系统
- [ ] 实现数据同步策略
- [ ] 离线数据冲突解决

#### 3.3 性能优化和测试 (1天)
- [ ] 状态更新性能优化
- [ ] React Query缓存策略调优
- [ ] 状态管理单元测试
- [ ] 性能基准测试

## 技术实现方案

### 状态架构设计

```typescript
// types/state.ts
interface AppState {
  theme: 'light' | 'dark';
  language: 'zh-CN' | 'en-US';
  online: boolean;
  loading: boolean;
  sidebarCollapsed: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  permissions: Permission[];
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

interface TraceState {
  currentBatch: Batch | null;
  searchHistory: string[];
  recentSearches: string[];
  addSearch: (batchId: string) => void;
  clearHistory: () => void;
}
```

### React Query配置

```typescript
// lib/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5分钟
      cacheTime: 30 * 60 * 1000, // 30分钟
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// hooks/useTraceData.ts
export const useTraceData = (batchId: string) => {
  return useQuery({
    queryKey: ['trace', batchId],
    queryFn: () => traceApi.getBatchInfo(batchId),
    enabled: !!batchId,
    staleTime: 5 * 60 * 1000,
  });
};
```

### Zustand Store实现

```typescript
// store/appStore.ts
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      language: 'zh-CN',
      online: navigator.onLine,
      loading: false,
      sidebarCollapsed: false,
      
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setOnline: (online) => set({ online }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
    }),
    {
      name: 'app-state',
      partialize: (state) => ({ 
        theme: state.theme, 
        language: state.language,
        sidebarCollapsed: state.sidebarCollapsed 
      }),
    }
  )
);
```

## 变更记录

| 文件路径 | 变更类型 | 变更说明 |
|---------|---------|---------|
| refactor/phase-3/tasks/TASK-P3-003_状态管理现代化.md | 新增 | 状态管理现代化任务文档创建 |
| web-app-next/src/lib/queryClient.ts | 新增 | React Query配置和查询键工厂 - 5分钟缓存策略、30分钟GC时间、指数退避重试 |
| web-app-next/src/lib/api.ts | 新增 | API客户端封装 - 统一HTTP请求、错误处理、认证Token管理 |
| web-app-next/src/store/authStore.ts | 修改 | 集成React Query API客户端，完善错误处理和Token刷新机制 |
| web-app-next/src/store/userStore.ts | 重构 | 重新设计用户偏好状态管理 - 主题、语言、界面、业务偏好设置 |
| web-app-next/src/types/state.ts | 修改 | 更新UserPreferencesState类型定义，支持现代化状态管理架构 |
| web-app-next/src/store/traceStore.ts | 新增 | 溯源查询状态管理 - 当前批次、搜索历史、视图状态、React Query集成 |
| web-app-next/src/store/dashboardStore.ts | 新增 | 仪表板状态管理 - 视图状态、筛选器、布局管理、实时数据同步、React Query集成 |
| web-app-next/src/store/appStore.ts | 修复 | 修复TypeScript类型错误 - 修复state引用错误、添加缺失的setSidebarCollapsed和updateNotifications方法、修复PersistConfig类型兼容性问题、解决模块导入路径错误 |
| web-app-next/src/lib/api.ts | 修复 | 修复离线队列集成 - 修正导入路径从./offlineQueue到./offline-queue、API方法从enqueue改为addOperation、完善模板字符串错误 |
| web-app-next/src/types/state.ts | 确认 | 确认AppState和Notification类型定义正确，修复appStore.ts的导入路径错误 |
| 构建系统 | 修复 | TypeScript编译成功，解决所有类型错误，恢复Next.js项目构建能力，剩余仅有非阻塞性ESLint警告 |

## 依赖任务

- TASK-P3-001: 前端框架迁移评估与选型 (已完成) - 技术选型基础
- TASK-P3-002: 构建工具现代化配置 (已完成) - 开发环境基础
- TASK-P3-014: Next.js项目标准化与配置完善 (已完成) - 项目基础设施

## 验收标准

### 功能验收
- [ ] Zustand全局状态管理正常工作，支持TypeScript类型推导
- [ ] React Query数据查询和缓存机制完整实现
- [ ] 认证状态在应用重启后正确恢复
- [ ] 用户偏好设置正确持久化和同步
- [ ] 溯源查询历史记录功能正常
- [ ] 离线状态检测和数据同步功能正常

### 性能验收
- [ ] 状态更新响应时间<50ms
- [ ] 大数据集状态管理无性能瓶颈
- [ ] React Query缓存命中率>80%
- [ ] 离线数据同步成功率>95%
- [ ] 状态持久化不影响应用启动性能

### 技术验收
- [ ] TypeScript类型检查100%通过
- [ ] 状态管理单元测试覆盖率>90%
- [ ] ESLint检查无错误和警告
- [ ] 状态管理文档和API说明完整
- [ ] 开发者工具支持良好 (Zustand DevTools, React Query DevTools)

### 兼容性验收
- [ ] 现有组件无缝迁移到新状态管理
- [ ] 向后兼容现有localStorage数据
- [ ] 支持主流浏览器 (Chrome 90+, Safari 14+, Firefox 88+)
- [ ] 移动端状态管理稳定运行

## 注意事项

### 重要提醒
1. **渐进式迁移**: 保持现有功能正常运行，分批迁移组件状态
2. **数据迁移**: 处理现有localStorage数据的兼容性和迁移
3. **性能监控**: 密切关注状态更新对应用性能的影响
4. **错误处理**: 建立完整的状态错误恢复机制
5. **离线兼容**: 确保离线状态不影响核心功能使用

### 潜在风险
- **状态迁移复杂**: 现有分散状态向统一状态迁移可能有遗漏
- **数据一致性**: 多个Store之间的数据同步需要特别注意
- **缓存策略**: React Query缓存配置不当可能影响数据时效性
- **离线同步**: 网络恢复后的数据冲突解决需要充分测试

### 性能考虑
- 避免过度的状态订阅导致的重渲染
- 合理设计状态结构，避免深度嵌套
- 使用状态分片减少不必要的组件更新
- 离线队列大小控制，避免内存泄漏 