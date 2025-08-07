# Phase 0: React Native环境搭建与项目初始化

> React Native Android开发 - Phase 0 (环境准备阶段)
>
> 创建时间: 2025-08-05
> 计划工期: 1周 (5个工作日)
> 状态: 待开始
> 依赖: 无

## 🎯 Phase 0 目标

为React Native Android应用开发建立完整的开发环境，创建项目基础架构，配置必要的开发工具和依赖，为后续Phase 1-3的功能开发奠定坚实基础。

## 📋 任务列表

### **Day 1-2: 开发环境配置**

#### TASK-RN-001: 开发环境安装配置
- **工期**: 1天
- **优先级**: 高
- **负责人**: [待分配]
- **状态**: 待开始

**主要工作**:
- **Node.js安装**: 安装Node.js v18+ LTS版本
- **Java JDK配置**: 安装并配置JDK 11或17
- **Android Studio**: 安装最新版Android Studio
- **Android SDK**: 配置Android SDK和模拟器
- **开发工具**: 安装Expo CLI、EAS CLI、React Native CLI

**详细步骤**:
```bash
# 1. 安装Node.js (v18+ LTS)
# 从官网下载安装包或使用nvm

# 2. 安装全局CLI工具
npm install -g @expo/cli
npm install -g eas-cli
npm install -g react-native-cli

# 3. 验证安装
node --version          # v18+
npm --version           # 9+
expo --version          # 最新版
```

**Android Studio配置**:
- 安装Android Studio最新版
- 配置Android SDK (API Level 33+)
- 创建Android虚拟设备 (AVD)
- 设置ANDROID_HOME环境变量

**验收标准**: 
- [ ] 所有工具版本检查通过
- [ ] Android模拟器可以正常启动
- [ ] 能够运行expo doctor检查无错误

#### TASK-RN-002: 项目创建与基础配置
- **工期**: 1天
- **优先级**: 高
- **负责人**: [待分配]
- **状态**: 待开始
- **依赖**: TASK-RN-001

**主要工作**:
```bash
# 1. 创建Expo项目
npx create-expo-app --template blank-typescript HainiuFoodTrace
cd HainiuFoodTrace

# 2. 安装核心导航依赖
npm install @react-navigation/native
npm install @react-navigation/bottom-tabs
npm install @react-navigation/stack
npm install react-native-screens react-native-safe-area-context

# 3. 安装状态管理和存储
npm install zustand
npm install @react-native-async-storage/async-storage
npm install expo-secure-store

# 4. 安装网络和API相关
npm install axios
npm install @tanstack/react-query

# 5. 安装UI和样式
npm install react-native-elements
npm install react-native-vector-icons
npm install expo-font

# 6. 安装移动端特色功能依赖
npm install react-native-vision-camera
npm install vision-camera-code-scanner
npm install @react-native-community/geolocation
npm install expo-location
npm install expo-camera
npm install react-native-push-notification
npm install expo-notifications

# 7. 安装开发和测试工具
npm install --save-dev @types/react-native
npm install --save-dev jest
npm install --save-dev @testing-library/react-native
```

**项目结构设计**:
```
src/
├── components/           # 通用组件
│   ├── ui/              # UI基础组件
│   ├── forms/           # 表单组件
│   ├── permissions/     # 权限相关组件
│   └── scanner/         # 扫码相关组件
├── modules/             # 业务模块
│   ├── auth/            # 认证模块
│   ├── processing/      # 加工模块
│   ├── farming/         # 养殖模块
│   ├── logistics/       # 物流模块
│   └── sales/           # 销售模块
├── navigation/          # 导航配置
├── services/            # 服务层
│   ├── api/             # API服务
│   ├── auth/            # 认证服务
│   ├── storage/         # 存储服务
│   └── location/        # 定位服务
├── store/               # 状态管理
├── types/               # TypeScript类型定义
├── utils/               # 工具函数
├── hooks/               # 自定义Hooks
└── constants/           # 常量定义
```

**验收标准**:
- [ ] 项目结构清晰完整
- [ ] 所有依赖安装成功
- [ ] 项目可以在Android模拟器中运行
- [ ] TypeScript配置正确无错误

### **Day 3: 基础架构搭建**

#### TASK-RN-003: 基础服务层搭建
- **工期**: 1天
- **优先级**: 高
- **负责人**: [待分配]
- **状态**: 待开始
- **依赖**: TASK-RN-002

**主要工作**:

**API客户端基础**:
```typescript
// src/services/api/apiClient.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/constants/config';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // 请求拦截器 - 自动添加token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截器 - 统一错误处理
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await AsyncStorage.removeItem('auth_token');
          // 触发登出事件
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
```

