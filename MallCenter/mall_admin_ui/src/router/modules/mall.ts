const Layout = () => import("@/layout/index.vue");

export default [
  // 商城管理 - 主菜单
  {
    path: "/mall",
    component: Layout,
    redirect: "/mall/goods-category",
    meta: {
      icon: "ep/shop",
      title: "商城管理",
      rank: 5
    },
    children: [
      // 商品分类 - 全局独立
      {
        path: "/mall/goods-category",
        component: () => import("@/views/mall/goodsCategory/index.vue"),
        name: "GoodsCategory",
        meta: { title: "商品分类", icon: "ep/menu" }
      }
    ]
  },
  // 商户管理 - 独立的父级菜单
  {
    path: "/mall/merchant",
    component: Layout,
    redirect: "/mall/merchant/list",
    meta: {
      icon: "ep/office-building",
      title: "商户管理",
      rank: 6
    },
    children: [
      {
        path: "/mall/merchant/list",
        component: () => import("@/views/mall/merchant/index.vue"),
        name: "MerchantList",
        meta: { title: "商户列表", icon: "ep/list" }
      },
      {
        path: "/mall/merchant/goods",
        component: () => import("@/views/mall/goodsSpu/index.vue"),
        name: "MerchantGoods",
        meta: { title: "商品管理", icon: "ep/goods" }
      },
      {
        path: "/mall/merchant/orders",
        component: () => import("@/views/mall/orderInfo/index.vue"),
        name: "MerchantOrders",
        meta: { title: "订单管理", icon: "ep/document" }
      },
      {
        path: "/mall/merchant/decoration",
        component: () => import("@/views/mall/decoration/index.vue"),
        name: "MerchantDecoration",
        meta: { title: "店铺装修", icon: "ep/magic-stick" }
      }
    ]
  },
  // 商品编辑页 - 隐藏菜单
  {
    path: "/mall/merchant/goods/form",
    component: Layout,
    meta: { showLink: false },
    children: [
      {
        path: ":id?",
        component: () => import("@/views/mall/goodsSpu/form.vue"),
        name: "GoodsSpuForm",
        meta: { title: "商品编辑", activeMenu: "/mall/merchant/goods" }
      }
    ]
  },
  // 订单详情页 - 隐藏菜单
  {
    path: "/mall/merchant/orders/detail",
    component: Layout,
    meta: { showLink: false },
    children: [
      {
        path: ":id",
        component: () => import("@/views/mall/orderInfo/detail.vue"),
        name: "OrderInfoDetail",
        meta: { title: "订单详情", activeMenu: "/mall/merchant/orders" }
      }
    ]
  },
  // 商户详情页 - 隐藏菜单
  {
    path: "/mall/merchant/detail",
    component: Layout,
    meta: { showLink: false },
    children: [
      {
        path: ":id",
        component: () => import("@/views/mall/merchant/detail.vue"),
        name: "MerchantDetail",
        meta: { title: "商户详情", activeMenu: "/mall/merchant/list" }
      }
    ]
  },
  // AI智能装修 - 隐藏菜单
  {
    path: "/mall/merchant/decoration/ai-design",
    component: Layout,
    meta: { showLink: false },
    children: [
      {
        path: "",
        component: () => import("@/views/mall/decoration/ai-design.vue"),
        name: "AiDesign",
        meta: { title: "AI智能装修", activeMenu: "/mall/merchant/decoration" }
      }
    ]
  },
  // AI装修管理 - 独立的父级菜单
  {
    path: "/mall/ai-decoration",
    component: Layout,
    redirect: "/mall/ai-decoration/templates",
    meta: {
      icon: "ep/cpu",
      title: "AI装修管理",
      rank: 7
    },
    children: [
      {
        path: "/mall/ai-decoration/templates",
        component: () => import("@/views/mall/decoration/templates.vue"),
        name: "PromptTemplates",
        meta: { title: "Prompt模板", icon: "ep/document" }
      },
      {
        path: "/mall/ai-decoration/keywords",
        component: () => import("@/views/mall/decoration/keywords.vue"),
        name: "KeywordsMapping",
        meta: { title: "关键词映射", icon: "ep/key" }
      },
      {
        path: "/mall/ai-decoration/sessions",
        component: () => import("@/views/mall/decoration/sessions.vue"),
        name: "AiSessions",
        meta: { title: "AI对话记录", icon: "ep/chat-dot-round" }
      },
      {
        path: "/mall/ai-decoration/statistics",
        component: () => import("@/views/mall/decoration/statistics.vue"),
        name: "AiStatistics",
        meta: { title: "AI使用统计", icon: "ep/data-analysis" }
      }
    ]
  }
] satisfies Array<RouteConfigsTable>;
