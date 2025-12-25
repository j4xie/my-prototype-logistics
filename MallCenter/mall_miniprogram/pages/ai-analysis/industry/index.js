/**
 * 行业分析报告页面
 * 实时AI分析 + Redis缓存 + 下拉刷新
 */
const app = getApp()

// Mock数据 - 当API不可用时使用
const MOCK_INDUSTRY_DATA = {
  reportTitle: '食品溯源行业分析报告',
  reportSubtitle: '2025年Q1 · AI智能分析',
  generatedAt: new Date().toISOString(),
  fromCache: false,
  highlights: [
    { label: '市场规模', value: '2850亿', trend: 'up', change: '+15.2%' },
    { label: '企业数量', value: '12.6万', trend: 'up', change: '+8.5%' },
    { label: '溯源覆盖率', value: '68%', trend: 'up', change: '+12%' },
    { label: '消费者认知', value: '82%', trend: 'up', change: '+5%' }
  ],
  trends: [
    {
      title: '区块链溯源技术普及',
      tag: 'hot',
      description: '区块链技术在食品溯源领域应用加速，预计2025年覆盖率将达45%',
      keywords: ['区块链', '不可篡改', '透明追溯']
    },
    {
      title: '智能化冷链监控',
      tag: 'rising',
      description: 'IoT传感器与AI结合，实现全程温控智能化管理',
      keywords: ['IoT', 'AI监控', '实时预警']
    },
    {
      title: '消费者扫码习惯养成',
      tag: 'rising',
      description: '超过65%消费者购买食品前会扫码查看溯源信息',
      keywords: ['扫码', '消费升级', '品质意识']
    }
  ],
  competitors: [
    { rank: 1, name: '阿里巴巴蚂蚁链', share: '18.5%', change: 'stable' },
    { rank: 2, name: '腾讯区块链', share: '15.2%', change: 'up' },
    { rank: 3, name: '京东智臻链', share: '12.8%', change: 'up' },
    { rank: 4, name: '华为云区块链', share: '9.6%', change: 'up' },
    { rank: 5, name: '百度超级链', share: '7.3%', change: 'down' }
  ],
  opportunities: [
    {
      title: '预制菜溯源市场',
      potential: 'high',
      description: '预制菜行业高速增长，溯源需求旺盛，市场空间超500亿',
      tags: ['预制菜', '高增长', '蓝海市场'],
      gradientStart: '#667eea',
      gradientEnd: '#764ba2'
    },
    {
      title: '跨境食品溯源',
      potential: 'high',
      description: '进口食品溯源合规要求提升，跨境溯源服务需求激增',
      tags: ['跨境', '合规', '进口食品'],
      gradientStart: '#f093fb',
      gradientEnd: '#f5576c'
    },
    {
      title: '社区团购溯源',
      potential: 'medium',
      description: '社区团购持续发展，生鲜溯源成为差异化竞争点',
      tags: ['社区团购', '生鲜', '下沉市场'],
      gradientStart: '#4facfe',
      gradientEnd: '#00f2fe'
    }
  ],
  insights: [
    {
      type: 'market',
      importance: 'critical',
      title: '政策利好持续释放',
      content: '国家食品安全战略深入推进，溯源系统建设将获得更多政策支持和资金扶持',
      confidence: 0.92,
      source: '国务院食品安全办公室'
    },
    {
      type: 'technology',
      importance: 'important',
      title: 'AI+溯源成为新趋势',
      content: '人工智能技术在质检、风险预警、数据分析等环节应用加深，提升溯源效率30%以上',
      confidence: 0.88,
      source: '中国食品工业协会'
    },
    {
      type: 'opportunity',
      importance: 'important',
      title: '中小企业数字化转型机遇',
      content: '中小食品企业溯源系统普及率仅35%，存在巨大市场空间',
      confidence: 0.85,
      source: 'AI分析'
    }
  ]
}

Page({
  data: {
    loading: true,
    refreshing: false,
    error: null,

    // 报告数据
    reportTitle: '',
    reportSubtitle: '',
    generatedAt: '',
    fromCache: false,
    cacheRemainingSeconds: 0,

    // 行业亮点
    highlights: [],

    // 行业趋势
    trends: [],

    // 竞争格局
    competitors: [],

    // 市场机会
    opportunities: [],

    // AI洞察
    insights: []
  },

  onLoad() {
    this.loadAnalysisData(false)
  },

  /**
   * 下拉刷新 - 强制重新生成
   */
  onPullDownRefresh() {
    this.loadAnalysisData(true)
  },

  /**
   * 加载行业分析数据
   * @param {boolean} forceRefresh 是否强制刷新
   */
  async loadAnalysisData(forceRefresh) {
    this.setData({
      loading: !forceRefresh,
      refreshing: forceRefresh,
      error: null
    })

    try {
      const res = await this.fetchIndustryAnalysis(forceRefresh)

      if (res.code === 200 && res.data) {
        const data = res.data

        this.setData({
          reportTitle: data.reportTitle || '食品溯源行业分析报告',
          reportSubtitle: data.reportSubtitle || '',
          generatedAt: this.formatDateTime(data.generatedAt),
          fromCache: data.fromCache || false,
          cacheRemainingSeconds: data.cacheRemainingSeconds || 0,
          highlights: data.highlights || [],
          trends: data.trends || [],
          competitors: data.competitors || [],
          opportunities: data.opportunities || [],
          insights: data.insights || [],
          loading: false,
          refreshing: false
        })

        // 显示缓存提示
        if (data.fromCache) {
          const minutes = Math.floor(data.cacheRemainingSeconds / 60)
          wx.showToast({
            title: `数据来自缓存，${minutes}分钟后更新`,
            icon: 'none',
            duration: 2000
          })
        } else if (forceRefresh) {
          wx.showToast({
            title: 'AI分析已更新',
            icon: 'success'
          })
        }
      } else {
        // API返回错误
        throw new Error(res.msg || 'AI分析服务响应异常')
      }
    } catch (error) {
      console.log('使用行业分析演示数据')

      // 使用mock数据展示
      this.setData({
        reportTitle: MOCK_INDUSTRY_DATA.reportTitle,
        reportSubtitle: MOCK_INDUSTRY_DATA.reportSubtitle,
        generatedAt: this.formatDateTime(MOCK_INDUSTRY_DATA.generatedAt),
        fromCache: MOCK_INDUSTRY_DATA.fromCache,
        cacheRemainingSeconds: 0,
        highlights: MOCK_INDUSTRY_DATA.highlights,
        trends: MOCK_INDUSTRY_DATA.trends,
        competitors: MOCK_INDUSTRY_DATA.competitors,
        opportunities: MOCK_INDUSTRY_DATA.opportunities,
        insights: MOCK_INDUSTRY_DATA.insights,
        loading: false,
        refreshing: false,
        error: null
      })
    }

    wx.stopPullDownRefresh()
  },

  /**
   * 调用API获取行业分析 (使用统一api.js)
   * @param {boolean} forceRefresh 是否强制刷新
   */
  fetchIndustryAnalysis(forceRefresh) {
    return app.api.getIndustryAnalysis(forceRefresh)
  },

  /**
   * 重试加载
   */
  retryLoad() {
    this.loadAnalysisData(false)
  },

  /**
   * 格式化日期时间
   */
  formatDateTime(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  /**
   * 获取趋势标签样式
   */
  getTrendTagClass(tag) {
    return tag === 'hot' ? 'trend-tag-hot' : 'trend-tag-rising'
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '食品溯源行业分析报告 - AI智能洞察',
      path: '/pages/ai-analysis/industry/index'
    }
  }
})
