# 白垩纪食品溯源系统 - Phase 1&2 前后端对接方案

> **文档版本**: 1.0  
> **创建时间**: 2025-08-07  
> **适用范围**: React Native 前端 ↔ Node.js 后端  
> **状态**: ✅ Phase 1&2 后端开发完成，ready for 前端集成

---

## 🎯 集成概述

### 已完成的后端功能
✅ **Phase 1**: 认证系统、权限管理、基础数据表  
✅ **Phase 2**: 加工模块、质检记录、设备监控、仪表板、告警管理  
🔄 **Phase 3**: DeepSeek AI集成（规划中）

### API 接口统计
- **认证相关**: 12个接口
- **加工模块**: 8个接口  
- **质检记录**: 6个接口
- **设备监控**: 5个接口
- **仪表板**: 6个接口
- **告警管理**: 5个接口
- **总计**: 42个API接口

---

## 🔐 认证集成指南

### 基础配置
```typescript
// React Native 配置
const API_BASE_URL = 'http://localhost:3001/api';
const MOBILE_API_BASE = `${API_BASE_URL}/mobile`;

// API客户端配置
const apiClient = axios.create({
  baseURL: MOBILE_API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});
```

### 统一登录集成
```typescript
// 1. 统一登录 - 自动识别平台用户和工厂用户
POST /api/mobile/auth/unified-login
{
  "username": "admin",
  "password": "Admin@123456", 
  "deviceInfo": {
    "deviceId": "RN_DEVICE_123",
    "deviceModel": "iPhone 14",
    "platform": "ios",
    "osVersion": "16.0"
  }
}

// 成功响应
{
  "success": true,
  "message": "登录成功",
  "user": {
    "id": 1,
    "username": "admin",
    "userType": "platform", // 或 "factory"
    "role": "system_developer",
    "permissions": {
      "modules": {
        "farming_access": true,
        "processing_access": true,
        "logistics_access": true,
        "admin_access": true
      },
      "features": ["user_manage_all", "developer_debug_access"]
    }
  },
  "tokens": {
    "accessToken": "jwt_token_here",
    "refreshToken": "refresh_token_here"
  }
}
```

### Token 管理
```typescript
// Token 自动刷新
POST /api/mobile/auth/refresh-token
{
  "refreshToken": "refresh_token_here",
  "deviceId": "RN_DEVICE_123"
}

// 请求拦截器（自动添加token）
apiClient.interceptors.request.use(
  (config) => {
    const token = AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }
);
```

### 权限检查集成
```typescript
// 批量权限检查
POST /api/mobile/permissions/batch-check
{
  "permissionChecks": [
    {
      "type": "permission",
      "values": ["processing_batch_create", "quality_inspection_submit"],
      "operator": "AND"
    },
    {
      "type": "role", 
      "values": ["department_admin", "operator"]
    }
  ]
}

// React Native 权限检查组件
const PermissionGuard = ({ permissions, children }) => {
  const { checkPermissions } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  
  useEffect(() => {
    checkPermissions(permissions).then(setHasAccess);
  }, [permissions]);
  
  return hasAccess ? children : <AccessDeniedScreen />;
};
```

---

## 🏭 加工模块集成

### 批次管理
```typescript
// 创建批次
POST /api/mobile/processing/batches
{
  "productType": "牛肉制品",
  "rawMaterials": [
    {"material": "牛肉", "quantity": 1000, "unit": "kg"}
  ],
  "startDate": "2025-08-07",
  "productionLine": "生产线A",
  "targetQuantity": 800
}

// 获取批次列表（支持分页和过滤）
GET /api/mobile/processing/batches?page=1&limit=20&status=in_progress&search=牛肉

// 批次流程操作
POST /api/mobile/processing/batches/{id}/start      // 开始生产
POST /api/mobile/processing/batches/{id}/complete   // 完成生产
POST /api/mobile/processing/batches/{id}/pause      // 暂停生产

// React Native 使用示例
const BatchManager = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const fetchBatches = async (params = {}) => {
    try {
      setLoading(true);
      const response = await apiClient.get('/processing/batches', { params });
      setBatches(response.data.data.batches);
    } catch (error) {
      Alert.alert('错误', '获取批次列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  const startProduction = async (batchId) => {
    try {
      await apiClient.post(`/processing/batches/${batchId}/start`);
      Alert.alert('成功', '生产已开始');
      fetchBatches(); // 刷新列表
    } catch (error) {
      Alert.alert('错误', error.response?.data?.message || '操作失败');
    }
  };
  
  return (
    <FlatList
      data={batches}
      renderItem={({ item }) => <BatchCard batch={item} onStart={startProduction} />}
      refreshing={loading}
      onRefresh={fetchBatches}
    />
  );
};
```

