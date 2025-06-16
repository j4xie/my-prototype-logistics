# 用户中心模块API文档

<!-- updated for: TASK-P2-007 API接口文档完善 - 创建用户中心模块API文档 -->

## 概述

用户中心模块API提供个人信息管理、偏好设置、消息通知和安全配置功能。支持用户对个人账户进行全面管理和自定义设置。

**基础路径**: `/api/v1/profile`

**需要认证**: 所有接口需要JWT Bearer Token认证

**权限要求**: 
- 读取自己的信息: `profile:read`
- 修改自己的信息: `profile:write`
- 安全设置: `profile:security`

## 数据模型

### 用户档案 (UserProfile)

```typescript
interface UserProfile {
  id: string;                  // 用户唯一标识
  username: string;            // 用户名
  email: string;               // 邮箱
  phone?: string;              // 手机号
  fullName: string;            // 真实姓名
  avatar?: string;             // 头像URL
  userType: 'ADMIN' | 'OPERATOR' | 'FARMER' | 'PROCESSOR' | 'LOGISTICS' | 'CONSUMER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  personalInfo: PersonalInfo;  // 个人信息
  companyInfo?: CompanyInfo;   // 企业信息
  preferences: UserPreferences; // 用户偏好
  security: SecuritySettings;  // 安全设置
  statistics: UserStatistics;  // 用户统计
  createdAt: string;           // 创建时间
  updatedAt: string;           // 更新时间
}

interface PersonalInfo {
  idNumber?: string;           // 身份证号(脱敏)
  birthday?: string;           // 生日
  gender?: 'MALE' | 'FEMALE' | 'OTHER';  // 性别
  address?: AddressInfo;       // 地址信息
  bio?: string;                // 个人简介
  occupation?: string;         // 职业
  education?: string;          // 学历
  skills?: string[];           // 技能标签
  interests?: string[];        // 兴趣爱好
}

interface AddressInfo {
  province: string;            // 省份
  city: string;                // 城市
  district?: string;           // 区县
  street?: string;             // 街道
  postalCode?: string;         // 邮政编码
  isDefault: boolean;          // 是否默认地址
}

interface CompanyInfo {
  companyName: string;         // 公司名称
  position: string;            // 职位
  department?: string;         // 部门
  industry: string;            // 行业
  companySize?: string;        // 公司规模
  workYears?: number;          // 工作年限
  license?: LicenseInfo[];     // 资质证书
}

interface LicenseInfo {
  type: string;                // 证书类型
  number: string;              // 证书号码
  issuer: string;              // 发证机构
  issueDate: string;           // 发证日期
  expiryDate?: string;         // 过期日期
  status: 'VALID' | 'EXPIRED' | 'PENDING';  // 状态
}
```

### 用户偏好 (UserPreferences)

```typescript
interface UserPreferences {
  language: string;            // 语言偏好
  timezone: string;            // 时区
  dateFormat: string;          // 日期格式
  timeFormat: '12' | '24';     // 时间格式
  theme: 'LIGHT' | 'DARK' | 'AUTO';  // 主题
  dashboard: DashboardSettings; // 仪表板设置
  notifications: NotificationSettings;  // 通知设置
  privacy: PrivacySettings;    // 隐私设置
  accessibility: AccessibilitySettings;  // 无障碍设置
}

interface DashboardSettings {
  layout: 'GRID' | 'LIST' | 'CARD';  // 布局类型
  itemsPerPage: number;        // 每页显示数量
  defaultPage: string;         // 默认首页
  widgetOrder: string[];       // 组件排序
  hiddenWidgets: string[];     // 隐藏的组件
  autoRefresh: boolean;        // 自动刷新
  refreshInterval: number;     // 刷新间隔(秒)
}

interface NotificationSettings {
  email: EmailNotificationSettings;     // 邮件通知
  sms: SmsNotificationSettings;         // 短信通知
  push: PushNotificationSettings;       // 推送通知
  inApp: InAppNotificationSettings;     // 应用内通知
}

interface EmailNotificationSettings {
  enabled: boolean;            // 是否启用
  frequency: 'INSTANT' | 'DAILY' | 'WEEKLY';  // 频率
  types: string[];             // 通知类型
  schedule?: ScheduleSettings;  // 定时设置
}

interface SmsNotificationSettings {
  enabled: boolean;            // 是否启用
  emergencyOnly: boolean;      // 仅紧急情况
  types: string[];             // 通知类型
}

interface PushNotificationSettings {
  enabled: boolean;            // 是否启用
  showPreview: boolean;        // 显示预览
  sound: boolean;              // 声音提醒
  vibration: boolean;          // 震动提醒
  types: string[];             // 通知类型
}

interface InAppNotificationSettings {
  enabled: boolean;            // 是否启用
  position: 'TOP_RIGHT' | 'TOP_LEFT' | 'BOTTOM_RIGHT' | 'BOTTOM_LEFT';
  duration: number;            // 显示时长(秒)
  maxCount: number;            // 最大显示数量
}

interface ScheduleSettings {
  startTime: string;           // 开始时间
  endTime: string;             // 结束时间
  timezone: string;            // 时区
  weekdays: number[];          // 工作日(0-6)
}

interface PrivacySettings {
  profileVisibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';  // 档案可见性
  showEmail: boolean;          // 显示邮箱
  showPhone: boolean;          // 显示手机
  allowSearch: boolean;        // 允许搜索
  dataSharing: boolean;        // 数据共享
  analytics: boolean;          // 统计分析
}

interface AccessibilitySettings {
  fontSize: 'SMALL' | 'MEDIUM' | 'LARGE' | 'EXTRA_LARGE';  // 字体大小
  contrast: 'NORMAL' | 'HIGH';  // 对比度
  animations: boolean;         // 动画效果
  screenReader: boolean;       // 屏幕阅读器
  keyboardNavigation: boolean; // 键盘导航
}
```

