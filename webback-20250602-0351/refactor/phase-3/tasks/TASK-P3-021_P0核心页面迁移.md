# TASK-P3-021: P0核心页面迁移

**任务ID**: TASK-P3-021  
**任务类型**: 🔧 页面实施  
**优先�?*: P0 (最�?  
**预估工期**: 3�? 
**状�?*: 📝 等待开�? 
**创建日期**: 2025-01-15  
**最后更�?*: 2025-01-15  
**依赖任务**: TASK-P3-020 (架构设计) 📝 规划�?

<!-- updated for: P0核心业务流程页面迁移，确保关键用户路径正常工�?-->

## 📋 任务概述

基于TASK-P3-020的架构设计，实施**P0核心页面**(7主页�?15二级页面)的Next.js迁移。重点保证核心用户流程：**登录→功能选择→溯源查询→详情查看→证书展�?*的完整可用性�?

### 🎯 核心目标

1. **认证系统迁移**: 登录页面+管理员登�?
2. **导航枢纽实现**: 功能选择�?模块跳转
3. **溯源查询链路**: 查询→列表→详情→证书的完整流程
4. **多标签页实现**: 详情页面内部标签导航
5. **跳转关系保留**: 所有核心页面跳转逻辑正确

## 📊 P0页面详细清单 **�?2个页面�?*

### 🔐 认证系统模块 (2主页�?+ 2二级页面) = 4页面

#### 主页�?
- [ ] **pages/auth/login.html** �?`/auth/login`
  - 📏 规模: 705�? 26KB
  - 🎯 功能: 用户名密码登录、记住登录状�?
  - 🔗 跳转: 成功→home-selector.html, 忘记密码→reset-password
  - 📱 设备: 移动端优�?+ PC端适配

- [ ] **pages/admin/auth/login.html** �?`/auth/admin/login`
  - 📏 规模: 估计500�?
  - 🎯 功能: 管理员登录、权限验�?
  - 🔗 跳转: 成功→admin-dashboard.html
  - 💻 设备: PC端布局优先

#### 二级页面 (需补充创建)
- [ ] **reset-password** �?`/auth/reset-password`
  - 🎯 功能: 密码重置、邮箱验�?
  - 🔗 跳转: 完成→login.html

- [ ] **register** �?`/auth/register`
  - 🎯 功能: 用户注册、邮箱验�?
  - 🔗 跳转: 完成→login.html

### 🏠 导航枢纽模块 (1主页�?+ 3二级页面) = 4页面

#### 主页�?
- [ ] **pages/home/home-selector.html** �?`/dashboard/selector`
  - 📏 规模: 883�? 34KB �?最大页�?
  - 🎯 功能: 功能模块选择器、快速入�?
  - 🔗 跳转: 养殖→farming/monitor, 溯源→trace/query, 我的→profile
  - 📱 设备: 移动端优先，网格布局

#### 二级页面
- [ ] **home-farming** �?`/farming/page`
  - 🎯 功能: 养殖管理首页导航
  - 🔗 跳转: 监控→farming/monitor, 疫苗→farming/vaccine

- [ ] **home-processing** �?`/processing/page`
  - 🎯 功能: 生产加工首页导航
  - 🔗 跳转: 报告→processing/reports, 质量→processing/quality

- [ ] **home-logistics** �?`/logistics/page`
  - 🎯 功能: 销售物流首页导�?
  - 🔗 跳转: 跟踪→logistics/tracking, 地图→trace/map

### 🔍 溯源查询系统 (5主页�?+ 10二级页面) = 15页面

#### 主页�?
- [ ] **pages/product-trace.html** �?`/trace/page`
  - 📏 规模: 740�? 21KB
  - 🎯 功能: 产品溯源查询主页、快速查询入�?
  - 🔗 跳转: 查询→trace/query, 详情→trace/detail

- [ ] **pages/trace/trace-query.html** �?`/trace/query`
  - 📏 规模: 523�? 25KB
  - 🎯 功能: 溯源码输入、二维码扫描、历史查�?
  - 🔗 跳转: 结果→trace/detail?id={id}, 历史→trace/list

- [ ] **pages/trace/trace-list.html** �?`/trace/list`
  - 📏 规模: 470�? 22KB
  - 🎯 功能: 溯源记录列表、搜索过�?
  - 🔗 跳转: 详情→trace/detail/{id}, 新建→trace/edit?mode=new

- [ ] **pages/trace/trace-detail.html** �?`/trace/detail/[id]`
  - 📏 规模: 572�? 34KB �?复杂页面
  - 🎯 功能: 多标签详情页面（基本信息、溯源流程、证书检测）
  - 🔗 跳转: 证书→trace/certificate/{id}, 编辑→trace/edit/{id}
  - 🎛�?特殊: 内部标签页导�?

- [ ] **pages/trace/trace-certificate.html** �?`/trace/certificate/[id]`
  - 📏 规模: 343�? 15KB
  - 🎯 功能: 溯源证书展示、PDF导出
  - 🔗 跳转: 返回→trace/detail/{id}

#### 二级页面 (溯源查询扩展功能)
- [ ] **trace/scan-result** �?`/trace/scan/[code]`
  - 🎯 功能: 扫码结果页面、快速预�?

- [ ] **trace/search-history** �?`/trace/history`
  - 🎯 功能: 查询历史记录、收藏管�?

- [ ] **trace/map** �?`/trace/map`
  - 📏 基于: trace-map.html
  - 🎯 功能: 地理位置可视化、路径追�?

- [ ] **trace/batch-info** �?`/trace/batch/[id]`
  - 🎯 功能: 批次信息详情页面

- [ ] **trace/quality-report** �?`/trace/quality/[id]`
  - 🎯 功能: 质量检测报告详�?

- [ ] **trace/photo-gallery** �?`/trace/photos/[id]`
  - 🎯 功能: 图片展示画廊、放大查�?

- [ ] **trace/process-timeline** �?`/trace/timeline/[id]`
  - 🎯 功能: 生产过程时间轴展�?

- [ ] **trace/temperature-log** �?`/trace/temperature/[id]`
  - 🎯 功能: 温度监控记录图表

- [ ] **trace/nutrition-info** �?`/trace/nutrition/[id]`
  - 🎯 功能: 营养成分信息展示

- [ ] **trace/compliance-check** �?`/trace/compliance/[id]`
  - 🎯 功能: 合规性检查结�?

## 🚀 实施计划 **�?天详细安排�?*

### Day 1: 认证系统 + 导航枢纽 (8页面)

#### 上午 (4小时): 认证系统
- [ ] 创建 `/auth/login` 页面
  - 表单组件：用户名、密码输�?
  - 登录逻辑：API集成、状态管�?
  - 记住登录状态功�?
  - 错误处理和提�?

- [ ] 创建 `/auth/admin/login` 页面
  - PC端布局优化
  - 管理员权限验�?
  - 重定向到admin-dashboard

- [ ] 补充认证相关页面
  - `/auth/reset-password` 密码重置
  - `/auth/register` 用户注册

#### 下午 (4小时): 导航枢纽
- [ ] 创建 `/dashboard/selector` 功能选择�?
  - 网格布局�?个主要模�?
  - 快速统计卡片：待处理任务数�?
  - 底部导航栏：首页、溯源、我�?
  - 跳转逻辑：各模块入口

- [ ] 创建模块首页
  - `/farming/page` 养殖管理首页
  - `/processing/page` 生产加工首页  
  - `/logistics/page` 销售物流首�?

#### 晚上测试验证
- [ ] 认证流程测试：登录→功能选择�?
- [ ] 导航跳转测试：模块间切换

### Day 2: 溯源查询核心流程 (10页面)

#### 上午 (4小时): 查询入口页面
- [ ] 创建 `/trace/page` 溯源主页
  - 快速查询入�?
  - 热门产品展示
  - 最近查询历�?

- [ ] 创建 `/trace/query` 查询页面
  - 输入框：溯源码手动输�?
  - 扫码功能：调用相机API
  - 查询历史：最近查询记�?
  - 查询结果处理：跳转到详情�?

- [ ] 创建 `/trace/list` 列表页面
  - 表格展示：使用Table组件
  - 搜索过滤：产品名称、时间范�?
  - 分页功能：数据分页加�?
  - 操作按钮：查看详情、新建记�?

#### 下午 (4小时): 详情展示页面
- [ ] 创建 `/trace/detail/[id]` 详情页面 �?重点
  - 多标签页实现：基本信息、溯源流程、证书检�?
  - 数据获取：API调用、动态路由参�?
  - 交互功能：标签切换、按钮操�?
  - 跳转逻辑：证书查看、编辑记�?

- [ ] 创建 `/trace/certificate/[id]` 证书页面
  - 证书展示：专业格式布局
  - PDF生成：导出功�?
  - 分享功能：链接分享、二维码生成

#### 晚上 (2小时): 扩展功能页面
- [ ] 创建溯源相关二级页面
  - `/trace/map` 地图视图
  - `/trace/history` 查询历史
  - `/trace/scan/[code]` 扫码结果

### Day 3: 深度功能完善 + 集成测试 (7页面)

#### 上午 (4小时): 深度功能页面
- [ ] 创建详细信息页面
  - `/trace/batch/[id]` 批次信息
  - `/trace/quality/[id]` 质量报告
  - `/trace/photos/[id]` 图片画廊
  - `/trace/timeline/[id]` 过程时间�?

#### 下午 (2小时): 监控数据页面
- [ ] 创建监控展示页面
  - `/trace/temperature/[id]` 温度记录
  - `/trace/nutrition/[id]` 营养信息
  - `/trace/compliance/[id]` 合规检�?

#### 下午 (2小时): 集成测试
- [ ] 完整用户流程测试
  - 登录 �?功能选择 �?溯源查询 �?查看详情 �?证书展示
  - 扫码功能测试
  - 跳转关系验证
  - 移动端响应式测试

## 🧩 技术实施细�?**【基于架构设计�?*

### 页面组件结构
```typescript
// 认证页面实现
export default function LoginPage() {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const router = useRouter();
  
  return (
    <PageLayout title="登录" showBackButton={false}>
      <div className="flex flex-col min-h-screen justify-center px-4">
        <Card className="bg-white rounded-lg shadow-sm p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <Input 
              label="用户�?
              name="username"
              value={credentials.username}
              onChange={(e) => setCredentials({...credentials, username: e.target.value})}
              required
            />
            <Input 
              label="密码"
              name="password"
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({...credentials, password: e.target.value})}
              required
            />
            <Button type="submit" className="w-full" variant="primary">
              登录
            </Button>
          </form>
        </Card>
      </div>
    </PageLayout>
  );
}

// 功能选择器实�?
export default function SelectorPage() {
  const modules = [
    { id: 'farming', title: '养殖管理', icon: 'farm', href: '/farming' },
    { id: 'processing', title: '生产加工', icon: 'factory', href: '/processing' },
    { id: 'logistics', title: '销售物�?, icon: 'truck', href: '/logistics' },
    { id: 'trace', title: '产品溯源', icon: 'search', href: '/trace/query' }
  ];
  
  return (
    <PageLayout title="功能选择">
      <MobileNav title="食品溯源系统" showBackButton={false} />
      
      <main className="pt-[80px] pb-[80px]">
        {/* 欢迎卡片 */}
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 mx-4 mb-6">
          <h2 className="text-xl font-medium">你好，张�?/h2>
          <p className="text-blue-100">今天是早班，系统运行正常</p>
        </Card>
        
        {/* 快速统�?*/}
        <div className="grid grid-cols-2 gap-4 mx-4 mb-6">
          <StatCard title="待处�? value="12" subtitle="项任�? />
          <StatCard title="今日查询" value="86" subtitle="次溯�? />
        </div>
        
        {/* 功能模块 */}
        <div className="grid grid-cols-2 gap-4 mx-4">
          {modules.map(module => (
            <Card 
              key={module.id}
              className="p-6 text-center cursor-pointer hover:shadow-md"
              onClick={() => router.push(module.href)}
            >
              <Icon name={module.icon} className="w-12 h-12 mx-auto mb-2" />
              <h3 className="font-medium">{module.title}</h3>
            </Card>
          ))}
        </div>
      </main>
      
      <BottomTabBar activeTab="home" />
    </PageLayout>
  );
}

// 溯源详情页面实现
export default function TraceDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('info');
  const [traceData, setTraceData] = useState(null);
  
  const tabs = [
    { id: 'info', label: '基本信息' },
    { id: 'process', label: '溯源流程' },
    { id: 'certificate', label: '证书检�? }
  ];
  
  return (
    <PageLayout title="溯源详情">
      <MobileNav 
        title="溯源详情" 
        showBackButton={true}
        rightActions={[
          { icon: 'edit', action: () => router.push(`/trace/edit/${params.id}`) },
          { icon: 'share', action: handleShare }
        ]}
      />
      
      <main className="pt-[80px] pb-[80px]">
        {/* 产品基本信息卡片 */}
        <Card className="mx-4 mb-4 p-4">
          <div className="flex items-center space-x-4">
            <img src={traceData?.photo} className="w-16 h-16 rounded" />
            <div>
              <h2 className="text-lg font-medium">{traceData?.productName}</h2>
              <p className="text-gray-600">{traceData?.traceCode}</p>
              <Badge variant="success">已认�?/Badge>
            </div>
          </div>
        </Card>
        
        {/* 标签页导�?*/}
        <div className="bg-white border-b">
          <div className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`flex-1 py-3 text-center ${
                  activeTab === tab.id 
                    ? 'text-blue-500 border-b-2 border-blue-500' 
                    : 'text-gray-600'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* 标签页内�?*/}
        <div className="p-4">
          {activeTab === 'info' && <BasicInfoTab data={traceData} />}
          {activeTab === 'process' && <ProcessTimelineTab data={traceData} />}
          {activeTab === 'certificate' && <CertificateTab data={traceData} />}
        </div>
        
        {/* 操作按钮 */}
        <div className="fixed bottom-[80px] left-0 right-0 p-4 bg-white border-t">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => router.push(`/trace/edit/${params.id}`)}
            >
              编辑
            </Button>
            <Button 
              variant="primary" 
              onClick={() => router.push(`/trace/certificate/${params.id}`)}
            >
              查看证书
            </Button>
          </div>
        </div>
      </main>
      
      <BottomTabBar activeTab="trace" />
    </PageLayout>
  );
}
```

### 路由配置和类型定�?
```typescript
// 路由类型定义
interface TraceParams {
  id: string;
  code?: string;
  source?: 'scan' | 'search' | 'list';
}

