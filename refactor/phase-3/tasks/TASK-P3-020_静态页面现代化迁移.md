# TASK-P3-020: 静态页面现代化迁移

**任务ID**: TASK-P3-020  
**任务类型**: 📄 页面现代化迁�? 
**优先�?*: P0 (�? **【已调整�?*  
**预估工期**: 18个工作日 **【已调整�?*  
**状�?*: 📝 规划�? 
**创建日期**: 2025-01-15  
**最后更�?*: 2025-01-15  
**依赖任务**: TASK-P3-015 (现代化组件库) �?已完�?
## 📋 任务概述

将web-app中的**84个页�?*(26主页�?58二级页面)迁移到web-app-next的Next.js现代化架构中�?*完整保留所有页面间跳转关系和用户流�?*。确保严格遵循Phase-3技术栈规范和Neo Minimal iOS-Style设计系统�?
### 🎯 核心目标

1. **技术栈现代�?*: HTML/CSS/JS �?Next.js 14 + TypeScript 5
2. **完整跳转保留**: 所�?4个页面的跳转逻辑和用户流�?3. **预览系统升级**: 现代化`index.html`为交互式预览平台
4. **组件化重�?*: 使用已完成的15个现代化组件�?5. **性能优化**: SSG/SSR + 首屏<2�?
## 📊 迁移范围 **【深度分析结果�?*

### 核心发现
- **主页�?*: 26�?(原估�?  
- **二级页面**: 58�?(新发�?
- **总计**: **84个页�?* (工期�?-10天调整为18�?

### 页面分类
- **P0核心页面** (7�?15二级): 登录、首页、溯源查�?详情/列表/证书
- **P1业务模块** (12�?25二级): 养殖、生产、物流、编辑功�?- **P2管理页面** (7�?18二级): 用户中心、管理后台系�?
## 🚀 实施计划 **【Phase-3规范�?*

### 阶段一: 基础设施架构 (2�?
- [ ] 页面跳转关系图构�?- [ ] Next.js路由架构设计
- [ ] 交互式预览系统架�?
### 阶段�? P0核心页面 (3�?
- [ ] 认证系统 + 导航枢纽迁移
- [ ] 溯源查询链路完整迁移
- [ ] 多标签页结构实现

### 阶段�? P1业务模块 (5�?
- [ ] 养殖管理模块 (5�?8二级)
- [ ] 生产加工模块 (4�?12二级)
- [ ] 物流编辑模块 (3�?5二级)
- [ ] 跳转关系集成测试

### 阶段�? P2管理页面 (3�?
- [ ] 用户中心模块 (3�?8二级)
- [ ] 管理后台模块 (4�?10二级)
- [ ] 复杂跳转逻辑验证

### 阶段�? 预览系统开�?(3�?
- [ ] 5种预览模式实�?- [ ] 用户流程演示系统
- [ ] 页面关系可视�?
### 阶段�? 验收与优�?(2�?
- [ ] 完整用户流程E2E测试
- [ ] 性能优化和基准测�?
## 📋 技术实施方�?**【补充细节�?*

### 1. Next.js路由结构设计
```
web-app-next/src/app/
├── (auth)/
�?  ├── login/page.tsx
�?  └── admin/login/page.tsx
├── (dashboard)/
�?  ├── home/page.tsx
�?  ├── selector/page.tsx
�?  └── [module]/page.tsx
├── (trace)/
�?  ├── query/page.tsx
�?  ├── detail/[id]/page.tsx
�?  ├── list/page.tsx
�?  └── certificate/[id]/page.tsx
├── (farming)/
�?  ├── monitor/page.tsx
�?  ├── vaccine/page.tsx
�?  └── indicator/[id]/page.tsx
├── (processing)/
�?  ├── reports/page.tsx
�?  ├── quality/page.tsx
�?  └── detail/[id]/page.tsx
├── (admin)/
�?  ├── dashboard/page.tsx
�?  ├── users/page.tsx
�?  └── logs/page.tsx
└── preview/
    ├── page.tsx          # 现代化预览系�?    └── [category]/page.tsx
```

### 2. 页面组件化策�?```typescript
// 页面组件结构
interface PageProps {
  title: string;
  metadata?: PageMetadata;
  jumpTargets?: string[];
}

// 使用现代化组件库 (TASK-P3-015已完�?
import { PageLayout, Card, Button, Modal } from '@/components/ui';

export default function TracePage({ title, jumpTargets }: PageProps) {
  return (
    <PageLayout title={title}>
      <Card className="trace-card">
        {/* 页面内容 */}
      </Card>
    </PageLayout>
  );
}
```

### 3. 页面跳转关系映射
```typescript
// 完整跳转关系配置
const pageJumps = {
  'trace-list': {
    detailJump: 'trace-detail',
    createJump: 'trace-edit?mode=new',
    scanJump: 'trace-detail?source=scan'
  },
  'trace-detail': {
    certificateJump: 'trace-certificate',
    editJump: 'trace-edit?id={id}',
    returnJump: 'trace-list'
  },
  'home-selector': {
    farmingJump: 'farming/monitor',
    processingJump: 'processing/reports',
    logisticsJump: 'logistics/tracking',
    traceJump: 'trace/query'
  }
  // ... 84个页面的完整跳转配置
};
```

### 4. 现代化预览系�?```typescript
// 交互式预览组�?export function InteractivePagePreview({ 
  pages, 
  mode = 'grid',
  showJumps = true,
  deviceMode = 'mobile'
}) {
  const [currentPage, setCurrentPage] = useState(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(mode);
  
  return (
    <div className="preview-container">
      <PreviewControls 
        mode={previewMode} 
        onModeChange={setPreviewMode}
        deviceMode={deviceMode}
      />
      <PageGrid 
        pages={pages} 
        showJumps={showJumps}
        onPageSelect={setCurrentPage}
      />
      {currentPage && (
        <PagePreviewFrame 
          page={currentPage}
          deviceMode={deviceMode}
        />
      )}
    </div>
  );
}
```

### 5. SSG/SSR优化策略
```typescript
// 静态页面生�?export async function generateStaticParams() {
  return [
    { category: 'auth', page: 'login' },
    { category: 'trace', page: 'query' },
    { category: 'trace', page: 'detail', id: 'TR001' },
    // ... 84个页面的静态路�?  ];
}

// 服务端渲染优�?export async function generateMetadata({ params }): Promise<Metadata> {
  return {
    title: `${params.page} - 食品溯源系统`,
    description: `${params.category}模块 - 现代化溯源管理平台`,
  };
}
```

## �?验收标准

### 完整性验�?**🔥 关键**
- [ ] 所�?4个页面成功迁移并可访�?- [ ] 所有页面跳转关系正常工�?- [ ] 完整用户流程可演�?(登录→模块→详情→返�?
- [ ] 预览系统支持5种模式展�?
### 技术验�?**【Phase-3标准�?*
- [ ] TypeScript编译0错误
- [ ] Neo Minimal iOS-Style设计系统100%合规
- [ ] 页面加载性能<2�?- [ ] SSG/SSR正确配置

### 交互验收
- [ ] 现代化预览系统功能完�?- [ ] 移动端和PC端预览正�?- [ ] 用户流程演示功能正常

## 📝 变更记录

| 日期 | 变更类型 | 文件路径 | 说明 | 状�?|
|------|---------|---------|------|------|
| 2025-01-15 | 任务创建 | TASK-P3-020_静态页面现代化迁移.md | 初始任务创建 | �?|
| 2025-01-15 | 重大调整 | TASK-P3-020_静态页面现代化迁移.md | 发现58个二级页面，调整工期�?8�?| �?|
| 2025-01-15 | 技术补�?| TASK-P3-020_静态页面现代化迁移.md | 补充路由设计、组件策略等技术方�?| �?|

## 🔗 相关资源

- [TASK-P3-015现代化组件库](./TASK-P3-015_现代化组件库迁移.md) �?已完�?- [Phase-3工作计划](../PHASE-3-COMPREHENSIVE-PLAN.md)
- [组件迁移指导](../docs/COMPONENT-MIGRATION-GUIDE.md)

---

**任务状�?*: 📝 规划�? 
**预计完成**: 18个工作日  
**技术栈**: Next.js 14 + TypeScript 5 + Zustand + React Query 