### 安全设置 (SecuritySettings)

```typescript
interface SecuritySettings {
  passwordInfo: PasswordInfo;  // 密码信息
  twoFactor: TwoFactorSettings; // 两步验证
  sessions: SessionInfo[];     // 登录会话
  trustedDevices: TrustedDevice[]; // 信任设备
  loginHistory: LoginRecord[]; // 登录历史
  securityQuestions: SecurityQuestion[]; // 安全问题
}

interface PasswordInfo {
  lastChanged: string;         // 最后修改时间
  strength: 'WEAK' | 'MEDIUM' | 'STRONG';  // 密码强度
  expiry?: string;             // 过期时间
  requireChange: boolean;      // 需要修改
}

interface TwoFactorSettings {
  enabled: boolean;            // 是否启用
  method: 'SMS' | 'EMAIL' | 'TOTP' | 'HARDWARE';  // 验证方式
  backupCodes: string[];       // 备用码(脱敏)
  trustedFor: number;          // 信任时长(小时)
  lastUsed?: string;           // 最后使用时间
}

interface SessionInfo {
  id: string;                  // 会话ID
  deviceName: string;          // 设备名称
  browser: string;             // 浏览器
  os: string;                  // 操作系统
  ipAddress: string;           // IP地址
  location?: string;           // 地理位置
  loginTime: string;           // 登录时间
  lastActivity: string;        // 最后活动时间
  isCurrent: boolean;          // 是否当前会话
  isExpired: boolean;          // 是否过期
}

interface TrustedDevice {
  id: string;                  // 设备ID
  name: string;                // 设备名称
  deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET';  // 设备类型
  fingerprint: string;         // 设备指纹(脱敏)
  firstSeen: string;           // 首次见到
  lastSeen: string;            // 最后见到
  isActive: boolean;           // 是否活跃
  trustLevel: 'LOW' | 'MEDIUM' | 'HIGH';  // 信任级别
}

interface LoginRecord {
  id: string;                  // 记录ID
  loginTime: string;           // 登录时间
  ipAddress: string;           // IP地址
  location?: string;           // 地理位置
  device: string;              // 设备信息
  browser: string;             // 浏览器
  success: boolean;            // 是否成功
  failureReason?: string;      // 失败原因
  riskScore: number;           // 风险评分
}

interface SecurityQuestion {
  id: string;                  // 问题ID
  question: string;            // 问题内容
  isActive: boolean;           // 是否激活
  createdAt: string;           // 创建时间
}
```

### 用户统计 (UserStatistics)

