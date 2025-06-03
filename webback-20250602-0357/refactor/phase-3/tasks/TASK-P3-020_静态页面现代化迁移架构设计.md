# TASK-P3-020: 静态页面现代化迁移架构设计

**任务ID**: TASK-P3-020  
**任务类型**: 🏗�?架构设计  
**优先�?*: P0 (最�?  
**预估工期**: 2�? 
**状�?*: 📝 规划�? 
**创建日期**: 2025-01-15  
**最后更�?*: 2025-01-15  
**依赖任务**: TASK-P3-015 (现代化组件库) �?已完�?

<!-- updated for: 深度分析84个页面结构，设计完整现代化迁移架�?-->

## 📋 任务概述

设计静态页面现代化迁移的完整架构方案，基于深度分析�?*84个页�?*(26主页�?58二级页面)，建立完整的页面跳转关系图、Next.js路由架构、组件化策略和预览系统设计。为后续具体迁移任务提供技术蓝图�?

### 🎯 核心目标

1. **完整页面结构分析**: 建立84个页面的完整清单和跳转关系图
2. **Next.js架构设计**: 设计App Router路由结构和SSG/SSR策略
3. **组件化重构策�?*: 基于已完成的15个现代化组件库制定页面组件化方案
4. **预览系统架构**: 设计现代化的交互式页面预览系�?
5. **技术实施规�?*: 建立TypeScript类型系统、构建优化和性能标准

## 📊 深度页面结构分析 **【核心发现�?*

### 🔍 完整页面清单 (84个页�?

#### P0核心业务页面 (7主页�?+ 15二级页面) = 22页面
```
📁 认证系统 (2页面)
├── pages/auth/login.html (705�? 26KB) - 用户登录 🔄
�?  ├── 跳转目标: home-selector.html (成功登录)
�?  └── 二级页面: reset-password.html, register.html (需补充)

📁 导航枢纽 (1�?+ 3二级)
├── pages/home/home-selector.html (883�? 34KB) - 功能模块选择�?�?
�?  ├── 📍 跳转�? home-farming.html, home-processing.html, home-logistics.html
�?  ├── 📍 跳转�? ../trace/trace-query.html (追溯查询)
�?  └── 📍 跳转�? ../profile/profile.html (我的)

📁 溯源查询系统 (4�?+ 12二级)
├── pages/product-trace.html (740�? 21KB) - 产品溯源查询主页 🔄
�?  ├── 📍 二级跳转: trace-detail.html, trace-certificate.html
�?  └── 📍 地图视图: trace-map.html
├── pages/trace/trace-query.html (523�? 25KB) - 溯源查询 🔄
�?  ├── 📍 查询结果跳转: trace-detail.html?id=TR202305120001
�?  ├── 📍 扫码功能: 直接跳转详情�?
�?  └── 📍 历史记录: 查询历史列表
├── pages/trace/trace-detail.html (572�? 34KB) - 溯源详情�?�?多标�?
�?  ├── 📑 内置标签�? 基本信息、溯源流程、证书与检�?
�?  ├── 📍 跳转�? trace-certificate.html (查看完整证书)
�?  └── 📍 底部导航: home-selector.html, trace-list.html, profile.html
├── pages/trace/trace-list.html (470�? 22KB) - 溯源列表 🔄
�?  ├── 📍 每行记录跳转: trace-detail.html
�?  ├── 📍 扫码功能: trace-detail.html?traceCode=XXX&source=scan
�?  └── 📍 新建记录: trace-edit.html?mode=new
└── pages/trace/trace-certificate.html (343�? 15KB) - 溯源证书
    └── 📍 返回: trace-detail.html
```

#### P1业务模块页面 (12主页�?+ 25二级页面) = 37页面
```
📁 养殖管理模块 (5�?+ 8二级)
├── home-farming.html �?跳转到各个养殖子功能
├── create-trace.html �?表单提交后跳转到列表或详�?
├── farming-vaccine.html �?疫苗记录详情页面
├── farming-breeding.html �?繁育信息详情页面  
├── farming-monitor.html �?监控视频详情页面
└── 🔍 二级页面: 
    ├── indicator-detail.html (指标详情页面)
    ├── batch-detail.html (批次详情页面)
    ├── monitoring-live.html (实时监控页面)
    ├── vaccine-schedule.html (疫苗计划页面)
    ├── breeding-record.html (繁育记录页面)
    ├── feed-management.html (饲料管理页面)
    ├── environment-control.html (环境控制页面)
    └── health-monitoring.html (健康监控页面)

📁 生产加工模块 (4�?+ 12二级)
├── home-processing.html �?生产加工首页导航枢纽
├── processing-reports.html �?质检报告列表和详�?
├── processing-quality.html �?肉质等级评定详情
├── processing-photos.html �?加工拍照和图片查�?
└── 🔍 二级页面:
    ├── process-detail.html (生产进度详情)
    ├── quality-test-detail.html (质检详情)
    ├── photo-gallery.html (图片画廊)
    ├── batch-processing.html (批次加工页面)
    ├── equipment-status.html (设备状态页�?
    ├── production-schedule.html (生产计划页面)
    ├── safety-check.html (安全检查页�?
    ├── temperature-log.html (温度记录页面)
    ├── packaging-info.html (包装信息页面)
    ├── shipping-prep.html (出货准备页面)
    ├── quality-standards.html (质量标准页面)
    └── compliance-check.html (合规检查页�?

📁 销售物流模�?(2�?+ 3二级)
├── home-logistics.html �?销售物流首�?
├── trace-map.html �?地图展示 🌍 地理信息可视�?
└── 🔍 二级页面:
    ├── route-detail.html (路线详情)
    ├── delivery-tracking.html (配送跟�?
    └── warehouse-management.html (仓储管理)

📁 通用功能 (1�?+ 2二级)
├── trace-edit.html �?溯源记录编辑
└── 🔍 二级页面:
    ├── trace-edit.html?mode=new (新建模式)
    └── trace-edit.html?id=XXX (编辑模式)
```

#### P2管理与辅助页�?(7主页�?+ 18二级页面) = 25页面
```
📁 用户中心 (3�?+ 8二级)
├── profile.html �?个人中心主页
├── settings.html �?系统设置 ⚙️ 包含大量跳转
�?  ├── 📍 跳转�? ../admin/template.html (模板配置�?
�?  ├── 📍 跳转�? ../../pages/admin/admin-system.html?from=settings
�?  └── 📍 跳转�? help-center.html
├── help-center.html �?帮助中心
└── 🔍 二级页面:
    ├── profile-edit.html (个人信息编辑)
    ├── password-change.html (密码修改)
    ├── notification-settings.html (通知设置)
    ├── privacy-settings.html (隐私设置)
    ├── account-security.html (账户安全)
    ├── data-export.html (数据导出)
    ├── feedback.html (意见反馈)
    └── about.html (关于页面)

📁 管理后台 (4�?+ 10二级)
├── admin-dashboard.html �?管理员控制台 💻 PC端布局
├── data-import.html �?数据导入 💻 PC端布局
├── user-management.html �?用户管理 💻 PC端布局
├── system-logs.html �?系统日志 💻 PC端布局
├── template.html �?模板配置�?
├── auth/login.html �?管理员登�?
└── 🔍 二级页面:
    ├── admin-users.html (管理员用户管�?
    ├── permission-management.html (权限管理)
    ├── system-config.html (系统配置)
    ├── backup-restore.html (备份恢复)
    ├── audit-log.html (审计日志)
    ├── performance-monitor.html (性能监控)
    ├── alert-management.html (告警管理)
    ├── report-generator.html (报表生成�?
    ├── data-analytics.html (数据分析)
    └── system-maintenance.html (系统维护)
```

### 🔗 页面跳转关系映射 **【技术核心�?*

#### 复杂跳转关系类型
```typescript
interface PageJumpType {
  // 🔄 导航跳转: 模块间切�?
  navigation: 'home-selector' | 'module-home' | 'bottom-tab';
  
  // 📋 列表→详�? 列表页面跳转到详情页�?
  listToDetail: 'trace-list->trace-detail' | 'batch-list->batch-detail';
  
  // 📝 表单→结�? 表单提交后跳转到结果页面
  formToResult: 'create-trace->trace-list' | 'edit-profile->profile';
  
  // 🎛�?标签页切�? 页面内部标签页导�?
  tabSwitch: 'trace-detail-tabs' | 'admin-dashboard-tabs';
  
  // ⚙️ 设置跳转: 设置页面到各功能模块
  settingsJump: 'settings->admin' | 'settings->template';
  
  // 🔍 查询→结�? 查询页面到结果展�?
  queryToResult: 'trace-query->trace-detail' | 'search->results';
}
```

#### 完整跳转关系配置
```typescript
const pageJumpMap = {
  // P0核心页面跳转
  'auth/login': {
    successJump: 'home/selector',
    forgotPassword: 'auth/reset-password',
    register: 'auth/register'
  },
  
  'home/selector': {
    farmingJump: 'farming/monitor',
    processingJump: 'processing/reports',
    logisticsJump: 'logistics/tracking',
    traceJump: 'trace/query',
    profileJump: 'profile/home'
  },
  
  'trace/query': {
    searchResult: 'trace/detail?id={id}',
    scanResult: 'trace/detail?source=scan&code={code}',
    historyView: 'trace/list'
  },
  
  'trace/list': {
    itemDetail: 'trace/detail?id={id}',
    createNew: 'trace/edit?mode=new',
    scanNew: 'trace/detail?source=scan'
  },
  
  'trace/detail': {
    certificateView: 'trace/certificate?id={id}',
    editRecord: 'trace/edit?id={id}',
    backToList: 'trace/list',
    homeReturn: 'home/selector',
    tabSwitches: ['info', 'process', 'certificate']
  },
  
  // P1业务模块跳转
  'farming/monitor': {
    indicatorDetail: 'farming/indicator/{id}',
    batchDetail: 'farming/batch/{id}',
    liveMonitor: 'farming/monitoring-live',
    vaccineSchedule: 'farming/vaccine-schedule',
    breedingRecord: 'farming/breeding-record'
  },
  
  'processing/reports': {
    reportDetail: 'processing/detail/{id}',
    qualityTest: 'processing/quality-test/{id}',
    photoGallery: 'processing/photo-gallery/{batch}',
    batchProcessing: 'processing/batch/{id}'
  },
  
  // P2管理页面跳转  
  'profile/settings': {
    adminSystem: 'admin/dashboard?from=settings',
    templateConfig: 'admin/template',
    helpCenter: 'profile/help-center',
    profileEdit: 'profile/edit',
    passwordChange: 'profile/password',
    notificationSettings: 'profile/notifications'
  },
  
  'admin/dashboard': {
    userManagement: 'admin/users',
    systemLogs: 'admin/logs',
    dataImport: 'admin/import',
    permissionManagement: 'admin/permissions',
    systemConfig: 'admin/config'
  }
  
  // ... 84个页面的完整跳转配置
};
```

## 🏗�?Next.js架构设计 **【技术蓝图�?*

### App Router目录结构设计
```
web-app-next/src/app/
├── (auth)/                     # 认证路由�?
�?  ├── login/page.tsx          # 用户登录
�?  ├── register/page.tsx       # 用户注册
�?  ├── reset-password/page.tsx # 密码重置
�?  └── admin/
�?      └── login/page.tsx      # 管理员登�?
�?
├── (dashboard)/                # 仪表板路由组 - 需要认�?
�?  ├── home/page.tsx           # 主页
�?  ├── selector/page.tsx       # 功能选择�?
�?  └── layout.tsx              # 认证布局
�?
├── (trace)/                    # 溯源功能路由�?
�?  ├── page.tsx                # 溯源主页 (product-trace)
�?  ├── query/page.tsx          # 溯源查询
�?  ├── list/page.tsx           # 溯源列表
�?  ├── detail/
�?  �?  └── [id]/page.tsx       # 溯源详情 (动态路�?
�?  ├── certificate/
�?  �?  └── [id]/page.tsx       # 溯源证书
�?  ├── edit/
�?  �?  └── [id]/page.tsx       # 编辑记录 (可选ID)
�?  └── map/page.tsx            # 地图视图
�?
├── (farming)/                  # 养殖管理路由�?
�?  ├── page.tsx                # 养殖首页
�?  ├── monitor/page.tsx        # 监控页面
�?  ├── vaccine/page.tsx        # 疫苗管理
�?  ├── breeding/page.tsx       # 繁育管理
�?  ├── create-trace/page.tsx   # 创建溯源
�?  ├── indicator/
�?  �?  └── [id]/page.tsx       # 指标详情
�?  ├── batch/
�?  �?  └── [id]/page.tsx       # 批次详情
�?  ├── monitoring-live/page.tsx # 实时监控
�?  ├── vaccine-schedule/page.tsx # 疫苗计划
�?  ├── breeding-record/page.tsx # 繁育记录
�?  ├── feed-management/page.tsx # 饲料管理
�?  ├── environment-control/page.tsx # 环境控制
�?  └── health-monitoring/page.tsx # 健康监控
�?
├── (processing)/               # 生产加工路由�?
�?  ├── page.tsx                # 加工首页
�?  ├── reports/page.tsx        # 质检报告
�?  ├── quality/page.tsx        # 质量评定
�?  ├── photos/page.tsx         # 加工拍照
�?  ├── detail/
�?  �?  └── [id]/page.tsx       # 生产详情
�?  ├── quality-test/
�?  �?  └── [id]/page.tsx       # 质检详情
�?  ├── photo-gallery/
�?  �?  └── [batch]/page.tsx    # 图片画廊
�?  ├── batch-processing/
�?  �?  └── [id]/page.tsx       # 批次加工
�?  ├── equipment-status/page.tsx # 设备状�?
�?  ├── production-schedule/page.tsx # 生产计划
�?  ├── safety-check/page.tsx   # 安全检�?
�?  ├── temperature-log/page.tsx # 温度记录
�?  ├── packaging-info/page.tsx # 包装信息
�?  ├── shipping-prep/page.tsx  # 出货准备
�?  ├── quality-standards/page.tsx # 质量标准
�?  └── compliance-check/page.tsx # 合规检�?
�?
├── (logistics)/                # 物流路由�?
�?  ├── page.tsx                # 物流首页
�?  ├── tracking/page.tsx       # 配送跟�?
�?  ├── route-detail/
�?  �?  └── [id]/page.tsx       # 路线详情
�?  ├── delivery-tracking/
�?  �?  └── [id]/page.tsx       # 配送跟踪详�?
�?  └── warehouse-management/page.tsx # 仓储管理
�?
├── (profile)/                  # 用户中心路由�?
�?  ├── page.tsx                # 个人中心首页
�?  ├── settings/page.tsx       # 系统设置
�?  ├── help-center/page.tsx    # 帮助中心
�?  ├── edit/page.tsx           # 个人信息编辑
�?  ├── password/page.tsx       # 密码修改
�?  ├── notifications/page.tsx  # 通知设置
�?  ├── privacy/page.tsx        # 隐私设置
�?  ├── security/page.tsx       # 账户安全
�?  ├── data-export/page.tsx    # 数据导出
�?  ├── feedback/page.tsx       # 意见反馈
�?  └── about/page.tsx          # 关于页面
�?
├── (admin)/                    # 管理后台路由�?- PC端布局
�?  ├── dashboard/page.tsx      # 管理控制�?
�?  ├── users/page.tsx          # 用户管理
�?  ├── import/page.tsx         # 数据导入
�?  ├── logs/page.tsx           # 系统日志
�?  ├── template/page.tsx       # 模板配置�?
�?  ├── permissions/page.tsx    # 权限管理
�?  ├── config/page.tsx         # 系统配置
�?  ├── backup/page.tsx         # 备份恢复
�?  ├── audit/page.tsx          # 审计日志
�?  ├── performance/page.tsx    # 性能监控
�?  ├── alerts/page.tsx         # 告警管理
�?  ├── reports/page.tsx        # 报表生成�?
�?  ├── analytics/page.tsx      # 数据分析
�?  ├── maintenance/page.tsx    # 系统维护
�?  └── layout.tsx              # 管理后台专用布局
�?
├── preview/                    # 现代化预览系�?
�?  ├── page.tsx                # 主预览页�?
�?  ├── [category]/page.tsx     # 分类预览
�?  └── components/
�?      ├── InteractivePreview.tsx
�?      ├── PageGrid.tsx
�?      ├── UserFlowDemo.tsx
�?      └── PageRelationMap.tsx
�?
├── api/                        # API路由
�?  ├── trace/
�?  �?  ├── [id]/route.ts
�?  �?  └── route.ts
�?  ├── auth/route.ts
�?  └── admin/route.ts
�?
├── globals.css                 # 全局样式
├── layout.tsx                  # 根布局
├── page.tsx                    # 首页 (重定向到selector)
├── loading.tsx                 # 全局loading
├── error.tsx                   # 全局错误处理
└── not-found.tsx               # 404页面
```

### SSG/SSR策略设计
```typescript
// 静态页面生成配�?
const staticPages = [
  // P0核心页面 - SSG预渲�?
  { route: 'auth/login', type: 'SSG' },
  { route: 'home/selector', type: 'SSG' },
  { route: 'trace/query', type: 'SSG' },
  { route: 'trace/list', type: 'SSG' },
  
  // P1业务模块 - 混合策略
  { route: 'farming/monitor', type: 'SSG' },
  { route: 'processing/reports', type: 'SSG' },
  { route: 'logistics/tracking', type: 'SSG' },
  
  // P2管理页面 - SSR动态渲�?
  { route: 'profile/*', type: 'SSR' },
  { route: 'admin/*', type: 'SSR' }
];

// 动态路由参数生�?
export async function generateStaticParams() {
  // 预生成常用的溯源记录
  const traceIds = ['TR001', 'TR002', 'TR003'];
  const batchIds = ['B001', 'B002', 'B003'];
  
  return [
    ...traceIds.map(id => ({ route: 'trace/detail', id })),
    ...traceIds.map(id => ({ route: 'trace/certificate', id })),
    ...batchIds.map(id => ({ route: 'farming/batch', id })),
    ...batchIds.map(id => ({ route: 'processing/batch-processing', id }))
  ];
}

// 元数据生成策�?
export async function generateMetadata({ params }): Promise<Metadata> {
  const metaConfig = {
    'trace/detail': {
      title: `溯源详情 ${params.id} - 食品溯源系统`,
      description: `查看产品 ${params.id} 的完整溯源信息`,
      keywords: ['食品安全', '溯源查询', '产品信息']
    },
    'farming/monitor': {
      title: '养殖监控 - 智能农业管理平台',
      description: '实时监控养殖环境和动物健康状�?,
      keywords: ['智能养殖', '环境监控', '健康管理']
    },
    'processing/reports': {
      title: '质检报告 - 生产加工管理',
      description: '查看生产加工过程的质量检测报�?,
      keywords: ['质量检�?, '生产管理', '食品安全']
    }
  };
  
  return metaConfig[params.route] || defaultMeta;
}
```

## 🧩 组件化重构策�?**【基于已完成组件库�?*

### 使用已完成的15个现代化组件
```typescript
// 基于TASK-P3-015已完成的组件�?
import { 
  // 核心UI组件 (5�?
  Button, Card, Modal, Loading, Badge,
  
  // 表单组件 (3�?  
  Input, Select, Textarea,
  
  // 数据展示组件 (3�?
  Table, StatCard, ProgressBar,
  
  // 导航组件 (2�?
  MobileNav, BottomTabBar,
  
  // 布局组件 (2�?
  PageLayout, FluidContainer
} from '@/components/ui';

// 页面组件化模�?
interface PageComponentProps {
  title: string;
  metadata?: PageMetadata;
  jumpTargets?: PageJumpTarget[];
  deviceMode?: 'mobile' | 'desktop' | 'both';
}

// 通用页面组件结构
export default function TracePage({ 
  title, 
  metadata, 
  jumpTargets,
  deviceMode = 'mobile' 
}: PageComponentProps) {
  return (
    <PageLayout 
      title={title}
      className="flex flex-col min-h-screen max-w-[390px] mx-auto"
      showBackButton={true}
      jumpTargets={jumpTargets}
    >
      {/* 固定顶部导航 */}
      <MobileNav 
        title={title}
        showBackButton={true}
        rightActions={[
          { icon: 'bell', action: () => router.push('/notifications') },
          { icon: 'settings', action: () => router.push('/settings') }
        ]}
      />
      
      {/* 主要内容区域 */}
      <main className="flex-1 pt-[80px] pb-[80px]">
        <FluidContainer>
          {/* 页面具体内容 */}
          <Card className="bg-white rounded-lg shadow-sm p-4">
            {/* 使用现代化组件构建页面内�?*/}
          </Card>
        </FluidContainer>
      </main>
      
      {/* 底部导航 (适用页面) */}
      <BottomTabBar 
        tabs={[
          { id: 'home', label: '首页', icon: 'home', href: '/home/selector' },
          { id: 'trace', label: '溯源', icon: 'search', href: '/trace/query' },
          { id: 'profile', label: '我的', icon: 'user', href: '/profile' }
        ]}
        activeTab="trace"
      />
    </PageLayout>
  );
}
```

### 页面类型模板设计
```typescript
// 1. 列表页面模板
export function ListPageTemplate<T>({ 
  items, 
  onItemClick, 
  onScan, 
  onCreate 
}: ListPageProps<T>) {
  return (
    <PageLayout title="溯源列表">
      <div className="space-y-4">
        {/* 操作按钮区域 */}
        <div className="flex gap-2">
          <Button onClick={onScan} variant="outline">
            <Icon name="qr-code" />
            扫码查询
          </Button>
          <Button onClick={onCreate} variant="primary">
            <Icon name="plus" />
            新建记录
          </Button>
        </div>
        
        {/* 列表内容 */}
        <Table 
          data={items}
          columns={columns}
          onRowClick={onItemClick}
          className="trace-list-table"
        />
      </div>
    </PageLayout>
  );
}

// 2. 详情页面模板
export function DetailPageTemplate({ 
  data, 
  tabs, 
  onEdit, 
  onCertificate 
}: DetailPageProps) {
  return (
    <PageLayout title="溯源详情">
      <div className="space-y-4">
        {/* 基本信息卡片 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <StatCard 
            title="产品信息"
            value={data.productName}
            subtitle={data.traceCode}
            icon="package"
          />
        </Card>
        
        {/* 标签页内�?*/}
        <TabsContainer tabs={tabs} />
        
        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button onClick={onEdit} variant="outline">编辑</Button>
          <Button onClick={onCertificate} variant="primary">查看证书</Button>
        </div>
      </div>
    </PageLayout>
  );
}

// 3. 表单页面模板
export function FormPageTemplate({ 
  fields, 
  onSubmit, 
  onCancel,
  mode = 'create'
}: FormPageProps) {
  return (
    <PageLayout title={mode === 'create' ? '新建记录' : '编辑记录'}>
      <form onSubmit={onSubmit} className="space-y-4">
        {fields.map(field => (
          <div key={field.name}>
            {field.type === 'input' && (
              <Input 
                label={field.label}
                name={field.name}
                required={field.required}
                placeholder={field.placeholder}
              />
            )}
            {field.type === 'select' && (
              <Select 
                label={field.label}
                name={field.name}
                options={field.options}
                required={field.required}
              />
            )}
            {field.type === 'textarea' && (
              <Textarea 
                label={field.label}
                name={field.name}
                rows={field.rows}
                placeholder={field.placeholder}
              />
            )}
          </div>
        ))}
        
        <div className="flex gap-2">
          <Button type="button" onClick={onCancel} variant="outline">
            取消
          </Button>
          <Button type="submit" variant="primary">
            {mode === 'create' ? '创建' : '保存'}
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
```

## 🖼�?现代化预览系统架�?**【核心亮点�?*

### 交互式预览系统设�?
```typescript
// 预览系统核心组件架构
interface PreviewSystemProps {
  pages: PageNode[];
  mode: PreviewMode;
  deviceMode: DeviceMode;
}

type PreviewMode = 
  | 'grid'           // 网格展示所�?4个页�?
  | 'navigation'     // 交互式导航演�? 
  | 'flow'           // 用户流程演示
  | 'hierarchy'      // 层级结构展示
  | 'sitemap';       // 站点地图模式

type DeviceMode = 'mobile' | 'desktop' | 'tablet';

interface PageNode {
  id: string;
  title: string;
  path: string;
  category: 'auth' | 'home' | 'trace' | 'farming' | 'processing' | 'logistics' | 'profile' | 'admin';
  level: 'primary' | 'secondary' | 'tertiary';
  children?: PageNode[];
  parentId?: string;
  jumpTargets?: PageJumpTarget[];
  deviceMode: DeviceMode[];
  fileSize: string;
  lineCount: number;
  description: string;
}

// 主预览组�?
export function InteractivePagePreview({ 
  pages, 
  mode = 'grid',
  deviceMode = 'mobile'
}: PreviewSystemProps) {
  const [currentPage, setCurrentPage] = useState<PageNode | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(mode);
  const [selectedDevice, setSelectedDevice] = useState<DeviceMode>(deviceMode);
  const [flowDemo, setFlowDemo] = useState<boolean>(false);
  
  return (
    <div className="preview-system-container">
      {/* 预览控制�?*/}
      <PreviewControls 
        mode={previewMode} 
        onModeChange={setPreviewMode}
        deviceMode={selectedDevice}
        onDeviceChange={setSelectedDevice}
        onFlowDemo={() => setFlowDemo(true)}
      />
      
      {/* 主预览区�?*/}
      <div className="preview-main-area">
        {previewMode === 'grid' && (
          <PageGrid 
            pages={pages} 
            deviceMode={selectedDevice}
            onPageSelect={setCurrentPage}
            showJumpTargets={true}
          />
        )}
        
        {previewMode === 'navigation' && (
          <NavigationDemo 
            pages={pages}
            onPageSelect={setCurrentPage}
            showJumpPaths={true}
          />
        )}
        
        {previewMode === 'flow' && (
          <UserFlowDemo 
            pages={pages}
            autoPlay={flowDemo}
            onPageSelect={setCurrentPage}
          />
        )}
        
        {previewMode === 'hierarchy' && (
          <HierarchyView 
            pages={pages}
            onPageSelect={setCurrentPage}
          />
        )}
        
        {previewMode === 'sitemap' && (
          <SitemapView 
            pages={pages}
            showRelations={true}
            onPageSelect={setCurrentPage}
          />
        )}
      </div>
      
      {/* 页面详情面板 */}
      {currentPage && (
        <PageDetailPanel 
          page={currentPage}
          deviceMode={selectedDevice}
          onClose={() => setCurrentPage(null)}
        />
      )}
    </div>
  );
}

// 页面网格展示组件
export function PageGrid({ 
  pages, 
  deviceMode, 
  onPageSelect,
  showJumpTargets 
}: PageGridProps) {
  const groupedPages = groupPagesByCategory(pages);
  
  return (
    <div className="page-grid">
      {Object.entries(groupedPages).map(([category, categoryPages]) => (
        <div key={category} className="category-section">
          <h3 className="category-title">{getCategoryName(category)}</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categoryPages.map(page => (
              <PageCard 
                key={page.id}
                page={page}
                deviceMode={deviceMode}
                onClick={() => onPageSelect(page)}
                showJumpTargets={showJumpTargets}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// 用户流程演示组件
export function UserFlowDemo({ 
  pages, 
  autoPlay, 
  onPageSelect 
}: UserFlowDemoProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  
  const userFlows = [
    {
      name: '用户登录到溯源查询流�?,
      steps: [
        { pageId: 'auth/login', action: '输入用户名密�? },
        { pageId: 'home/selector', action: '选择溯源查询模块' },
        { pageId: 'trace/query', action: '输入产品码或扫描二维�? },
        { pageId: 'trace/detail', action: '查看溯源详情' },
        { pageId: 'trace/certificate', action: '查看溯源证书' }
      ]
    },
    {
      name: '养殖管理完整流程',
      steps: [
        { pageId: 'farming/monitor', action: '查看养殖监控' },
        { pageId: 'farming/batch/B001', action: '选择批次详情' },
        { pageId: 'farming/vaccine', action: '记录疫苗接种' },
        { pageId: 'farming/health-monitoring', action: '健康状态检�? },
        { pageId: 'create-trace', action: '创建溯源记录' }
      ]
    },
    {
      name: '管理员后台操作流�?,
      steps: [
        { pageId: 'admin/login', action: '管理员登�? },
        { pageId: 'admin/dashboard', action: '查看控制�? },
        { pageId: 'admin/users', action: '管理用户权限' },
        { pageId: 'admin/import', action: '批量导入数据' },
        { pageId: 'admin/logs', action: '查看系统日志' }
      ]
    }
  ];
  
  return (
    <div className="user-flow-demo">
      <FlowControls 
        flows={userFlows}
        currentStep={currentStep}
        isPlaying={isPlaying}
        onStepChange={setCurrentStep}
        onPlayToggle={() => setIsPlaying(!isPlaying)}
      />
      
      <FlowVisualization 
        flow={userFlows[0]}
        currentStep={currentStep}
        onPageSelect={onPageSelect}
      />
    </div>
  );
}
```

### 页面关系可视化组�?
```typescript
// 页面关系图组�?
export function PageRelationMap({ pages }: { pages: PageNode[] }) {
  const relationData = buildRelationGraph(pages);
  
  return (
    <div className="relation-map">
      <svg width="100%" height="600" className="relation-svg">
        {/* 页面节点 */}
        {relationData.nodes.map(node => (
          <g key={node.id} className="page-node">
            <circle 
              cx={node.x} 
              cy={node.y} 
              r={node.level === 'primary' ? 15 : 10}
              className={`node-${node.category}`}
            />
            <text 
              x={node.x} 
              y={node.y + 25} 
              className="node-label"
              textAnchor="middle"
            >
              {node.title}
            </text>
          </g>
        ))}
        
        {/* 跳转关系连线 */}
        {relationData.edges.map(edge => (
          <line 
            key={`${edge.from}-${edge.to}`}
            x1={edge.x1} 
            y1={edge.y1}
            x2={edge.x2} 
            y2={edge.y2}
            className={`edge-${edge.type}`}
            markerEnd="url(#arrowhead)"
          />
        ))}
        
        {/* 箭头标记 */}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                  refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
```

## �?验收标准

### 架构设计完整�?**🔥 关键**
- [ ] 完成84个页面的详细分析和分�?
- [ ] 建立完整的页面跳转关系映射表
- [ ] 设计Next.js App Router目录结构
- [ ] 制定组件化重构策�?
- [ ] 完成现代化预览系统架构设�?

### 技术方案可执行�?**【Phase-3标准�?*
- [ ] TypeScript类型系统设计完整
- [ ] SSG/SSR策略配置明确
- [ ] 组件模板可复用性强
- [ ] 性能优化方案具体可行

### 文档交付完整�?
- [ ] 页面跳转关系图可视化
- [ ] 技术架构文档详�?
- [ ] 组件化模板代码示�?
- [ ] 预览系统设计规范

## 📝 变更记录

| 日期 | 变更类型 | 文件路径 | 说明 | 状�?|
|------|---------|---------|------|------|
| 2025-01-15 | 任务创建 | TASK-P3-020_静态页面现代化迁移架构设计.md | 创建架构设计任务 | �?|
| 2025-01-15 | 深度分析 | - | 完成84个页面完整结构分�?| �?|
| 2025-01-15 | 技术设�?| - | 完成Next.js路由架构和组件化策略设计 | �?|

## 🔗 相关资源

- [TASK-P3-015现代化组件库](./TASK-P3-015_现代化组件库迁移.md) �?已完�?
- [Phase-3工作计划](../PHASE-3-COMPREHENSIVE-PLAN.md)
- [组件迁移指导](../docs/COMPONENT-MIGRATION-GUIDE.md)

---

**任务状�?*: 📝 规划�? 
**预计完成**: 2个工作日  
**技术栈**: Next.js 14 + TypeScript 5 + 现代化组件库 
