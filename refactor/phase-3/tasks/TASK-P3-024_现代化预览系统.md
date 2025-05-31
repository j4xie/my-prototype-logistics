# TASK-P3-024: 现代化预览系统

**任务ID**: TASK-P3-024  
**任务类型**: 🖼️ 预览系统  
**优先级**: P1 (高)  
**预估工期**: 3天  
**状态**: 📝 等待开始  
**创建日期**: 2025-01-15  
**最后更新**: 2025-01-15  
**依赖任务**: TASK-P3-023 (P2管理页面) 📝 等待开始

<!-- updated for: 现代化预览系统开发，交互式页面预览平台建设 -->

## 📋 任务概述

基于原始`index.html`的iframe预览架构，开发现代化的交互式页面预览系统。支持**84个页面**的多种预览模式、用户流程演示、页面跳转关系可视化，并提供移动端、PC端、平板端的预览体验。

### 🎯 核心目标

1. **交互式预览平台**: 升级iframe静态预览为现代化交互系统
2. **多预览模式支持**: Grid、Navigation、Flow、Hierarchy、Sitemap五种模式
3. **用户流程演示**: 自动化用户操作路径演示功能
4. **设备适配预览**: 移动端、PC端、平板端三种设备模式
5. **页面关系可视化**: 页面跳转关系图谱展示

## 📊 现代化预览系统架构 **【基于原始index.html升级】**

### 🔍 原始系统分析
```html
<!-- 原始 index.html 架构优势 -->
<div class="page-preview-grid">
  <!-- 科学的页面分类展示 -->
  <div class="category-section">
    <h3>认证系统</h3>
    <iframe src="pages/auth/login.html"></iframe>
  </div>
  
  <!-- 设备切换功能 -->
  <div class="device-switcher">
    <button onclick="switchDevice('mobile')">移动端</button>
    <button onclick="switchDevice('desktop')">PC端</button>
  </div>
</div>
```

### 🚀 现代化升级架构
```typescript
// 现代化预览系统类型定义
interface PreviewMode {
  id: 'grid' | 'navigation' | 'flow' | 'hierarchy' | 'sitemap';
  name: string;
  description: string;
  component: React.ComponentType<PreviewModeProps>;
}

interface PageItem {
  id: string;
  title: string;
  category: 'P0' | 'P1' | 'P2';
  module: string;
  route: string;
  jumpTargets: string[];
  deviceOptimized: 'mobile' | 'desktop' | 'both';
  complexity: 'simple' | 'complex' | 'advanced';
}

interface UserFlow {
  id: string;
  name: string;
  description: string;
  steps: Array<{
    pageId: string;
    action: string;
    target?: string;
    duration: number;
  }>;
}
```

## 🎨 五种预览模式设计 **【现代化核心功能】**