**存储服务**:
```typescript
// src/services/storage/storageService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export class StorageService {
  // 普通存储 (AsyncStorage)
  static async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  }

  static async getItem(key: string): Promise<string | null> {
    return await AsyncStorage.getItem(key);
  }

  static async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  static async setObject(key: string, value: any): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }

  static async getObject<T>(key: string): Promise<T | null> {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }

  // 安全存储 (SecureStore) - 用于敏感数据
  static async setSecureItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  }

  static async getSecureItem(key: string): Promise<string | null> {
    return await SecureStore.getItemAsync(key);
  }

  static async removeSecureItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }
}
```

**配置管理**:
```typescript
// src/constants/config.ts
import { Platform } from 'react-native';

// API配置
export const API_BASE_URL = __DEV__ 
  ? 'http://10.0.2.2:3000/api'  // Android模拟器
  : 'https://your-production-api.com/api';

// DeepSeek配置
export const DEEPSEEK_CONFIG = {
  API_URL: 'https://api.deepseek.com/v1/chat/completions',
  MODEL: 'deepseek-chat',
  MAX_TOKENS: 4000,
  TEMPERATURE: 0.3,
};

// 应用配置
export const APP_CONFIG = {
  NAME: '海牛食品溯源',
  VERSION: '1.0.0',
  COMPANY_CODE: 'HEINIU',
  SUPPORTED_LANGUAGES: ['zh-CN'],
};

// 权限配置
export const PERMISSIONS = {
  CAMERA: 'camera',
  LOCATION: 'location',
  STORAGE: 'storage',
  BIOMETRIC: 'biometric',
};
```

**验收标准**:
- [ ] API客户端可以成功连接后端
- [ ] 存储服务读写功能正常
- [ ] 配置文件结构清晰完整
- [ ] TypeScript类型定义正确

### **Day 4: 后端API移动端适配**

#### TASK-RN-004: 后端移动端路由准备
- **工期**: 1天
- **优先级**: 高
- **负责人**: [待分配]
- **状态**: 待开始
- **依赖**: TASK-RN-003

**主要工作**:

**移动端专用路由**:
```javascript
// backend/src/routes/mobile.js
const express = require('express');
const multer = require('multer');
const router = express.Router();

// 文件上传配置 (移动端优化)
const upload = multer({
  dest: 'uploads/mobile/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10 // 最多10个文件
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

// 移动端登录 (支持设备信息)
router.post('/auth/mobile-login', async (req, res) => {
  const { username, password, deviceInfo } = req.body;

  try {
    // 验证用户凭据
    const user = await authenticateUser(username, password);
    
    if (user) {
      // 记录设备信息
      await recordDeviceLogin(user.id, deviceInfo);
      
      // 生成移动端优化的token
      const token = generateMobileToken(user);
      
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: user.permissions,
          avatar: user.avatar
        },
        token,
        expiresIn: '30d'
      });
    } else {
      res.status(401).json({ 
        success: false, 
        message: '用户名或密码错误' 
      });
    }
  } catch (error) {
    console.error('移动端登录失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '登录服务暂时不可用' 
    });
  }
});

// 移动端文件上传
router.post('/upload/mobile', upload.array('files'), async (req, res) => {
  try {
    const { category, metadata } = req.body;
    const files = req.files;

    const uploadResults = [];

    for (const file of files) {
      // 图片压缩和优化
      const optimizedPath = await optimizeImage(file.path);
      
      // 保存文件记录
      const fileRecord = await FileRecord.create({
        originalName: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        path: optimizedPath,
        category,
        uploadedBy: req.user.id,
        metadata: JSON.parse(metadata || '{}')
      });

      uploadResults.push({
        id: fileRecord.id,
        url: `/uploads/mobile/${file.filename}`,
        originalName: file.originalname,
        size: file.size
      });
    }

    res.json({
      success: true,
      files: uploadResults,
      message: `成功上传 ${uploadResults.length} 个文件`
    });
  } catch (error) {
    console.error('移动端文件上传失败:', error);
    res.status(500).json({
      success: false,
      message: '文件上传失败'
    });
  }
});

// DeepSeek分析接口
router.post('/analysis/deepseek', async (req, res) => {
  try {
    const { data, requestId } = req.body;

    // 调用DeepSeek服务
    const analysisResult = await deepseekService.analyzeData(data);

    // 记录分析请求
    await AnalysisLog.create({
      requestId,
      userId: req.user.id,
      inputData: data,
      result: analysisResult,
      cost: analysisResult.cost,
      timestamp: new Date()
    });

    res.json({
      success: true,
      result: analysisResult,
      requestId
    });
  } catch (error) {
    console.error('DeepSeek分析失败:', error);
    res.status(500).json({
      success: false,
      message: '智能分析服务暂时不可用'
    });
  }
});

module.exports = router;
```

