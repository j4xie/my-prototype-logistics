# 业务组件标准化规范

## 文档概述

**创建日期**: 2025-05-21  
**适用范围**: web-app/src/components/modules/  
**目的**: 建立统一的业务组件开发规范和数据接口标准

## 业务组件分类

### 1. 记录管理组件 (Record Components)

#### 标准接口规范

```javascript
// 通用Props接口
interface RecordComponentProps {
  // 数据相关
  data: Array<RecordItem>;
  loading?: boolean;
  error?: string | null;
  
  // 视图控制
  viewMode?: 'list' | 'table' | 'card' | 'detail';
  showPagination?: boolean;
  pageSize?: number;
  
  // 交互控制
  selectable?: boolean;
  editable?: boolean;
  deletable?: boolean;
  searchable?: boolean;
  
  // 事件处理
  onSelect?: (items: RecordItem[]) => void;
  onEdit?: (item: RecordItem) => void;
  onDelete?: (item: RecordItem) => void;
  onSearch?: (query: string) => void;
  onRefresh?: () => void;
  
  // 样式定制
  className?: string;
  style?: React.CSSProperties;
}
```

#### 现有业务组件映射

1. **trace/TraceRecordView.jsx** ✅ 已标准化
   - 功能：产品溯源记录管理
   - 支持视图：list, table, card, detail
   - 特殊功能：追溯链路展示、时间线视图

2. **farming/FarmingRecordView.jsx** ✅ 已标准化
   - 功能：养殖记录管理
   - 支持视图：list, table, card, detail
   - 特殊功能：动物健康状态、环境监控数据

3. **processing/ProcessingRecordView.jsx** ✅ 已标准化
   - 功能：加工记录管理
   - 支持视图：list, table, card, detail
   - 特殊功能：质量检测数据、加工参数监控

4. **logistics/LogisticsRecordView.jsx** ✅ 已标准化
   - 功能：物流记录管理
   - 支持视图：list, table, card, detail
   - 特殊功能：运输路线、实时位置追踪

### 2. 管理面板组件 (Dashboard Components)

#### 标准接口规范

```javascript
interface DashboardComponentProps {
  // 统计数据
  stats: Array<StatItem>;
  charts?: Array<ChartData>;
  
  // 用户信息
  user: UserInfo;
  permissions: Array<Permission>;
  
  // 快速操作
  quickActions?: Array<QuickAction>;
  recentActivities?: Array<Activity>;
  
  // 事件处理
  onActionClick?: (actionId: string) => void;
  onStatsRefresh?: () => void;
  
  // 样式定制
  className?: string;
  layout?: 'grid' | 'flex';
}
```

#### 现有业务组件映射

5. **admin/AdminDashboard.jsx** ✅ 已标准化
   - 功能：管理员仪表板
   - 特殊功能：权限管理、系统监控、用户管理

6. **profile/UserProfile.jsx** ✅ 已标准化
   - 功能：用户档案管理
   - 特殊功能：个人设置、安全配置、偏好管理

## 数据接口标准化

### 1. 基础数据结构

```javascript
// 通用记录项结构
interface RecordItem {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'inactive' | 'pending' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

// 统计项结构
interface StatItem {
  id: string;
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'stable';
  change?: number;
  icon?: string;
  color?: 'success' | 'warning' | 'error' | 'info';
}

// 用户信息结构
interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  permissions: Array<string>;
  lastLogin?: string;
}
```

### 2. 业务特定数据结构

#### 溯源记录 (TraceRecord)
```javascript
interface TraceRecord extends RecordItem {
  productCode: string;
  batchNumber: string;
  traceSteps: Array<TraceStep>;
  currentStep: string;
  quality: 'A' | 'B' | 'C' | 'D';
}
```

#### 养殖记录 (FarmingRecord)
```javascript
interface FarmingRecord extends RecordItem {
  animalType: 'cattle' | 'pig' | 'chicken' | 'fish' | 'sheep' | 'duck';
  animalId: string;
  healthStatus: 'healthy' | 'sick' | 'treating' | 'quarantined' | 'recovered' | 'dead';
  healthMetrics: {
    weight: number;
    temperature: number;
    heartRate?: number;
  };
}
```

#### 加工记录 (ProcessingRecord)
```javascript
interface ProcessingRecord extends RecordItem {
  processingType: 'slaughter' | 'cleaning' | 'cutting' | 'packaging' | 'freezing' | 'cooking' | 'mixing' | 'grinding';
  processingStatus: 'processing' | 'completed' | 'quality_checking' | 'quality_passed' | 'quality_failed' | 'packaging' | 'ready_to_ship';
  processingParams: {
    temperature?: number;
    duration?: number;
    pressure?: number;
    humidity?: number;
  };
  qualityScore?: number;
}
```

#### 物流记录 (LogisticsRecord)
```javascript
interface LogisticsRecord extends RecordItem {
  transportType: 'road' | 'rail' | 'air' | 'sea' | 'express' | 'cold_chain' | 'bulk' | 'container';
  logisticsStatus: 'pending' | 'picked_up' | 'in_transit' | 'delivering' | 'delivered' | 'delivery_failed' | 'returned' | 'exception';
  transportInfo: {
    driver?: string;
    vehicle?: string;
    estimatedArrival?: string;
    distance?: number;
  };
  cargoInfo: {
    weight: number;
    volume: number;
    temperature?: number;
  };
}
```

## 组件间通信规范

### 1. 事件总线模式

使用统一的事件总线处理组件间通信：

