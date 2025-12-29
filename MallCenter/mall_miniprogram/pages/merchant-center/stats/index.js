/**
 * 数据统计页面
 */
Page({
  data: {
    loading: false,
    currentPeriod: 'today',
    periods: [
      { key: 'today', title: '今日' },
      { key: 'week', title: '本周' },
      { key: 'month', title: '本月' }
    ],
    overview: {
      totalSales: '0.00',
      orderCount: 0,
      customerCount: 0,
      avgOrderAmount: '0.00'
    },
    salesTrend: [],
    topProducts: [],
    orderStats: {
      pending: 0,
      shipping: 0,
      completed: 0,
      refund: 0
    }
  },

  onShow() {
    // 检查登录状态 - 数据统计页需要登录才能访问
    const app = getApp()
    const wxUser = app.globalData.wxUser
    if (!wxUser || !wxUser.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 1500
      })
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/auth/login/index'
        })
      }, 500)
      return
    }
  },

  onLoad() {
    this.loadStats()
  },

  onPullDownRefresh() {
    this.loadStats().then(() => wx.stopPullDownRefresh())
  },

  // 切换周期
  switchPeriod(e) {
    const period = e.currentTarget.dataset.period
    this.setData({ currentPeriod: period })
    this.loadStats()
  },

  // 加载统计数据
  async loadStats() {
    this.setData({ loading: true })
    try {
      // 模拟数据
      const multiplier = this.data.currentPeriod === 'today' ? 1 : 
                        this.data.currentPeriod === 'week' ? 7 : 30
      
      this.setData({
        overview: {
          totalSales: (Math.random() * 10000 * multiplier).toFixed(2),
          orderCount: Math.floor(Math.random() * 50 * multiplier),
          customerCount: Math.floor(Math.random() * 30 * multiplier),
          avgOrderAmount: (Math.random() * 200 + 100).toFixed(2)
        },
        topProducts: [
          { name: '精选牛肉', sales: Math.floor(Math.random() * 100), amount: (Math.random() * 5000).toFixed(2) },
          { name: '有机蔬菜礼盒', sales: Math.floor(Math.random() * 80), amount: (Math.random() * 4000).toFixed(2) },
          { name: '进口红酒', sales: Math.floor(Math.random() * 60), amount: (Math.random() * 3000).toFixed(2) },
          { name: '海鲜大礼包', sales: Math.floor(Math.random() * 40), amount: (Math.random() * 2000).toFixed(2) },
          { name: '坚果零食', sales: Math.floor(Math.random() * 30), amount: (Math.random() * 1000).toFixed(2) }
        ],
        orderStats: {
          pending: Math.floor(Math.random() * 10),
          shipping: Math.floor(Math.random() * 15),
          completed: Math.floor(Math.random() * 100 * multiplier),
          refund: Math.floor(Math.random() * 5)
        }
      })
    } catch (error) {
      console.error('加载统计数据失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 查看订单
  viewOrders(e) {
    const type = e.currentTarget.dataset.type
    wx.navigateTo({ url: `/pages/merchant-center/orders/index?tab=${type}` })
  },

  // 导出报表
  exportReport() {
    wx.showToast({ title: '导出功能开发中', icon: 'none' })
  }
})