```typescript
interface UserStatistics {
  loginStats: LoginStatistics; // 登录统计
  activityStats: ActivityStatistics; // 活动统计
  engagementStats: EngagementStatistics; // 参与度统计
  achievementStats: AchievementStatistics; // 成就统计
}

interface LoginStatistics {
  totalLogins: number;         // 总登录次数
  uniqueDays: number;          // 登录天数
  averageSessionDuration: number; // 平均会话时长(分钟)
  longestSession: number;      // 最长会话时长(分钟)
  lastLogin: string;           // 最后登录时间
  loginStreak: number;         // 连续登录天数
  maxLoginStreak: number;      // 最大连续登录天数
}

interface ActivityStatistics {
  totalActions: number;        // 总操作次数
  documentsCreated: number;    // 创建文档数
  documentsModified: number;   // 修改文档数
  searchQueries: number;       // 搜索次数
  reportsGenerated: number;    // 生成报告数
  apiCallsMade: number;        // API调用次数
}

interface EngagementStatistics {
  profileCompleteness: number; // 档案完整度(%)
  featureUsage: FeatureUsage[]; // 功能使用情况
  helpRequests: number;        // 帮助请求次数
  feedbackSubmitted: number;   // 反馈提交次数
  invitationsSent: number;     // 邀请发送次数
}

interface FeatureUsage {
  feature: string;             // 功能名称
  usageCount: number;          // 使用次数
  lastUsed: string;            // 最后使用时间
  proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';  // 熟练度
}

interface AchievementStatistics {
  totalAchievements: number;   // 总成就数
  recentAchievements: Achievement[]; // 最近成就
  points: number;              // 积分
  level: number;               // 等级
  nextLevelPoints: number;     // 下一等级所需积分
}

interface Achievement {
  id: string;                  // 成就ID
  name: string;                // 成就名称
  description: string;         // 成就描述
  icon: string;                // 图标
  category: string;            // 分类
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';  // 稀有度
  points: number;              // 积分奖励
  unlockedAt: string;          // 解锁时间
}
```

## 接口列表

### 个人信息管理

#### 获取个人档案

**请求**:
```http
GET /api/v1/profile
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "id": "user-001",
    "username": "farmer_zhang",
    "email": "zhang@example.com",
    "phone": "138****8001",
    "fullName": "张三",
    "avatar": "https://cdn.example.com/avatars/user-001.jpg",
    "userType": "FARMER",
    "status": "ACTIVE",
    "personalInfo": {
      "idNumber": "110***********0123",
      "birthday": "1985-06-15",
      "gender": "MALE",
      "address": {
        "province": "山东省",
        "city": "寿光市",
        "district": "洛城街道",
        "street": "农业园区东路100号",
        "isDefault": true
      },
      "bio": "专业蔬菜种植农户，从事有机农业20年",
      "occupation": "农场主",
      "skills": ["有机种植", "温室管理", "病虫害防治"]
    },
    "companyInfo": {
      "companyName": "张三有机农场",
      "position": "农场主",
      "industry": "农业",
      "companySize": "10-50人",
      "workYears": 20
    },
    "createdAt": "2023-01-15T08:30:00Z",
    "updatedAt": "2023-05-21T14:20:00Z"
  }
}
```

#### 更新个人信息

**请求**:
```http
PATCH /api/v1/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "fullName": "张三丰",
  "personalInfo": {
    "bio": "专业有机蔬菜种植，绿色食品认证农场主",
    "skills": ["有机种植", "温室管理", "病虫害防治", "土壤改良"]
  },
  "companyInfo": {
    "companyName": "张三丰有机农场",
    "companySize": "50-100人"
  }
}
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "id": "user-001",
    "fullName": "张三丰",
    // ... 更新后的完整信息
  }
}
```

#### 上传头像

**请求**:
```http
POST /api/v1/profile/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "avatar": [文件数据]
}
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "avatarUrl": "https://cdn.example.com/avatars/user-001-new.jpg",
    "thumbnailUrl": "https://cdn.example.com/avatars/thumb/user-001-new.jpg"
  }
}
```

### 偏好设置

#### 获取用户偏好

**请求**:
```http
GET /api/v1/profile/preferences
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "language": "zh-CN",
    "timezone": "Asia/Shanghai",
    "dateFormat": "YYYY-MM-DD",
    "timeFormat": "24",
    "theme": "LIGHT",
    "dashboard": {
      "layout": "GRID",
      "itemsPerPage": 20,
      "defaultPage": "dashboard",
      "autoRefresh": true,
      "refreshInterval": 300
    },
    "notifications": {
      "email": {
        "enabled": true,
        "frequency": "DAILY",
        "types": ["system", "security", "updates"]
      },
      "push": {
        "enabled": true,
        "showPreview": true,
        "sound": true,
        "vibration": false
      }
    },
    "privacy": {
      "profileVisibility": "FRIENDS",
      "showEmail": false,
      "showPhone": false,
      "allowSearch": true,
      "dataSharing": false
    }
  }
}
```

