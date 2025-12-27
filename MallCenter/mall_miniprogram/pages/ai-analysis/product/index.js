/**
 * 产品分析报告页面
 */
const app = getApp()

// Mock数据 - 当API不可用时使用
const MOCK_PRODUCT_DATA = {
  product: {
    name: '鲜冻带鱼段',
    image: '/public/img/no_pic.png',
    category: '冷冻水产 / 海鱼类',
    stars: '⭐⭐⭐⭐⭐',
    score: 4.8,
    reviewCount: 1256
  },
  coreMetrics: [
    { label: '综合评分', value: '4.8' },
    { label: '质检通过率', value: '99.2%' },
    { label: '复购率', value: '68%' },
    { label: '好评率', value: '96.5%' }
  ],
  qualityMetrics: [
    { label: '新鲜度', score: 95 },
    { label: '口感品质', score: 92 },
    { label: '包装完整性', score: 98 },
    { label: '规格一致性', score: 90 }
  ],
  comparison: [
    { metric: '价格竞争力', value: '¥38/kg', average: '¥42/kg', better: true, arrow: '↓' },
    { metric: '新鲜度评分', value: '95分', average: '88分', better: true, arrow: '↑' },
    { metric: '配送速度', value: '24小时', average: '36小时', better: true, arrow: '↓' },
    { metric: '包装质量', value: '98分', average: '85分', better: true, arrow: '↑' }
  ],
  reviews: [
    { id: 1, user: '张***', date: '2025-01-20', stars: '⭐⭐⭐⭐⭐', content: '带鱼非常新鲜，肉质紧实，冷链配送很快' },
    { id: 2, user: '李***', date: '2025-01-18', stars: '⭐⭐⭐⭐', content: '分量足，性价比高，下次还会回购' },
    { id: 3, user: '王***', date: '2025-01-15', stars: '⭐⭐⭐⭐⭐', content: '包装严实，没有破损，鱼很新鲜' }
  ],
  tags: ['新鲜', '性价比高', '配送快', '包装好', '肉质紧实', '无腥味'],
  aiSuggestion: {
    strengths: [
      '产品新鲜度高于行业平均水平7%',
      '冷链物流保障完善，配送时效领先',
      '客户复购率达68%，忠诚度较高',
      '质检通过率99.2%，品控严格'
    ],
    improvements: [
      '建议增加更多规格选项满足不同需求',
      '可考虑推出家庭装提升客单价',
      '加强社交媒体营销扩大品牌影响力'
    ]
  }
}

Page({
  data: {
    loading: true,
    productId: '',
    product: {},
    coreMetrics: [],
    qualityMetrics: [],
    comparison: [],
    reviews: [],
    tags: [],
    aiSuggestion: {
      strengths: [],
      improvements: []
    }
  },

  onShow() {
    // 检查登录状态 - 产品分析页需要登录才能访问
    const wxUser = app.globalData.wxUser
    if (!wxUser || !wxUser.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 1500
      })
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/home/index'
        })
      }, 500)
      return
    }
  },

  onLoad(options) {
    if (options.productId) {
      this.setData({ productId: options.productId })
    }
    // 如果有产品名称参数，更新mock数据
    if (options.productName) {
      MOCK_PRODUCT_DATA.product.name = decodeURIComponent(options.productName)
    }
    this.loadAnalysisData()
  },

  // 加载分析数据
  async loadAnalysisData() {
    this.setData({ loading: true })

    try {
      if (this.data.productId) {
        const res = await app.api.getProductAnalysis(this.data.productId)
        if (res.code === 200 && res.data) {
          this.setData({
            ...res.data,
            loading: false
          })
          return
        }
      }
      // API失败或无productId时使用mock数据
      throw new Error('使用演示数据')
    } catch (error) {
      console.log('使用产品分析演示数据')
      // 使用mock数据展示
      this.setData({
        ...MOCK_PRODUCT_DATA,
        loading: false
      })
    }
  },

  // 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `${this.data.product.name} - AI产品分析报告`,
      path: `/pages/ai-analysis/product/index?productId=${this.data.productId}`
    }
  }
})
