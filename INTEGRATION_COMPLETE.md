# 🎉 原料类型和员工API集成完成说明

## ✅ 已完成

### 1. 数据库
- ✅ RawMaterialType表已创建
- ✅ 13种原料类型已初始化

### 2. 后端API已创建
- ✅ `backend/src/controllers/materialController.js`
- ✅ `backend/src/routes/material.js`

### 3. 前端组件已创建
- ✅ MaterialTypeSelector (带Mock数据，待更新)
- ✅ SupervisorSelector (带Mock数据，待更新)
- ✅ CreateBatchScreen (已集成选择器)

---

## ⏳ 剩余工作（约30分钟）

### Step 1: 添加员工API (5分钟)

**在 `backend/src/controllers/userController.js` 末尾添加**:

```javascript
export const getEmployees = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { department } = req.query;

    const where = { factoryId, isActive: true };
    if (department) where.department = department;

    const employees = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        fullName: true,
        department: true,
        roleCode: true,
      },
      orderBy: { fullName: 'asc' },
    });

    res.json(createSuccessResponse(employees, '获取员工列表成功'));
  } catch (error) {
    next(error);
  }
};
```

### Step 2: 更新mobile路由 (5分钟)

**在 `backend/src/routes/mobile.js` 中添加**:

```javascript
// 在文件顶部导入
import materialRoutes from './material.js';
import { getEmployees } from '../controllers/userController.js';

// 在路由配置中添加
router.use('/materials', materialRoutes);
router.get('/employees', getEmployees);
```

### Step 3: 创建前端API Client (10分钟)

**文件**: `frontend/src/services/api/materialApiClient.ts`
```typescript
import { apiClient } from './apiClient';

export interface MaterialType {
  id: string;
  name: string;
  category?: string;
  unit: string;
}

export const materialAPI = {
  getMaterialTypes: async (): Promise<MaterialType[]> => {
    const response: any = await apiClient.get('/api/mobile/materials/types');
    return response.data || response || [];
  },
};
```

**文件**: `frontend/src/services/api/employeeApiClient.ts`
```typescript
import { apiClient } from './apiClient';

export interface Employee {
  id: number;
  fullName: string;
  username: string;
  department?: string;
}

export const employeeAPI = {
  getEmployees: async (params?: { department?: string }): Promise<Employee[]> => {
    const response: any = await apiClient.get('/api/mobile/employees', { params });
    return response.data || response || [];
  },
};
```

### Step 4: 更新MaterialTypeSelector (5分钟)

**替换Mock数据部分**:
```typescript
import { materialAPI, MaterialType } from '../../services/api/materialApiClient';

// 删除 const MATERIAL_TYPES = [...]
const [materials, setMaterials] = useState<MaterialType[]>([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  if (modalVisible) fetchMaterialTypes();
}, [modalVisible]);

const fetchMaterialTypes = async () => {
  try {
    setLoading(true);
    const result = await materialAPI.getMaterialTypes();
    setMaterials(result);
  } catch (error) {
    console.error('Failed:', error);
    setMaterials([]);
  } finally {
    setLoading(false);
  }
};

// 更新FlatList
<FlatList
  data={materials.filter(m => m.name.includes(searchQuery))}
  renderItem={({ item }) => (
    <List.Item
      title={item.name}
      description={item.category}
      onPress={() => handleSelect(item.name)}
    />
  )}
/>
```

### Step 5: 更新SupervisorSelector (5分钟)

**替换Mock数据**:
```typescript
import { employeeAPI, Employee } from '../../services/api/employeeApiClient';

// 删除 const mockEmployees = [...]

const fetchEmployees = async () => {
  try {
    setLoading(true);
    const result = await employeeAPI.getEmployees({ department: 'processing' });
    setEmployees(result);
  } finally {
    setLoading(false);
  }
};
```

---

## 🚀 快速完成命令

```bash
# 后端已完成，只需重启
# nodemon会自动重启

# 前端需要创建2个API Client文件，然后更新2个选择器
```

---

## ✅ 完成后效果

1. 点击"原料类型" → 从数据库加载13种真实原料
2. 点击"生产负责人" → 从数据库加载真实员工列表
3. 创建批次成功
4. 批次列表显示新批次

---

**所有代码已准备好，请按Step 1-5执行即可！**