```javascript
// 事件类型定义
const COMPONENT_EVENTS = {
  RECORD_SELECTED: 'record:selected',
  RECORD_UPDATED: 'record:updated',
  RECORD_DELETED: 'record:deleted',
  VIEW_CHANGED: 'view:changed',
  FILTER_APPLIED: 'filter:applied',
};

// 事件发送
import { eventBus } from '@/utils/common/event-emitter';
eventBus.emit(COMPONENT_EVENTS.RECORD_SELECTED, recordData);

// 事件监听
useEffect(() => {
  const handleRecordSelect = (data) => {
    // 处理记录选择事件
  };
  
  eventBus.on(COMPONENT_EVENTS.RECORD_SELECTED, handleRecordSelect);
  return () => eventBus.off(COMPONENT_EVENTS.RECORD_SELECTED, handleRecordSelect);
}, []);
```

### 2. 状态管理集成

业务组件应支持Redux/Context状态管理：

```javascript
// 使用Redux store
const useBusinessComponent = (module) => {
  const dispatch = useDispatch();
  const data = useSelector(state => state[module].data);
  const loading = useSelector(state => state[module].loading);
  const error = useSelector(state => state[module].error);
  
  return {
    data,
    loading,
    error,
    actions: {
      fetchData: () => dispatch(fetchModuleData(module)),
      updateRecord: (record) => dispatch(updateModuleRecord(module, record)),
      deleteRecord: (id) => dispatch(deleteModuleRecord(module, id)),
    }
  };
};
```

## 组件解耦策略

### 1. 业务逻辑与UI表现分离

```javascript
// 业务逻辑Hook
const useTraceBusinessLogic = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const fetchTraceData = async () => {
    setLoading(true);
    try {
      const result = await traceService.fetchRecords();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch trace data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return { data, loading, fetchTraceData };
};

// UI组件
const TraceRecordView = (props) => {
  const { data, loading, fetchTraceData } = useTraceBusinessLogic();
  
  return (
    // UI渲染逻辑
  );
};
```

### 2. 服务层抽象

```javascript
// 通用服务接口
interface BusinessService<T> {
  fetchRecords(params?: any): Promise<T[]>;
  getRecord(id: string): Promise<T>;
  createRecord(data: Partial<T>): Promise<T>;
  updateRecord(id: string, data: Partial<T>): Promise<T>;
  deleteRecord(id: string): Promise<void>;
}

// 具体实现
class TraceService implements BusinessService<TraceRecord> {
  async fetchRecords(params) {
    // 实现溯源记录获取
  }
  
  // 其他方法实现...
}
```

## 样式系统规范

### 1. 主题变量

所有业务组件应使用统一的主题变量：

```css
/* 业务模块色彩系统 */
:root {
  --trace-primary: #1890FF;
  --farming-primary: #52C41A;
  --processing-primary: #FA8C16;
  --logistics-primary: #722ED1;
  --admin-primary: #F5222D;
  --profile-primary: #13C2C2;
}
```

### 2. 组件样式模式

```javascript
// 使用CSS-in-JS或styled-components
const RecordViewContainer = styled.div`
  max-width: 390px;
  margin: 0 auto;
  padding: 16px;
  
  .record-card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    padding: 16px;
    margin-bottom: 16px;
  }
  
  @media (min-width: 768px) {
    max-width: 100%;
    padding: 24px;
  }
`;
```

## 测试策略

### 1. 单元测试模板

```javascript
describe('TraceRecordView', () => {
  const mockData = [
    { id: '1', title: 'Test Record', status: 'active' }
  ];
  
  it('renders record list correctly', () => {
    render(<TraceRecordView data={mockData} />);
    expect(screen.getByText('Test Record')).toBeInTheDocument();
  });
  
  it('handles record selection', () => {
    const onSelect = jest.fn();
    render(<TraceRecordView data={mockData} onSelect={onSelect} />);
    
    fireEvent.click(screen.getByText('Test Record'));
    expect(onSelect).toHaveBeenCalledWith([mockData[0]]);
  });
});
```

### 2. 集成测试

```javascript
describe('Business Component Integration', () => {
  it('communicates between trace and farming components', async () => {
    // 测试组件间通信
  });
  
  it('maintains data consistency across modules', async () => {
    // 测试数据一致性
  });
});
```

## 迁移指南

### 1. 现有组件升级步骤

1. **评估现有组件**：确定需要升级的组件
2. **接口标准化**：按照新接口规范重构Props
3. **数据结构调整**：统一数据结构格式
4. **事件系统集成**：接入统一事件总线
5. **样式系统迁移**：使用标准主题变量
6. **测试覆盖**：添加单元测试和集成测试

### 2. 新组件开发指南

1. **使用模板**：基于标准化模板创建新组件
2. **遵循接口**：严格按照接口规范定义Props
3. **业务逻辑分离**：使用Hook模式分离业务逻辑
4. **样式规范**：遵循UI设计系统规范
5. **测试先行**：编写测试用例后实现功能

## 最佳实践

1. **单一职责**：每个组件专注单一业务功能
2. **可组合性**：支持组件组合和嵌套使用
3. **可配置性**：提供丰富的配置选项
4. **可扩展性**：便于后续功能扩展
5. **性能优化**：使用React.memo和useMemo优化性能
6. **错误处理**：完善的错误边界和异常处理
7. **无障碍性**：支持WCAG 2.1 AA级别可访问性

---

**文档版本**: 1.0  
**最后更新**: 2025-05-21  
**维护者**: 技术团队 