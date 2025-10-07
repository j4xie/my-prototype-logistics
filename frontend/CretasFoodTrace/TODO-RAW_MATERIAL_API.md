# 原料类型和员工选择器真实API集成 - TODO

**状态**: 进行中
**优先级**: 高
**预计时间**: 2小时

---

## ✅ 已完成

1. ✅ MaterialTypeSelector 组件（使用Mock数据）
2. ✅ SupervisorSelector 组件（使用Mock数据）
3. ✅ CreateBatchScreen 集成两个选择器
4. ✅ 后端 processingController 支持无产品类型创建

---

## ⏳ 待完成（按顺序执行）

### Step 1: 数据库Schema

**文件**: `backend/prisma/schema.prisma`

**添加模型**（在文件末尾添加）:
```prisma
model RawMaterialType {
  id          String   @id @default(uuid())
  factoryId   String   @map("factory_id")
  name        String   // 原料名称
  category    String?  // 分类：鱼类、虾类、贝类
  unit        String   @default("kg")
  description String?
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  createdBy   Int      @map("created_by")

  factory     Factory  @relation(fields: [factoryId], references: [id], onDelete: Cascade)
  creator     User     @relation(fields: [createdBy], references: [id])

  @@unique([factoryId, name])
  @@index([factoryId])
  @@index([category])
  @@map("raw_material_types")
}
```

**更新 Factory 模型** - 添加关系:
```prisma
model Factory {
  // ... 现有字段
  rawMaterialTypes RawMaterialType[]  // 添加这一行
}
```

**更新 User 模型** - 添加关系:
```prisma
model User {
  // ... 现有字段
  createdMaterialTypes RawMaterialType[] @relation("MaterialTypeCreator") // 添加这一行
}
```

**执行迁移**:
```bash
cd backend
npx prisma migrate dev --name add_raw_material_types
npx prisma generate
```

---

### Step 2: 初始化种子数据

**文件**: `backend/scripts/seed-material-types.js`

```javascript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const MATERIAL_TYPES = [
  // 鱼类
  { name: '鲈鱼', category: '鱼类', unit: 'kg' },
  { name: '带鱼', category: '鱼类', unit: 'kg' },
  { name: '三文鱼', category: '鱼类', unit: 'kg' },
  { name: '金枪鱼', category: '鱼类', unit: 'kg' },
  { name: '鳕鱼', category: '鱼类', unit: 'kg' },
  { name: '鲤鱼', category: '鱼类', unit: 'kg' },
  { name: '草鱼', category: '鱼类', unit: 'kg' },
  { name: '黑鱼', category: '鱼类', unit: 'kg' },
  // 虾蟹类
  { name: '虾', category: '虾蟹类', unit: 'kg' },
  { name: '蟹', category: '虾蟹类', unit: 'kg' },
  // 其他
  { name: '贝类', category: '贝类', unit: 'kg' },
  { name: '鱿鱼', category: '头足类', unit: 'kg' },
  { name: '章鱼', category: '头足类', unit: 'kg' },
];

async function seedMaterialTypes() {
  const factoryId = 'TEST_2024_001';
  const creatorId = 1; // super_admin

  for (const material of MATERIAL_TYPES) {
    await prisma.rawMaterialType.create({
      data: {
        factoryId,
        ...material,
        createdBy: creatorId,
      },
    });
  }

  console.log('✅ Seeded', MATERIAL_TYPES.length, 'material types');
}

seedMaterialTypes()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**执行**:
```bash
node backend/scripts/seed-material-types.js
```

---

### Step 3: 后端API - 原料类型管理

**文件**: `backend/src/controllers/materialController.js`

```javascript
import { prisma } from '../config/database.js';
import { createSuccessResponse } from '../utils/responseFormatter.js';