**中间件增强**:
```javascript
// backend/src/middleware/mobileAuth.js
const jwt = require('jsonwebtoken');

const mobileAuthMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: '未提供认证token' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 检查token是否为移动端token
    if (decoded.platform !== 'mobile') {
      return res.status(401).json({
        success: false,
        message: '无效的移动端token'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'token无效或已过期'
    });
  }
};

module.exports = mobileAuthMiddleware;
```

**验收标准**:
- [ ] 移动端API路由创建完成
- [ ] 文件上传接口支持移动端格式
- [ ] DeepSeek分析接口准备就绪
- [ ] 移动端认证中间件配置正确

### **Day 5: 应用激活机制设计**

#### TASK-RN-005: 应用激活架构设计
- **工期**: 1天
- **优先级**: 中
- **负责人**: [待分配]
- **状态**: 待开始
- **依赖**: TASK-RN-004

**主要工作**:

**激活机制设计**:
```typescript
// src/services/activation/activationService.ts
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { StorageService } from '@/services/storage/storageService';
import { apiClient } from '@/services/api/apiClient';

interface ActivationRequest {
  activationCode: string;
  deviceInfo: DeviceInfo;
  appVersion: string;
}

interface DeviceInfo {
  deviceId: string;
  model: string;
  brand: string;
  osVersion: string;
  appVersion: string;
}

interface ActivationResult {
  success: boolean;
  message?: string;
  company?: {
    id: string;
    name: string;
    type: string;
  };
  features?: string[];
  expiryDate?: string;
}

export class ActivationService {
  private static readonly ACTIVATION_KEY = 'app_activation_status';
  private static readonly ACTIVATION_TOKEN_KEY = 'activation_token';
  private static readonly COMPANY_INFO_KEY = 'company_info';

  // 获取设备信息
  static async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      deviceId: await DeviceInfo.getUniqueId(),
      model: await DeviceInfo.getModel(),
      brand: await DeviceInfo.getBrand(),
      osVersion: await DeviceInfo.getSystemVersion(),
      appVersion: await DeviceInfo.getVersion()
    };
  }

  // 激活应用
  static async activateApp(activationCode: string): Promise<ActivationResult> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      
      const request: ActivationRequest = {
        activationCode,
        deviceInfo,
        appVersion: deviceInfo.appVersion
      };

      const response = await apiClient.post<ActivationResult>(
        '/mobile/activation/activate',
        request
      );

      if (response.success) {
        // 保存激活状态
        await StorageService.setSecureItem(this.ACTIVATION_KEY, 'true');
        await StorageService.setSecureItem(this.ACTIVATION_TOKEN_KEY, response.token);
        await StorageService.setObject(this.COMPANY_INFO_KEY, response.company);

        return response;
      } else {
        return {
          success: false,
          message: response.message || '激活失败'
        };
      }
    } catch (error) {
      console.error('应用激活失败:', error);
      return {
        success: false,
        message: '网络连接失败，请检查网络设置'
      };
    }
  }

  // 检查激活状态
  static async checkActivationStatus(): Promise<boolean> {
    try {
      const isActivated = await StorageService.getSecureItem(this.ACTIVATION_KEY);
      const activationToken = await StorageService.getSecureItem(this.ACTIVATION_TOKEN_KEY);

      if (!isActivated || !activationToken) {
        return false;
      }

      // 验证激活token有效性
      const response = await apiClient.get('/mobile/activation/verify', {
        headers: { 'X-Activation-Token': activationToken }
      });

      return response.valid === true;
    } catch (error) {
      console.error('激活状态检查失败:', error);
      return false;
    }
  }

  // 获取公司信息
  static async getCompanyInfo(): Promise<any> {
    return await StorageService.getObject(this.COMPANY_INFO_KEY);
  }

  // 重置激活状态
  static async resetActivation(): Promise<void> {
    await StorageService.removeSecureItem(this.ACTIVATION_KEY);
    await StorageService.removeSecureItem(this.ACTIVATION_TOKEN_KEY);
    await StorageService.removeItem(this.COMPANY_INFO_KEY);
  }
}
```

