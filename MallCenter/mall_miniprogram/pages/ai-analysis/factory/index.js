/**
 * 工厂分析报告页面
 */
const app = getApp()

// Mock数据 - 当API不可用时使用
const MOCK_FACTORY_DATA = {
  factory: {
    name: '食品加工厂'
  },
  reportDate: new Date().toLocaleDateString('zh-CN'),
  overallScore: '92',
  scoreLevel: '优秀',
  percentile: '85',
  keyMetrics: [
    { label: '日产能', value: '5000kg' },
    { label: '员工数', value: '128人' },
    { label: '设备数', value: '36台' },
    { label: '合格率', value: '99.2%' }
  ],
  monthlyData: [
    { month: '7月', percent: 75 },
    { month: '8月', percent: 82 },
    { month: '9月', percent: 78 },
    { month: '10月', percent: 88 },
    { month: '11月', percent: 92 },
    { month: '12月', percent: 95 }
  ],
  strengths: [
    '全程冷链管理',
    'ISO22000认证',
    '智能化生产线',
    '溯源体系完善',
    '质检标准严格'
  ],
  weaknesses: [
    '建议扩大仓储容量',
    '可优化包装生产线',
    '加强员工培训体系'
  ],
  insights: [
    { icon: '📈', title: '产能趋势', desc: '近6个月产能持续增长，环比增长12%' },
    { icon: '✅', title: '质量表现', desc: '质检合格率稳定在99%以上，高于行业平均' },
    { icon: '⚡', title: '效率提升', desc: '智能化改造后，生产效率提升25%' },
    { icon: '🌟', title: '客户满意度', desc: 'B端客户满意度评分4.8/5.0' }
  ]
}

Page({
  data: {
    loading: true,
    factoryId: '',
    factory: {},
    reportDate: '',
    overallScore: '',
    scoreLevel: '',
    percentile: '',
    keyMetrics: [],
    monthlyData: [],
    strengths: [],
    weaknesses: [],
    insights: []
  },

  onShow() {
    // 检查登录状态 - 工厂分析页需要登录才能访问
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
    if (options.factoryId) {
      this.setData({ factoryId: options.factoryId })
    }
    this.loadAnalysisData()
  },

  // 加载分析数据
  async loadAnalysisData() {
    this.setData({ loading: true })

    try {
      if (this.data.factoryId) {
        const res = await app.api.getFactoryAnalysis(this.data.factoryId)
        if (res.code === 200 && res.data) {
          this.setData({
            ...res.data,
            loading: false
          })
          return
        }
      }
      // API失败或无factoryId时使用mock数据
      throw new Error('使用演示数据')
    } catch (error) {
      console.log('使用工厂分析演示数据')
      // 使用mock数据展示
      this.setData({
        ...MOCK_FACTORY_DATA,
        loading: false
      })
    }
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `${this.data.factory.name} - AI工厂分析报告`,
      path: `/pages/ai-analysis/factory/index?factoryId=${this.data.factoryId}`
    }
  }
})