// GET /api/mobile/materials/types
export const getMaterialTypes = async (req, res, next) => {
  try {
    const factoryId = req.user.factoryId || req.user.factoryUser?.factoryId;

    const types = await prisma.rawMaterialType.findMany({
      where: {
        factoryId,
        isActive: true,
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    });

    res.json(createSuccessResponse(types, '获取原料类型成功'));
  } catch (error) {
    next(error);
  }
};

// POST /api/mobile/materials/types
export const createMaterialType = async (req, res, next) => {
  try {
    const factoryId = req.user.factoryId || req.user.factoryUser?.factoryId;
    const { name, category, unit, description } = req.body;

    const type = await prisma.rawMaterialType.create({
      data: {
        factoryId,
        name,
        category,
        unit: unit || 'kg',
        description,
        createdBy: req.user.id,
      },
    });

    res.status(201).json(createSuccessResponse(type, '原料类型创建成功'));
  } catch (error) {
    next(error);
  }
};
```

**文件**: `backend/src/routes/material.js`

```javascript
import express from 'express';
import { getMaterialTypes, createMaterialType } from '../controllers/materialController.js';

const router = express.Router();

router.get('/types', getMaterialTypes);
router.post('/types', createMaterialType);

export default router;
```

**更新**: `backend/src/routes/mobile.js` - 添加路由:
```javascript
import materialRoutes from './material.js';

// ... 现有代码
router.use('/materials', materialRoutes);
```

---

### Step 4: 后端API - 员工列表

**文件**: `backend/src/controllers/userController.js` - 添加方法:

```javascript
// GET /api/mobile/employees
export const getEmployees = async (req, res, next) => {
  try {
    const factoryId = req.user.factoryId || req.user.factoryUser?.factoryId;
    const { department } = req.query;

    const where = {
      factoryId,
      isActive: true,
    };

    if (department) {
      where.department = department;
    }

    const employees = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        fullName: true,
        department: true,
        role: true,
      },
      orderBy: {
        fullName: 'asc',
      },
    });

    res.json(createSuccessResponse(employees, '获取员工列表成功'));
  } catch (error) {
    next(error);
  }
};
```

**更新**: `backend/src/routes/mobile.js` - 添加路由:
```javascript
router.get('/employees', getEmployees);
```

---

### Step 5: 前端API Client

**文件**: `frontend/src/services/api/materialApiClient.ts`

```typescript
import { apiClient } from './apiClient';

export interface MaterialType {
  id: string;
  name: string;
  category?: string;
  unit: string;
  description?: string;
}

export const materialAPI = {
  getMaterialTypes: async (): Promise<MaterialType[]> => {
    const response = await apiClient.get('/api/mobile/materials/types');
    return response.data || [];
  },

  createMaterialType: async (data: {
    name: string;
    category?: string;
    unit?: string;
    description?: string;
  }): Promise<MaterialType> => {
    const response = await apiClient.post('/api/mobile/materials/types', data);
    return response.data;
  },
};
```

**文件**: `frontend/src/services/api/employeeApiClient.ts`

```typescript
import { apiClient } from './apiClient';

export interface Employee {
  id: number;
  username: string;
  fullName: string;
  department?: string;
  role?: string;
}

export const employeeAPI = {
  getEmployees: async (params?: { department?: string }): Promise<Employee[]> => {
    const response = await apiClient.get('/api/mobile/employees', { params });
    return response.data || [];
  },
};
```

---

### Step 6: 更新前端选择器

**文件**: `frontend/src/components/processing/MaterialTypeSelector.tsx`

**删除**:
```typescript
const MATERIAL_TYPES = ['鲈鱼', '带鱼', ...]; // 删除这个Mock数据
```

**添加**:
```typescript
import { materialAPI, MaterialType } from '../../services/api/materialApiClient';

// 在组件内
const [materials, setMaterials] = useState<MaterialType[]>([]);

useEffect(() => {
  if (modalVisible) {
    fetchMaterialTypes();
  }
}, [modalVisible]);

const fetchMaterialTypes = async () => {
  try {
    setLoading(true);
    const result = await materialAPI.getMaterialTypes();
    setMaterials(result);
  } catch (error) {
    console.error('Failed to fetch material types:', error);
  } finally {
    setLoading(false);
  }
};
```

**文件**: `frontend/src/components/processing/SupervisorSelector.tsx`

**删除**:
```typescript
const mockEmployees = [...]; // 删除Mock数据
```

**添加**:
```typescript
import { employeeAPI, Employee } from '../../services/api/employeeApiClient';

const fetchEmployees = async () => {
  try {
    setLoading(true);
    const result = await employeeAPI.getEmployees({ department: 'processing' });
    setEmployees(result);
  } catch (error) {
    console.error('Failed to fetch employees:', error);
    setEmployees([]);
  } finally {
    setLoading(false);
  }
};
```

---

## 🚀 执行顺序

```bash
# 1. 添加数据模型
# 编辑 backend/prisma/schema.prisma

# 2. 执行迁移
cd backend
npx prisma migrate dev --name add_raw_material_types
npx prisma generate

# 3. 初始化数据
node scripts/seed-material-types.js

# 4. 创建后端API
# 创建 materialController.js
# 创建 material.js 路由
# 更新 userController.js 添加 getEmployees
# 更新 mobile.js 路由

# 5. 创建前端API Client
# 创建 materialApiClient.ts
# 创建 employeeApiClient.ts

# 6. 更新选择器组件
# 更新 MaterialTypeSelector.tsx
# 更新 SupervisorSelector.tsx

# 7. 测试
# 重启后端
# 刷新前端
# 测试创建批次
```

---

## 📝 验收标准

- [ ] 原料类型从数据库获取（不是Mock）
- [ ] 员工列表从数据库获取（不是Mock）
- [ ] 可以正常选择原料和负责人
- [ ] 创建批次成功
- [ ] 批次列表显示新创建的批次
- [ ] 控制台无错误

---

**继续实施时，请按照上述步骤依次执行！**
