import { createWebHistory, createRouter, createWebHashHistory } from 'vue-router'
/* Layout */
import Layout from '@/layout'

/**
 * Note: 路由配置项
 *
 * hidden: true                     // 当设置 true 的时候该路由不会再侧边栏出现 如401，login等页面，或者如一些编辑页面/edit/1
 * alwaysShow: true                 // 当你一个路由下面的 children 声明的路由大于1个时，自动会变成嵌套的模式--如组件页面
 *                                  // 只有一个时，会将那个子路由当做根路由显示在侧边栏--如引导页面
 *                                  // 若你想不管路由下面的 children 声明的个数都显示你的根路由
 *                                  // 你可以设置 alwaysShow: true，这样它就会忽略之前定义的规则，一直显示根路由
 * redirect: noRedirect             // 当设置 noRedirect 的时候该路由在面包屑导航中不可被点击
 * name:'router-name'               // 设定路由的名字，一定要填写不然使用<keep-alive>时会出现各种问题
 * query: '{"id": 1, "name": "ry"}' // 访问路由的默认传递参数
 * roles: ['admin', 'common']       // 访问路由的角色权限
 * permissions: ['a:a:a', 'b:b:b']  // 访问路由的菜单权限
 * meta : {
    noCache: true                   // 如果设置为true，则不会被 <keep-alive> 缓存(默认 false)
    title: 'title'                  // 设置该路由在侧边栏和面包屑中展示的名字
    icon: 'svg-name'                // 设置该路由的图标，对应路径src/assets/icons/svg
    breadcrumb: false               // 如果设置为false，则不会在breadcrumb面包屑中显示
    activeMenu: '/system/user'      // 当路由设置了该属性，则会高亮相对应的侧边栏。
  }
 */

// 公共路由
export const constantRoutes = [
  {
    path: '/redirect',
    component: Layout,
    hidden: true,
    children: [
      {
        path: '/redirect/:path(.*)',
        component: () => import('@/views/redirect/index.vue')
      }
    ]
  },
  {
    path: '/login',
    component: () => import('@/views/login'),
    hidden: true
  },
  {
    path: '/register',
    component: () => import('@/views/register'),
    hidden: true
  },
  {
    path: '/401',
    component: () => import('@/views/error/401'),
    hidden: true
  },
  {
    path: '',
    component: Layout,
    redirect: '/index',
    children: [
      {
        path: '/index',
        component: () => import('@/views/dashboard/index.vue'),
        name: 'Index',
        meta: { title: '仪表盘', icon: 'dashboard', affix: true }
      }
    ]
  },
  {
    path: '/user',
    component: Layout,
    hidden: true,
    redirect: 'noredirect',
    children: [
      {
        path: 'profile',
        component: () => import('@/views/system/user/profile/index'),
        name: 'Profile',
        meta: { title: '个人中心', icon: 'user' }
      }
    ]
  }
]

// 404路由 - 在动态路由加载后添加，避免提前匹配
export const notFoundRoute = {
  path: "/:pathMatch(.*)*",
  component: () => import('@/views/error/404'),
  hidden: true
}