### 质检记录集成
```typescript
// 提交质检记录
POST /api/mobile/processing/quality/inspections
{
  "batchId": "batch_uuid",
  "inspectionType": "final_product",
  "testItems": {
    "temperature": "4.2°C", 
    "ph_value": "6.8",
    "weight": "800kg"
  },
  "overallResult": "pass",
  "qualityScore": 0.92,
  "photos": ["photo_url_1", "photo_url_2"]
}

// 质检统计
GET /api/mobile/processing/quality/statistics?startDate=2025-08-01&endDate=2025-08-07

// React Native 质检表单
const QualityInspectionForm = ({ batchId }) => {
  const [formData, setFormData] = useState({
    testItems: {},
    overallResult: 'pass',
    photos: []
  });
  
  const submitInspection = async () => {
    try {
      const response = await apiClient.post('/processing/quality/inspections', {
        batchId,
        ...formData,
        inspectionType: 'final_product'
      });
      Alert.alert('成功', '质检记录提交成功');
      navigation.goBack();
    } catch (error) {
      Alert.alert('错误', '提交失败');
    }
  };
  
  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    
    if (!result.canceled) {
      // 上传图片到服务器
      const uploadResponse = await uploadImage(result.assets[0].uri);
      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, uploadResponse.data.url]
      }));
    }
  };
  
  return (
    <ScrollView>
      <TestItemInput 
        items={formData.testItems}
        onChange={(items) => setFormData(prev => ({...prev, testItems: items}))}
      />
      <PhotoCapture photos={formData.photos} onTakePhoto={takePhoto} />
      <Button title="提交质检" onPress={submitInspection} />
    </ScrollView>
  );
};
```

---

## 📊 设备监控集成

### 设备状态监控
```typescript
// 获取设备监控列表
GET /api/mobile/processing/equipment/monitoring?department=processing&page=1&limit=20

// 上报设备数据
POST /api/mobile/processing/equipment/{id}/data
{
  "metrics": {
    "temperature": 65.2,
    "pressure": 1.2,
    "speed": 1200,
    "vibration": 0.3
  },
  "status": "normal",
  "dataSource": "manual"
}

// React Native 设备监控
const EquipmentMonitor = () => {
  const [equipment, setEquipment] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  
  const reportData = async (equipmentId, metrics) => {
    try {
      await apiClient.post(`/processing/equipment/${equipmentId}/data`, {
        metrics,
        status: calculateStatus(metrics),
        dataSource: 'manual'
      });
      Alert.alert('成功', '数据上报成功');
    } catch (error) {
      Alert.alert('错误', '数据上报失败');
    }
  };
  
  const calculateStatus = (metrics) => {
    // 根据指标判断设备状态
    if (metrics.temperature > 70 || metrics.pressure > 1.5) {
      return 'warning';
    }
    return 'normal';
  };
  
  return (
    <View>
      <FlatList
        data={equipment}
        renderItem={({ item }) => (
          <EquipmentCard 
            equipment={item}
            onSelect={setSelectedDevice}
            onReport={reportData}
          />
        )}
      />
      <DataInputModal 
        visible={selectedDevice !== null}
        equipment={selectedDevice}
        onSubmit={reportData}
        onClose={() => setSelectedDevice(null)}
      />
    </View>
  );
};
```

---

## 📈 仪表板集成

### 概览数据
```typescript
// 生产概览
GET /api/mobile/processing/dashboard/overview?period=today

// 响应示例
{
  "success": true,
  "data": {
    "period": "today",
    "summary": {
      "totalBatches": 12,
      "activeBatches": 3,
      "completedBatches": 8,
      "qualityInspections": 25,
      "activeAlerts": 2
    },
    "kpi": {
      "productionEfficiency": 67,
      "qualityPassRate": 96,
      "equipmentUtilization": 85
    }
  }
}

// React Native 仪表板
const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  
  const fetchDashboardData = async (period) => {
    try {
      const response = await apiClient.get(`/processing/dashboard/overview?period=${period}`);
      setDashboardData(response.data.data);
    } catch (error) {
      Alert.alert('错误', '获取仪表板数据失败');
    }
  };
  
  useEffect(() => {
    fetchDashboardData(selectedPeriod);
  }, [selectedPeriod]);
  
  if (!dashboardData) return <LoadingScreen />;
  
  return (
    <ScrollView>
      <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
      <KPICards kpi={dashboardData.kpi} />
      <SummaryCards summary={dashboardData.summary} />
      <ProductionChart period={selectedPeriod} />
      <QualityChart period={selectedPeriod} />
    </ScrollView>
  );
};
```