### 1. 📋 Grid模式 (网格预览) - 默认模式
```typescript
// Grid预览模式 - 继承原始index.html优势
export default function GridPreviewMode() {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'P0' | 'P1' | 'P2'>('all');
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'desktop' | 'tablet'>('mobile');
  
  return (
    <div className="grid-preview-mode">
      {/* 设备切换器 */}
      <DeviceSwitcher mode={deviceMode} onChange={setDeviceMode} />
      
      {/* 分类过滤器 */}
      <CategoryFilter selected={selectedCategory} onChange={setSelectedCategory} />
      
      {/* 页面网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
        {filteredPages.map(page => (
          <PagePreviewCard
            key={page.id}
            page={page}
            deviceMode={deviceMode}
            onNavigate={handlePageNavigate}
            onJumpTo={handleJumpTo}
          />
        ))}
      </div>
    </div>
  );
}

// 页面预览卡片
function PagePreviewCard({ page, deviceMode }: { page: PageItem, deviceMode: string }) {
  return (
    <Card className="page-preview-card group hover:shadow-lg transition-all">
      {/* 页面预览iframe */}
      <div className={`preview-frame ${deviceMode}-frame`}>
        <iframe 
          src={page.route}
          className="w-full h-full border-0 rounded-t-lg"
          title={page.title}
        />
      </div>
      
      {/* 页面信息 */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sm">{page.title}</h3>
          <Badge variant={page.category === 'P0' ? 'primary' : page.category === 'P1' ? 'secondary' : 'outline'}>
            {page.category}
          </Badge>
        </div>
        
        <p className="text-xs text-gray-600 mb-3">{page.module}</p>
        
        {/* 跳转关系 */}
        <div className="flex flex-wrap gap-1 mb-3">
          {page.jumpTargets.slice(0, 3).map(target => (
            <Badge key={target} variant="outline" className="text-xs cursor-pointer"
                   onClick={() => handleJumpTo(target)}>
              {target}
            </Badge>
          ))}
          {page.jumpTargets.length > 3 && (
            <Badge variant="outline" className="text-xs">+{page.jumpTargets.length - 3}</Badge>
          )}
        </div>
        
        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => handlePageNavigate(page.route)}>
            访问
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleShowJumpMap(page.id)}>
            跳转图
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

### 2. 🧭 Navigation模式 (导航预览)
```typescript
// Navigation预览模式 - 模拟用户导航体验
export default function NavigationPreviewMode() {
  const [currentPage, setCurrentPage] = useState('login');
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['login']);
  
  return (
    <div className="navigation-preview-mode flex h-screen">
      {/* 导航侧边栏 */}
      <aside className="w-80 bg-white border-r overflow-y-auto">
        <NavigationSidebar 
          currentPage={currentPage}
          onNavigate={handleNavigate}
          history={navigationHistory}
        />
      </aside>
      
      {/* 主预览区域 */}
      <main className="flex-1 flex flex-col">
        {/* 面包屑导航 */}
        <div className="p-4 border-b bg-gray-50">
          <Breadcrumb history={navigationHistory} onNavigate={handleNavigate} />
        </div>
        
        {/* 页面预览框架 */}
        <div className="flex-1 p-4">
          <div className="device-frame mobile-frame mx-auto">
            <iframe 
              src={pages.find(p => p.id === currentPage)?.route}
              className="w-full h-full border-0 rounded-lg"
              onLoad={handlePageLoad}
            />
          </div>
        </div>
        
        {/* 页面信息栏 */}
        <div className="p-4 border-t bg-gray-50">
          <PageInfoBar currentPage={currentPage} />
        </div>
      </main>
    </div>
  );
}
```

### 3. 🌊 Flow模式 (流程预览)
```typescript
// Flow预览模式 - 用户流程可视化
export default function FlowPreviewMode() {
  const [selectedFlow, setSelectedFlow] = useState<UserFlow | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  const userFlows: UserFlow[] = [
    {
      id: 'core-trace-flow',
      name: '核心溯源流程',
      description: '登录 → 功能选择 → 溯源查询 → 查看详情 → 证书展示',
      steps: [
        { pageId: 'login', action: '用户登录', duration: 3000 },
        { pageId: 'home-selector', action: '选择溯源功能', target: 'trace-query', duration: 2000 },
        { pageId: 'trace-query', action: '输入溯源码查询', target: 'trace-detail', duration: 4000 },
        { pageId: 'trace-detail', action: '查看产品详情', target: 'trace-certificate', duration: 3000 },
        { pageId: 'trace-certificate', action: '查看溯源证书', duration: 2000 }
      ]
    },
    {
      id: 'farming-management-flow',
      name: '养殖管理流程',
      description: '登录 → 养殖管理 → 监控查看 → 疫苗管理 → 繁育记录',
      steps: [
        { pageId: 'login', action: '管理员登录', duration: 2000 },
        { pageId: 'home-selector', action: '选择养殖管理', target: 'farming-monitor', duration: 2000 },
        { pageId: 'farming-monitor', action: '查看监控数据', target: 'farming-vaccine', duration: 4000 },
        { pageId: 'farming-vaccine', action: '管理疫苗计划', target: 'farming-breeding', duration: 3000 },
        { pageId: 'farming-breeding', action: '记录繁育信息', duration: 3000 }
      ]
    }
  ];
  
  return (
    <div className="flow-preview-mode">
      {/* 流程选择器 */}
      <div className="p-6 border-b">
        <h2 className="text-xl font-medium mb-4">用户流程演示</h2>
        <div className="flex gap-4">
          {userFlows.map(flow => (
            <Card 
              key={flow.id}
              className={`p-4 cursor-pointer transition-all ${
                selectedFlow?.id === flow.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedFlow(flow)}
            >
              <h3 className="font-medium mb-2">{flow.name}</h3>
              <p className="text-sm text-gray-600">{flow.description}</p>
            </Card>
          ))}
        </div>
      </div>
      
      {selectedFlow && (
        <div className="flex-1 flex">
          {/* 流程控制面板 */}
          <aside className="w-80 bg-white border-r p-6">
            <FlowControlPanel 
              flow={selectedFlow}
              isPlaying={isPlaying}
              currentStep={currentStep}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onStep={setCurrentStep}
            />
          </aside>
          
          {/* 流程预览区域 */}
          <main className="flex-1 p-6">
            <FlowPreviewArea 
              flow={selectedFlow}
              currentStep={currentStep}
              isPlaying={isPlaying}
            />
          </main>
        </div>
      )}
    </div>
  );
}
```

### 4. 🌳 Hierarchy模式 (层级预览)
```typescript
// Hierarchy预览模式 - 页面层级关系展示
export default function HierarchyPreviewMode() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  
  const pageHierarchy = {
    root: {
      title: '食品溯源系统',
      children: ['auth', 'dashboard', 'trace', 'farming', 'processing', 'logistics', 'profile', 'admin']
    },
    auth: {
      title: '认证系统',
      children: ['login', 'admin-login', 'reset-password', 'register']
    },
    dashboard: {
      title: '功能选择器',
      children: ['home-selector', 'home-farming', 'home-processing', 'home-logistics']
    },
    trace: {
      title: '溯源查询系统',
      children: ['product-trace', 'trace-query', 'trace-list', 'trace-detail', 'trace-certificate']
    }
    // ... 其他模块
  };
  
  return (
    <div className="hierarchy-preview-mode flex h-screen">
      {/* 层级树 */}
      <aside className="w-96 bg-white border-r overflow-y-auto">
        <div className="p-4">
          <h2 className="text-lg font-medium mb-4">页面层级结构</h2>
          <HierarchyTree 
            hierarchy={pageHierarchy}
            expanded={expandedNodes}
            selected={selectedNode}
            onToggle={handleToggleNode}
            onSelect={setSelectedNode}
          />
        </div>
      </aside>
      
      {/* 预览区域 */}
      <main className="flex-1 flex flex-col">
        {selectedNode && (
          <>
            <div className="p-4 border-b">
              <PageHierarchyInfo nodeId={selectedNode} />
            </div>
            
            <div className="flex-1 p-4">
              <div className="device-frame mobile-frame mx-auto">
                <iframe 
                  src={getPageRoute(selectedNode)}
                  className="w-full h-full border-0 rounded-lg"
                />
              </div>
            </div>
            
            <div className="p-4 border-t">
              <RelatedPagesPanel nodeId={selectedNode} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
```

### 5. 🗺️ Sitemap模式 (站点地图)
```typescript
// Sitemap预览模式 - 站点地图可视化
export default function SitemapPreviewMode() {
  const [viewMode, setViewMode] = useState<'graph' | 'tree' | 'matrix'>('graph');
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  
  return (
    <div className="sitemap-preview-mode">
      {/* 工具栏 */}
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-xl font-medium">站点地图</h2>
        
        <div className="flex items-center gap-4">
          <ViewModeSelector mode={viewMode} onChange={setViewMode} />
          <ExportButton />
        </div>
      </div>
      
      {/* 地图视图 */}
      <div className="flex-1 relative">
        {viewMode === 'graph' && (
          <SitemapGraphView 
            pages={allPages}
            onNodeClick={handleNodeClick}
            onConnectionClick={setSelectedConnection}
          />
        )}
        
        {viewMode === 'tree' && (
          <SitemapTreeView 
            pages={allPages}
            onNodeClick={handleNodeClick}
          />
        )}
        
        {viewMode === 'matrix' && (
          <SitemapMatrixView 
            pages={allPages}
            onCellClick={handleMatrixCellClick}
          />
        )}
        
        {/* 详情面板 */}
        {selectedConnection && (
          <div className="absolute right-4 top-4 w-80">
            <ConnectionDetailsPanel 
              connectionId={selectedConnection}
              onClose={() => setSelectedConnection(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

## 🚀 实施计划 **【3天详细安排】**

### Day 1: 基础架构+Grid模式 (核心预览功能)

#### 上午 (4小时): 系统基础架构
- [ ] 创建预览系统主框架
  - 预览模式路由：`/preview?mode=grid&category=P0&device=mobile`
  - 设备切换器：移动端、PC端、平板端预览
  - 分类过滤器：P0/P1/P2页面分类
  - 页面数据管理：84个页面的完整信息

- [ ] 设计页面预览组件
  - PagePreviewCard：单页面预览卡片
  - DeviceFrame：设备框架模拟器
  - CategoryFilter：分类过滤组件
  - DeviceSwitcher：设备切换组件

#### 下午 (4小时): Grid模式完整实现
- [ ] 实现Grid网格预览模式
  - 网格布局：响应式4列网格展示
  - iframe集成：页面实时预览
  - 跳转关系展示：页面间跳转标签
  - 快速操作：访问页面、查看跳转图

- [ ] 添加交互功能
  - 页面搜索：按名称、分类、模块搜索
  - 排序功能：按优先级、名称、复杂度排序
  - 收藏功能：收藏常用页面
  - 历史记录：最近预览的页面

#### 晚上测试验证
- [ ] Grid模式功能测试
- [ ] 设备切换测试
- [ ] 页面跳转测试

### Day 2: Navigation+Flow模式 (导航体验+流程演示)

#### 上午 (4小时): Navigation导航模式
- [ ] 实现Navigation导航预览模式
  - 导航侧边栏：树形结构页面导航
  - 面包屑导航：页面访问路径历史
  - 单页面预览：大尺寸iframe预览
  - 页面信息栏：当前页面详细信息

- [ ] 添加导航交互
  - 页面导航：点击跳转、历史记录
  - 快速搜索：导航栏搜索功能
  - 标签管理：页面标签、快速切换
  - 导航提示：页面功能说明

#### 下午 (4小时): Flow流程模式
- [ ] 实现Flow流程预览模式
  - 用户流程定义：核心业务流程配置
  - 自动演示功能：流程自动播放
  - 流程控制面板：播放、暂停、步进控制
  - 流程可视化：步骤进度、时间轴

- [ ] 创建预定义流程
  - 核心溯源流程：登录→查询→详情→证书
  - 养殖管理流程：登录→监控→疫苗→繁育
  - 生产加工流程：登录→质检→拍照→报告
  - 管理后台流程：登录→用户管理→权限设置

#### 晚上测试验证
- [ ] Navigation模式测试
- [ ] Flow模式流程演示测试

### Day 3: Hierarchy+Sitemap模式+系统集成

#### 上午 (4小时): Hierarchy层级模式
- [ ] 实现Hierarchy层级预览模式
  - 层级树组件：可展开收缩的树形结构
  - 页面关系展示：父子页面关系
  - 层级搜索：在树结构中搜索页面
  - 层级统计：各层级页面数量统计

- [ ] 添加层级交互
  - 节点展开收缩：树节点交互
  - 关联页面展示：显示相关页面
  - 层级导航：在层级间快速跳转
  - 层级导出：树结构数据导出

#### 下午 (2小时): Sitemap地图模式
- [ ] 实现Sitemap站点地图模式
  - 图形化地图：页面关系图谱
  - 树形地图：站点树形结构
  - 矩阵地图：页面关系矩阵
  - 连接详情：页面跳转关系详情

#### 下午 (2小时): 系统集成测试
- [ ] 预览系统集成
  - 模式切换：5种预览模式无缝切换
  - 数据同步：页面状态在模式间同步
  - 设置保存：用户偏好设置持久化
  - 性能优化：大量iframe的性能优化

- [ ] 最终测试验证
  - 完整功能测试：所有模式功能验证
  - 浏览器兼容：Chrome、Safari、Firefox测试
  - 响应式测试：不同屏幕尺寸适配
  - 性能测试：加载速度、内存使用

## 🧩 技术实施细节

### 预览系统主入口
```typescript
// pages/preview/page.tsx
export default function PreviewSystemPage() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') || 'grid';
  const category = searchParams.get('category') || 'all';
  const device = searchParams.get('device') || 'mobile';
  
  const previewModes: PreviewMode[] = [
    { id: 'grid', name: '网格预览', description: '以网格形式预览所有页面', component: GridPreviewMode },
    { id: 'navigation', name: '导航预览', description: '模拟用户导航体验', component: NavigationPreviewMode },
    { id: 'flow', name: '流程预览', description: '用户流程自动演示', component: FlowPreviewMode },
    { id: 'hierarchy', name: '层级预览', description: '页面层级关系展示', component: HierarchyPreviewMode },
    { id: 'sitemap', name: '站点地图', description: '站点结构可视化', component: SitemapPreviewMode }
  ];
  
  const currentMode = previewModes.find(m => m.id === mode) || previewModes[0];
  const CurrentModeComponent = currentMode.component;
  
  return (
    <PageLayout title="页面预览系统">
      {/* 预览模式导航栏 */}
      <div className="border-b bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-6">
            <h1 className="text-xl font-medium">页面预览系统</h1>
            
            <nav className="flex space-x-1">
              {previewModes.map(mode => (
                <button
                  key={mode.id}
                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                    currentMode.id === mode.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  onClick={() => updatePreviewMode(mode.id)}
                >
                  {mode.name}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <PreviewSettings />
            <Button variant="outline" onClick={handleExport}>导出</Button>
          </div>
        </div>
      </div>
      
      {/* 预览模式内容 */}
      <div className="flex-1">
        <CurrentModeComponent 
          category={category}
          device={device}
          onSettingsChange={handleSettingsChange}
        />
      </div>
    </PageLayout>
  );
}
```

### 设备预览框架
```typescript
// components/DeviceFrame.tsx
export function DeviceFrame({ 
  device, 
  src, 
  className 
}: { 
  device: 'mobile' | 'desktop' | 'tablet';
  src: string;
  className?: string;
}) {
  const frameStyles = {
    mobile: {
      width: '375px',
      height: '667px',
      border: '8px solid #1f2937',
      borderRadius: '20px'
    },
    tablet: {
      width: '768px', 
      height: '1024px',
      border: '12px solid #374151',
      borderRadius: '16px'
    },
    desktop: {
      width: '1200px',
      height: '800px',
      border: '4px solid #6b7280',
      borderRadius: '8px'
    }
  };
  
  return (
    <div 
      className={`device-frame ${device}-frame ${className || ''}`}
      style={frameStyles[device]}
    >
      <iframe 
        src={src}
        className="w-full h-full border-0"
        style={{ borderRadius: 'inherit' }}
        title={`${device} preview`}
      />
    </div>
  );
}
```

## ✅ 验收标准

### 功能完整性验收 **🔥 关键**
- [ ] 5种预览模式全部实现并可正常切换
- [ ] 84个页面在所有模式下都能正确预览
- [ ] 用户流程演示功能完整可用
- [ ] 页面跳转关系正确展示
- [ ] 设备切换功能正常

### 用户体验验收
- [ ] 预览加载速度<3秒
- [ ] 模式切换流畅无卡顿
- [ ] 搜索功能响应及时
- [ ] 界面布局美观合理
- [ ] 交互操作直观易用

### 技术合规性验收 **【Phase-3标准】**
- [ ] TypeScript编译0错误
- [ ] 响应式设计完美适配
- [ ] 浏览器兼容性良好
- [ ] 性能优化达标
- [ ] 代码质量符合规范

## 📝 变更记录

| 日期 | 变更类型 | 文件路径 | 说明 | 状态 |
|------|---------|---------|------|------|
| 2025-01-15 | 任务创建 | TASK-P3-024_现代化预览系统.md | 创建现代化预览系统任务 | ✅ |

## 🔗 相关资源

- [TASK-P3-023 P2管理页面迁移](./TASK-P3-023_P2管理页面迁移.md) 📝 依赖
- [TASK-P3-020架构设计](./TASK-P3-020_静态页面现代化迁移架构设计.md) ✅ 基础
- [原始index.html](../../web-app/pages/index.html) 📄 参考架构

---

**任务状态**: 📝 等待开始  
**预计完成**: 3个工作日  
**技术栈**: Next.js 14 + TypeScript 5 + React + 现代化UI框架 