// 动态路由，基于用户权限动态去加载
export const dynamicRoutes = [
  {
    path: '/system/user-auth',
    component: Layout,
    hidden: true,
    permissions: ['system:user:edit'],
    children: [
      {
        path: 'role/:userId(\\d+)',
        component: () => import('@/views/system/user/authRole'),
        name: 'AuthRole',
        meta: { title: '分配角色', activeMenu: '/system/user' }
      }
    ]
  },
  {
    path: '/system/role-auth',
    component: Layout,
    hidden: true,
    permissions: ['system:role:edit'],
    children: [
      {
        path: 'user/:roleId(\\d+)',
        component: () => import('@/views/system/role/authUser'),
        name: 'AuthUser',
        meta: { title: '分配用户', activeMenu: '/system/role' }
      }
    ]
  },
  {
    path: '/system/dict-data',
    component: Layout,
    hidden: true,
    permissions: ['system:dict:list'],
    children: [
      {
        path: 'index/:dictId(\\d+)',
        component: () => import('@/views/system/dict/data'),
        name: 'Data',
        meta: { title: '字典数据', activeMenu: '/system/dict' }
      }
    ]
  },
  {
    path: '/monitor/job-log',
    component: Layout,
    hidden: true,
    permissions: ['monitor:job:list'],
    children: [
      {
        path: 'index/:jobId(\\d+)',
        component: () => import('@/views/monitor/job/log'),
        name: 'JobLog',
        meta: { title: '调度日志', activeMenu: '/monitor/job' }
      }
    ]
  },
  {
    path: '/tool/gen-edit',
    component: Layout,
    hidden: true,
    permissions: ['tool:gen:edit'],
    children: [
      {
        path: 'index/:tableId(\\d+)',
        component: () => import('@/views/tool/gen/editTable'),
        name: 'GenEdit',
        meta: { title: '修改生成配置', activeMenu: '/tool/gen' }
      }
    ]
  },
  // 商品管理 - 创建/编辑页面
  {
    path: '/mall/goodsspu-create',
    component: Layout,
    hidden: true,
    permissions: ['mall:goodsspu:add'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/goodsspu/create'),
        name: 'GoodsSpuCreate',
        meta: { title: '创建商品', activeMenu: '/mall/goodsspu' }
      }
    ]
  },
  {
    path: '/mall/goodsspu-edit',
    component: Layout,
    hidden: true,
    permissions: ['mall:goodsspu:edit'],
    children: [
      {
        path: ':id',
        component: () => import('@/views/mall/goodsspu/edit'),
        name: 'GoodsSpuEdit',
        meta: { title: '编辑商品', activeMenu: '/mall/goodsspu' }
      }
    ]
  },
  {
    path: '/mall/goodsspu-pricetier',
    component: Layout,
    hidden: true,
    permissions: ['mall:goodsspu:edit'],
    children: [
      {
        path: ':id',
        component: () => import('@/views/mall/goodsspu/pricetier'),
        name: 'GoodsSpuPriceTier',
        meta: { title: '阶梯定价配置', activeMenu: '/mall/goodsspu' }
      }
    ]
  },
  // 商户管理
  {
    path: '/mall/merchant',
    component: Layout,
    hidden: true,
    permissions: ['mall:merchant:index'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/merchant/index'),
        name: 'MerchantList',
        meta: { title: '商户管理', activeMenu: '/mall/merchant' }
      }
    ]
  },
  // 商户状态管理
  {
    path: '/mall/merchant-status-management',
    component: Layout,
    hidden: true,
    permissions: ['mall:merchant:status'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/merchant/status-management'),
        name: 'MerchantStatusManagement',
        meta: { title: '商户状态管理', activeMenu: '/mall/merchant' }
      }
    ]
  },
  {
    path: '/mall/merchant-detail',
    component: Layout,
    hidden: true,
    permissions: ['mall:merchant:get'],
    children: [
      {
        path: ':id',
        component: () => import('@/views/mall/merchant/detail'),
        name: 'MerchantDetail',
        meta: { title: '商户详情', activeMenu: '/mall/merchant' }
      }
    ]
  },
  // 推荐管理
  {
    path: '/mall/referral',
    component: Layout,
    hidden: false,
    permissions: ['mall:referral:get'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/referral/index'),
        name: 'ReferralList',
        meta: { title: '推荐管理', icon: 'share' }
      }
    ]
  },
  {
    path: '/mall/referral-config',
    component: Layout,
    hidden: true,
    permissions: ['mall:referral:edit'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/referral/reward-config'),
        name: 'ReferralRewardConfig',
        meta: { title: '奖励配置', activeMenu: '/mall/referral' }
      }
    ]
  },
  {
    path: '/mall/merchant-edit',
    component: Layout,
    hidden: true,
    permissions: ['mall:merchant:edit'],
    children: [
      {
        path: ':id',
        component: () => import('@/views/mall/merchant/edit'),
        name: 'MerchantEdit',
        meta: { title: '编辑商户', activeMenu: '/mall/merchant' }
      }
    ]
  },
  // 订单管理
  {
    path: '/mall/orderinfo-detail',
    component: Layout,
    hidden: true,
    permissions: ['mall:orderinfo:get'],
    children: [
      {
        path: ':id',
        component: () => import('@/views/mall/orderinfo/detail'),
        name: 'OrderInfoDetail',
        meta: { title: '订单详情', activeMenu: '/mall/orderinfo' }
      }
    ]
  },
  // 溯源管理
  {
    path: '/mall/traceability',
    component: Layout,
    hidden: true,
    permissions: ['mall:traceability:index'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/traceability/index'),
        name: 'TraceabilityList',
        meta: { title: '溯源批次管理', activeMenu: '/mall/traceability' }
      }
    ]
  },
  {
    path: '/mall/traceability-create',
    component: Layout,
    hidden: true,
    permissions: ['mall:traceability:add'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/traceability/create'),
        name: 'TraceabilityCreate',
        meta: { title: '新增溯源批次', activeMenu: '/mall/traceability' }
      }
    ]
  },
  {
    path: '/mall/traceability-edit',
    component: Layout,
    hidden: true,
    permissions: ['mall:traceability:edit'],
    children: [
      {
        path: ':id',
        component: () => import('@/views/mall/traceability/create'),
        name: 'TraceabilityEdit',
        meta: { title: '编辑溯源批次', activeMenu: '/mall/traceability' }
      }
    ]
  },
  {
    path: '/mall/traceability-detail',
    component: Layout,
    hidden: true,
    permissions: ['mall:traceability:get'],
    children: [
      {
        path: ':id',
        component: () => import('@/views/mall/traceability/detail'),
        name: 'TraceabilityDetail',
        meta: { title: '溯源批次详情', activeMenu: '/mall/traceability' }
      }
    ]
  },
  // 广告管理
  {
    path: '/mall/advertisement',
    component: Layout,
    hidden: true,
    permissions: ['mall:advertisement:index'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/advertisement/index'),
        name: 'AdvertisementList',
        meta: { title: '广告管理', activeMenu: '/mall/advertisement' }
      }
    ]
  },
  {
    path: '/mall/advertisement-create',
    component: Layout,
    hidden: true,
    permissions: ['mall:advertisement:add'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/advertisement/edit'),
        name: 'AdvertisementCreate',
        meta: { title: '新增广告', activeMenu: '/mall/advertisement' }
      }
    ]
  },
  {
    path: '/mall/advertisement-edit',
    component: Layout,
    hidden: true,
    permissions: ['mall:advertisement:edit'],
    children: [
      {
        path: ':id',
        component: () => import('@/views/mall/advertisement/edit'),
        name: 'AdvertisementEdit',
        meta: { title: '编辑广告', activeMenu: '/mall/advertisement' }
      }
    ]
  },
  {
    path: '/mall/advertisement-slots',
    component: Layout,
    hidden: true,
    permissions: ['mall:advertisement:index'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/advertisement/slots'),
        name: 'AdvertisementSlots',
        meta: { title: '广告位配置', activeMenu: '/mall/advertisement' }
      }
    ]
  },
  {
    path: '/mall/advertisement-featured',
    component: Layout,
    hidden: true,
    permissions: ['mall:advertisement:index'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/advertisement/featured'),
        name: 'FeaturedProducts',
        meta: { title: '精选商品', activeMenu: '/mall/advertisement' }
      }
    ]
  },
  {
    path: '/mall/advertisement-ranking',
    component: Layout,
    hidden: true,
    permissions: ['mall:advertisement:index'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/advertisement/ranking'),
        name: 'RankingConfig',
        meta: { title: '排名配置', activeMenu: '/mall/advertisement' }
      }
    ]
  },
  // 内容审核
  {
    path: '/mall/content-review',
    component: Layout,
    hidden: true,
    permissions: ['mall:content:review'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/content-review/queue'),
        name: 'ContentReviewQueue',
        meta: { title: '审核队列', activeMenu: '/mall/content-review' }
      }
    ]
  },
  {
    path: '/mall/content-review-banner',
    component: Layout,
    hidden: true,
    permissions: ['mall:content:review'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/content-review/banner'),
        name: 'BannerManagement',
        meta: { title: 'Banner管理', activeMenu: '/mall/content-review' }
      }
    ]
  },
  {
    path: '/mall/content-review-strategy',
    component: Layout,
    hidden: true,
    permissions: ['mall:content:review'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/content-review/strategy'),
        name: 'ContentReviewStrategy',
        meta: { title: '审核策略配置', activeMenu: '/mall/content-review' }
      }
    ]
  },
  // AI知识库
  {
    path: '/mall/ai-knowledge',
    component: Layout,
    hidden: true,
    permissions: ['mall:ai:knowledge'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/ai-knowledge/index'),
        name: 'AIKnowledge',
        meta: { title: 'AI知识库', activeMenu: '/mall/ai-knowledge' }
      }
    ]
  },
  {
    path: '/mall/ai-knowledge-upload',
    component: Layout,
    hidden: true,
    permissions: ['mall:ai:knowledge'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/ai-knowledge/upload'),
        name: 'AIKnowledgeUpload',
        meta: { title: '上传文档', activeMenu: '/mall/ai-knowledge' }
      }
    ]
  },
  {
    path: '/mall/ai-knowledge-category',
    component: Layout,
    hidden: true,
    permissions: ['mall:ai:knowledge'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/ai-knowledge/category'),
        name: 'AIKnowledgeCategory',
        meta: { title: '分类管理', activeMenu: '/mall/ai-knowledge' }
      }
    ]
  },
  {
    path: '/mall/ai-knowledge-qa',
    component: Layout,
    hidden: true,
    permissions: ['mall:ai:knowledge'],
    children: [
      {
        path: '',
        component: () => import('@/views/mall/ai-knowledge/qa-pairs'),
        name: 'AIKnowledgeQA',
        meta: { title: 'QA配对管理', activeMenu: '/mall/ai-knowledge' }
      }
    ]
  },
  // 数据分析
  {
    path: '/analytics/traffic',
    component: Layout,
    hidden: true,
    permissions: ['analytics:traffic:index'],
    children: [
      {
        path: '',
        component: () => import('@/views/analytics/traffic'),
        name: 'TrafficAnalytics',
        meta: { title: '流量统计', activeMenu: '/analytics/traffic' }
      }
    ]
  },
  {
    path: '/analytics/conversion',
    component: Layout,
    hidden: true,
    permissions: ['analytics:conversion:index'],
    children: [
      {
        path: '',
        component: () => import('@/views/analytics/conversion'),
        name: 'ConversionAnalytics',
        meta: { title: '转化分析', activeMenu: '/analytics/conversion' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes: constantRoutes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  },
});

export default router;