### 趋势分析
```typescript
// 获取趋势数据
GET /api/mobile/processing/dashboard/trends?period=month&metric=production

// 图表组件集成
import { LineChart } from 'react-native-chart-kit';

const TrendChart = ({ period, metric }) => {
  const [chartData, setChartData] = useState(null);
  
  useEffect(() => {
    fetchTrendData(period, metric).then(setChartData);
  }, [period, metric]);
  
  return (
    <LineChart
      data={chartData}
      width={screenWidth}
      height={220}
      chartConfig={{
        backgroundColor: '#ffffff',
        backgroundGradientFrom: '#ffffff',
        backgroundGradientTo: '#ffffff',
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
      }}
      bezier
    />
  );
};
```

---

## 🚨 告警系统集成

### 告警列表和处理
```typescript
// 获取告警列表
GET /api/mobile/processing/alerts?page=1&limit=20&severity=high&status=new

// 确认告警
POST /api/mobile/processing/alerts/{id}/acknowledge

// 解决告警
POST /api/mobile/processing/alerts/{id}/resolve
{
  "resolutionNotes": "设备温度已调整至正常范围"
}

// React Native 告警管理
const AlertsManager = () => {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState({ severity: 'all', status: 'active' });
  
  const acknowledgeAlert = async (alertId) => {
    try {
      await apiClient.post(`/processing/alerts/${alertId}/acknowledge`);
      Alert.alert('成功', '告警已确认');
      fetchAlerts();
    } catch (error) {
      Alert.alert('错误', '操作失败');
    }
  };
  
  const resolveAlert = async (alertId, notes) => {
    try {
      await apiClient.post(`/processing/alerts/${alertId}/resolve`, {
        resolutionNotes: notes
      });
      Alert.alert('成功', '告警已解决');
      fetchAlerts();
    } catch (error) {
      Alert.alert('错误', '操作失败');
    }
  };
  
  return (
    <View>
      <FilterBar filter={filter} onChange={setFilter} />
      <FlatList
        data={alerts}
        renderItem={({ item }) => (
          <AlertCard 
            alert={item}
            onAcknowledge={acknowledgeAlert}
            onResolve={resolveAlert}
          />
        )}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
};
```

---

## 🔄 离线支持和同步

### 离线数据存储
```typescript
// 使用 SQLite 作为本地数据库
import SQLite from 'react-native-sqlite-storage';

const db = SQLite.openDatabase(
  { name: 'cretas_offline.db', location: 'default' },
  () => console.log('Database opened'),
  error => console.log('Database error: ', error)
);

// 离线数据管理
class OfflineDataManager {
  // 保存批次数据到本地
  async saveBatchOffline(batchData) {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'INSERT INTO offline_batches (id, data, created_at, sync_status) VALUES (?, ?, ?, ?)',
          [batchData.id, JSON.stringify(batchData), Date.now(), 'pending'],
          () => resolve(),
          error => reject(error)
        );
      });
    });
  }
  
  // 同步离线数据
  async syncOfflineData() {
    const pendingData = await this.getPendingData();
    
    for (const item of pendingData) {
      try {
        if (item.type === 'batch') {
          await apiClient.post('/processing/batches', JSON.parse(item.data));
        } else if (item.type === 'inspection') {
          await apiClient.post('/processing/quality/inspections', JSON.parse(item.data));
        }
        
        await this.markAsSynced(item.id);
      } catch (error) {
        console.log('Sync failed for item:', item.id, error);
      }
    }
  }
}
```

### 网络状态检测
```typescript
import NetInfo from '@react-native-async-storage/async-storage';

const NetworkManager = () => {
  const [isConnected, setIsConnected] = useState(true);
  const offlineManager = new OfflineDataManager();
  
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      
      // 网络恢复时自动同步
      if (state.isConnected) {
        offlineManager.syncOfflineData();
      }
    });
    
    return unsubscribe;
  }, []);
  
  return { isConnected };
};
```

---

## 📤 文件上传集成

### 图片上传
```typescript
// 移动端文件上传
POST /api/mobile/upload/mobile (multipart/form-data)

// React Native 图片上传
const uploadImage = async (imageUri) => {
  const formData = new FormData();
  formData.append('files', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'photo.jpg',
  });
  formData.append('category', 'quality_inspection');
  
  try {
    const response = await fetch(`${MOBILE_API_BASE}/upload/mobile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${await AsyncStorage.getItem('accessToken')}`,
      },
      body: formData,
    });
    
    return await response.json();
  } catch (error) {
    throw new Error('图片上传失败');
  }
};

// 带进度的上传组件
const ImageUploader = ({ onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const selectAndUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    
    if (!result.canceled) {
      setUploading(true);
      try {
        const uploadPromises = result.assets.map(uploadImage);
        const results = await Promise.all(uploadPromises);
        onUploadComplete(results);
      } catch (error) {
        Alert.alert('错误', '图片上传失败');
      } finally {
        setUploading(false);
      }
    }
  };
  
  return (
    <View>
      <Button title="选择图片" onPress={selectAndUpload} disabled={uploading} />
      {uploading && <ProgressBar progress={progress} />}
    </View>
  );
};
```