**后端激活数据模型设计**:
```javascript
// backend/src/models/Activation.js
const mongoose = require('mongoose');

const activationCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    length: 16
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  enabledFeatures: [{
    type: String,
    enum: ['processing', 'farming', 'logistics', 'sales', 'analytics']
  }],
  maxDevices: {
    type: Number,
    default: 5
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  usedAt: Date,
  expiryDate: {
    type: Date,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true
  },
  activationCodeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ActivationCode',
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  deviceModel: String,
  deviceBrand: String,
  osVersion: String,
  appVersion: String,
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  activatedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'],
    default: 'active'
  }
});

module.exports = {
  ActivationCode: mongoose.model('ActivationCode', activationCodeSchema),
  Device: mongoose.model('Device', deviceSchema)
};
```

**验收标准**:
- [ ] 激活服务架构设计完成
- [ ] 设备信息获取功能正常
- [ ] 后端激活数据模型准备就绪
- [ ] 激活流程设计文档完整

## 🏆 Phase 0 交付物

### 技术交付物
- [ ] **完整配置的开发环境**: Node.js、Android Studio、模拟器全部就绪
- [ ] **可运行的React Native项目**: 基础项目结构和依赖安装完成
- [ ] **API客户端服务**: 统一的网络请求和错误处理机制
- [ ] **存储服务**: 普通存储和安全存储服务
- [ ] **配置管理**: 环境配置和常量管理
- [ ] **后端移动端路由**: 专用API接口准备
- [ ] **应用激活机制**: 激活架构和数据模型设计

### 功能交付物
- [ ] **项目可以在Android模拟器运行**: 基础空白页面显示正常
- [ ] **网络连接测试**: API客户端可以连接后端服务
- [ ] **存储功能测试**: 数据可以正常存取
- [ ] **权限配置**: Android权限清单配置完成

### 文档交付物
- [ ] 开发环境搭建指南
- [ ] 项目结构说明文档
- [ ] API接口设计文档
- [ ] 应用激活流程文档
- [ ] 常见问题解决方案

### 验证标准
- [ ] **环境完整性**: 所有开发工具安装配置正确
- [ ] **项目运行**: React Native项目在Android模拟器中正常运行
- [ ] **API连通**: 前端可以成功调用后端API
- [ ] **存储功能**: 本地存储和安全存储功能正常
- [ ] **权限配置**: Android权限配置无冲突
- [ ] **代码质量**: TypeScript编译无错误，代码规范检查通过

## 📊 时间分配

| 任务 | 内容 | 预计工时 | 实际工时 | 进度 |
|------|------|----------|----------|------|
| TASK-RN-001 | 开发环境配置 | 8小时 | - | 0% |
| TASK-RN-002 | 项目创建配置 | 8小时 | - | 0% |
| TASK-RN-003 | 基础服务搭建 | 8小时 | - | 0% |
| TASK-RN-004 | 后端API适配 | 8小时 | - | 0% |
| TASK-RN-005 | 激活机制设计 | 8小时 | - | 0% |
| **总计** | **Phase 0** | **40小时** | - | **0%** |

## 🚨 风险与对策

### 技术风险
- **风险**: Android开发环境配置复杂，版本兼容性问题
- **对策**: 使用官方推荐版本，详细文档指导，团队互助解决

- **风险**: React Native依赖冲突或安装失败
- **对策**: 使用稳定版本依赖，准备备用安装方案

### 环境风险
- **风险**: 网络问题导致依赖下载失败
- **对策**: 配置国内镜像源，准备离线依赖包

- **风险**: 硬件性能不足影响开发效率
- **对策**: 优化模拟器配置，必要时使用真机测试

## 🔗 依赖关系

### 外部依赖
- 现有后端系统稳定运行
- 开发人员具备React Native基础知识
- 开发设备满足Android开发要求

### 输出到后续Phase
- **Phase 1**: 完整的项目基础和开发环境
- **Phase 2**: API客户端和存储服务
- **Phase 3**: 应用激活机制基础

## 📞 Phase 0 启动检查清单

### 开始前准备
- [ ] 开发设备硬件规格确认 (8GB+ RAM, SSD硬盘)
- [ ] 网络环境稳定 (能访问npm、GitHub等)
- [ ] 开发人员技能准备 (React Native、TypeScript基础)
- [ ] 后端系统运行状态确认

### 第一天行动
1. 召开Phase 0启动会议
2. 分配TASK-RN-001给负责人
3. 准备开发环境安装清单
4. 建立问题记录和解决机制

---

**Phase 0 负责人**: [待分配]
**计划开始时间**: [待确定]
**计划完成时间**: 开始后1周

*Phase 0完成后，整个React Native项目将具备完整的开发基础，为后续的认证系统、业务功能和应用发布阶段提供坚实的技术支撑。*