interface PageMetadata {
  title: string;
  description: string;
  keywords: string[];
}

// API数据获取
export async function getTraceDetail(id: string) {
  const response = await fetch(`/api/trace/${id}`);
  return response.json();
}

// 页面跳转逻辑
export const usePageNavigation = () => {
  const router = useRouter();
  
  const jumpToDetail = (id: string, source?: string) => {
    const url = source ? `/trace/detail/${id}?source=${source}` : `/trace/detail/${id}`;
    router.push(url);
  };
  
  const jumpToCertificate = (id: string) => {
    router.push(`/trace/certificate/${id}`);
  };
  
  return { jumpToDetail, jumpToCertificate };
};
```

## �?验收标准

### 功能完整性验�?**🔥 关键**
- [ ] 所�?2个P0页面成功创建并可访问
- [ ] 核心用户流程完全可用：登录→选择→查询→详情→证�?
- [ ] 页面跳转关系100%正确
- [ ] 扫码功能正常工作
- [ ] 多标签页交互正常

### 技术合规性验�?**【Phase-3标准�?*
- [ ] TypeScript编译0错误
- [ ] 使用现代化组件库(TASK-P3-015)
- [ ] Neo Minimal iOS-Style设计100%合规
- [ ] 移动端响应式布局正常

### 性能验收标准
- [ ] 页面首屏加载<2�?
- [ ] 页面跳转响应<300ms
- [ ] 图片懒加载正�?
- [ ] API请求错误处理完善

## 📝 变更记录

| 日期 | 变更类型 | 文件路径 | 说明 | 状�?|
|------|---------|---------|------|------|
| 2025-01-15 | 任务创建 | TASK-P3-021_P0核心页面迁移.md | 创建P0核心页面迁移任务 | �?|

## 🔗 相关资源

- [TASK-P3-020架构设计](./TASK-P3-020_静态页面现代化迁移架构设计.md) 📝 依赖
- [TASK-P3-015现代化组件库](./TASK-P3-015_现代化组件库迁移.md) �?已完�?
- [Phase-3工作计划](../PHASE-3-COMPREHENSIVE-PLAN.md)

---

**任务状�?*: 📝 等待开�? 
**预计完成**: 3个工作日  
**技术栈**: Next.js 14 + TypeScript 5 + 现代化组件库 