---

## 🔧 错误处理和调试

### 统一错误处理
```typescript
// API 响应拦截器
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期，重新登录
      AsyncStorage.removeItem('accessToken');
      NavigationService.navigate('Login');
    } else if (error.response?.status === 403) {
      // 权限不足
      Alert.alert('权限不足', '您没有执行此操作的权限');
    } else if (error.response?.status >= 500) {
      // 服务器错误
      Alert.alert('服务器错误', '请稍后重试');
    }
    
    return Promise.reject(error);
  }
);

// 全局错误处理组件
const ErrorBoundary = ({ children }) => {
  return (
    <ErrorHandler>
      {children}
    </ErrorHandler>
  );
};
```

### 调试工具
```typescript
// 开发环境调试配置
if (__DEV__) {
  // API 请求日志
  apiClient.interceptors.request.use(request => {
    console.log('API Request:', request.method?.toUpperCase(), request.url, request.data);
    return request;
  });
  
  apiClient.interceptors.response.use(
    response => {
      console.log('API Response:', response.status, response.data);
      return response;
    },
    error => {
      console.log('API Error:', error.response?.status, error.response?.data);
      return Promise.reject(error);
    }
  );
}

// 调试信息显示
const DebugInfo = () => {
  const [debugData, setDebugData] = useState({});
  
  useEffect(() => {
    if (__DEV__) {
      setDebugData({
        apiUrl: MOBILE_API_BASE,
        userAgent: 'CretasFoodTrace/1.0',
        version: '1.0.0'
      });
    }
  }, []);
  
  return __DEV__ ? <DebugPanel data={debugData} /> : null;
};
```

---

## 🚀 部署和环境配置

### 环境配置
```typescript
// config/environments.ts
const environments = {
  development: {
    apiUrl: 'http://localhost:3001/api',
    debug: true,
    logLevel: 'debug'
  },
  staging: {
    apiUrl: 'https://staging.cretas.com/api',
    debug: false,
    logLevel: 'info'
  },
  production: {
    apiUrl: 'https://api.cretas.com/api',
    debug: false,
    logLevel: 'error'
  }
};

export const getConfig = () => {
  return environments[process.env.NODE_ENV || 'development'];
};
```

### 构建配置
```json
// package.json scripts
{
  "scripts": {
    "start": "expo start",
    "android:dev": "expo start --android --dev-client",
    "ios:dev": "expo start --ios --dev-client",
    "build:android": "eas build --platform android --profile production",
    "build:ios": "eas build --platform ios --profile production",
    "submit": "eas submit"
  }
}
```

---

## 📋 集成检查清单

### 开发前准备
- [ ] 后端服务运行正常 (http://localhost:3001)
- [ ] 数据库连接配置正确
- [ ] React Native 开发环境搭建完成
- [ ] 必要的 npm 包安装完成

### 认证集成
- [ ] 统一登录接口集成完成
- [ ] Token 存储和自动刷新实现
- [ ] 权限检查组件开发完成
- [ ] 登录状态持久化实现

### 核心功能集成
- [ ] 批次管理界面和API集成
- [ ] 质检记录表单和流程实现
- [ ] 设备监控数据展示和上报
- [ ] 仪表板数据可视化
- [ ] 告警列表和处理流程

### 优化功能
- [ ] 离线数据支持实现
- [ ] 图片上传功能完成
- [ ] 错误处理机制完善
- [ ] 性能优化完成

### 测试验证
- [ ] 单元测试覆盖核心功能
- [ ] 集成测试通过
- [ ] 性能测试达标
- [ ] 用户体验测试完成

---

## 📞 技术支持

### 常见问题
1. **API 请求失败**: 检查网络连接和服务器状态
2. **权限验证失败**: 确认 token 有效性和权限配置
3. **图片上传失败**: 检查文件大小和格式限制
4. **离线同步问题**: 确认网络恢复后的同步逻辑

### 联系方式
- **技术文档**: 参考项目 README.md 和 API_DOCUMENTATION.md
- **问题反馈**: 使用 GitHub Issues
- **集成支持**: 联系后端开发团队

---

**🎉 祝您集成顺利！**

此文档涵盖了白垩纪食品溯源系统前后端对接的所有核心内容，请根据实际需求进行调整和扩展。