#### 更新偏好设置

**请求**:
```http
PATCH /api/v1/profile/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "theme": "DARK",
  "dashboard": {
    "layout": "LIST",
    "itemsPerPage": 50,
    "autoRefresh": false
  },
  "notifications": {
    "email": {
      "frequency": "WEEKLY",
      "types": ["security", "updates"]
    }
  }
}
```

### 安全设置

#### 获取安全信息

**请求**:
```http
GET /api/v1/profile/security
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "passwordInfo": {
      "lastChanged": "2023-04-15T10:30:00Z",
      "strength": "STRONG",
      "requireChange": false
    },
    "twoFactor": {
      "enabled": true,
      "method": "TOTP",
      "backupCodes": ["abc***def", "123***789"],
      "trustedFor": 24,
      "lastUsed": "2023-05-21T08:30:00Z"
    },
    "sessions": [
      {
        "id": "session-001",
        "deviceName": "Chrome on Windows",
        "browser": "Chrome 113",
        "os": "Windows 10",
        "ipAddress": "192.168.1.100",
        "location": "山东省寿光市",
        "loginTime": "2023-05-21T08:30:00Z",
        "lastActivity": "2023-05-21T14:20:00Z",
        "isCurrent": true,
        "isExpired": false
      }
    ],
    "trustedDevices": [
      {
        "id": "device-001",
        "name": "我的电脑",
        "deviceType": "DESKTOP",
        "firstSeen": "2023-04-01T10:00:00Z",
        "lastSeen": "2023-05-21T14:20:00Z",
        "isActive": true,
        "trustLevel": "HIGH"
      }
    ]
  }
}
```

#### 修改密码

**请求**:
```http
POST /api/v1/profile/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "CurrentPass123!",
  "newPassword": "NewSecurePass456!",
  "confirmPassword": "NewSecurePass456!"
}
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "message": "密码修改成功",
    "passwordStrength": "STRONG",
    "nextChangeRequired": "2023-11-21T00:00:00Z"
  }
}
```

#### 启用两步验证

**请求**:
```http
POST /api/v1/profile/two-factor/enable
Authorization: Bearer <token>
Content-Type: application/json

{
  "method": "TOTP",
  "verificationCode": "123456"
}
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "enabled": true,
    "method": "TOTP",
    "backupCodes": [
      "abcd-efgh-ijkl",
      "1234-5678-9012",
      "mnop-qrst-uvwx"
    ],
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  }
}
```

#### 管理信任设备

**请求**:
```http
DELETE /api/v1/profile/trusted-devices/{deviceId}
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "message": "设备已从信任列表中移除"
  }
}
```

#### 终止会话

**请求**:
```http
DELETE /api/v1/profile/sessions/{sessionId}
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "message": "会话已终止"
  }
}
```

### 消息通知

#### 获取通知列表

**请求**:
```http
GET /api/v1/profile/notifications?page=1&limit=20&type=security&status=unread
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "notif-001",
      "type": "security",
      "title": "新设备登录提醒",
      "content": "您的账户在新设备上登录，IP地址：192.168.1.200",
      "priority": "HIGH",
      "status": "UNREAD",
      "actionUrl": "/profile/security",
      "metadata": {
        "ipAddress": "192.168.1.200",
        "location": "北京市"
      },
      "createdAt": "2023-05-21T15:30:00Z",
      "expiresAt": "2023-05-28T15:30:00Z"
    }
  ],
  "meta": {
    "total": 15,
    "unreadCount": 8,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

#### 标记通知为已读

**请求**:
```http
PATCH /api/v1/profile/notifications/{notificationId}/read
Authorization: Bearer <token>
```

#### 批量操作通知

**请求**:
```http
POST /api/v1/profile/notifications/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "markAsRead",
  "notificationIds": ["notif-001", "notif-002", "notif-003"]
}
```

### 用户统计

#### 获取个人统计

**请求**:
```http
GET /api/v1/profile/statistics
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "loginStats": {
      "totalLogins": 245,
      "uniqueDays": 89,
      "averageSessionDuration": 125,
      "longestSession": 480,
      "lastLogin": "2023-05-21T08:30:00Z",
      "loginStreak": 7,
      "maxLoginStreak": 15
    },
    "activityStats": {
      "totalActions": 1250,
      "documentsCreated": 45,
      "documentsModified": 120,
      "searchQueries": 380,
      "reportsGenerated": 25
    },
    "engagementStats": {
      "profileCompleteness": 85,
      "featureUsage": [
        {
          "feature": "溯源记录",
          "usageCount": 156,
          "lastUsed": "2023-05-21T14:20:00Z",
          "proficiency": "ADVANCED"
        }
      ],
      "helpRequests": 3,
      "feedbackSubmitted": 2
    },
    "achievementStats": {
      "totalAchievements": 12,
      "points": 2450,
      "level": 5,
      "nextLevelPoints": 3000,
      "recentAchievements": [
        {
          "id": "ach-001",
          "name": "连续登录达人",
          "description": "连续登录7天",
          "category": "参与度",
          "rarity": "COMMON",
          "points": 100,
          "unlockedAt": "2023-05-21T08:30:00Z"
        }
      ]
    }
  }
}
```

## 错误码表

| 错误码 | HTTP状态码 | 描述 | 解决方案 |
|--------|------------|------|----------|
| PROFILE_NOT_FOUND | 404 | 用户档案不存在 | 检查用户是否已注册 |
| INVALID_CURRENT_PASSWORD | 422 | 当前密码错误 | 输入正确的当前密码 |
| PASSWORD_TOO_WEAK | 422 | 新密码强度不足 | 使用更强的密码 |
| PASSWORD_RECENTLY_USED | 422 | 密码最近使用过 | 选择不同的密码 |
| INVALID_VERIFICATION_CODE | 422 | 验证码错误 | 检查验证码是否正确 |
| TWO_FACTOR_ALREADY_ENABLED | 422 | 两步验证已启用 | 无需重复启用 |
| SESSION_NOT_FOUND | 404 | 会话不存在 | 检查会话ID是否正确 |
| DEVICE_NOT_FOUND | 404 | 设备不存在 | 检查设备ID是否正确 |
| CANNOT_DELETE_CURRENT_SESSION | 422 | 无法删除当前会话 | 使用其他会话操作 |
| AVATAR_TOO_LARGE | 422 | 头像文件过大 | 压缩图片后重新上传 |
| INVALID_FILE_FORMAT | 422 | 文件格式不支持 | 使用支持的图片格式 |
| NOTIFICATION_NOT_FOUND | 404 | 通知不存在 | 检查通知ID是否正确 |
| INVALID_PREFERENCE_VALUE | 422 | 偏好设置值无效 | 检查设置值是否符合要求 |

## 业务规则

1. **个人信息规则**:
   - 用户名不能修改
   - 邮箱修改需要验证
   - 手机号修改需要短信验证
   - 敏感信息需要脱敏显示

2. **密码安全规则**:
   - 密码必须包含大小写字母、数字和特殊字符
   - 密码长度至少8位
   - 不能使用最近使用过的5个密码
   - 密码有效期90天

3. **两步验证规则**:
   - 启用后不能立即禁用(24小时冷却期)
   - 备用码只能使用一次
   - TOTP密钥每30秒更新一次
   - 信任设备有效期30天

4. **会话管理规则**:
   - 最多允许5个并发会话
   - 会话闲置8小时自动过期
   - 可疑登录需要额外验证
   - 不能删除当前会话

5. **通知规则**:
   - 通知保留30天后自动删除
   - 重要通知不能删除只能标记已读
   - 通知频率限制防止骚扰
   - 关键安全事件强制通知

## 使用示例

### 完整的用户档案管理流程示例

```javascript
// 1. 获取用户档案
const profile = await fetch('/api/v1/profile', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token
  }
});

// 2. 更新个人信息
const updateProfile = await fetch('/api/v1/profile', {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    personalInfo: {
      bio: '更新的个人简介',
      skills: ['新技能1', '新技能2']
    }
  })
});

// 3. 修改密码
const changePassword = await fetch('/api/v1/profile/change-password', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    currentPassword: 'OldPass123!',
    newPassword: 'NewPass456!',
    confirmPassword: 'NewPass456!'
  })
});

// 4. 启用两步验证
const enable2FA = await fetch('/api/v1/profile/two-factor/enable', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    method: 'TOTP',
    verificationCode: '123456'
  })
});

// 5. 更新通知偏好
const updatePreferences = await fetch('/api/v1/profile/preferences', {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    notifications: {
      email: {
        enabled: true,
        frequency: 'WEEKLY'
      }
    }
  })
});
``` 