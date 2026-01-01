/**
 * 商家订单管理页面
 */
const app = getApp()

Page({
  data: {
    loading: false,
    currentTab: 'all',
    tabs: [
      { key: 'all', title: '全部' },
      { key: 'pending', title: '待处理' },
      { key: 'shipping', title: '待发货' },
      { key: 'completed', title: '已完成' },
      { key: 'refund', title: '退款/售后' }
    ],
    orders: [],
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  onShow() {
    // 检查登录状态 - 商家订单管理需要登录才能访问
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

  onLoad() {
    this.loadOrders()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true })
    this.loadOrders().then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore()
    }
  },

  // 切换Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({
      currentTab: tab,
      page: 1,
      orders: [],
      hasMore: true
    })
    this.loadOrders()
  },

  // 加载订单
  async loadOrders() {
    this.setData({ loading: true })
    try {
      // 模拟订单数据
      const mockOrders = this.getMockOrders()
      this.setData({
        orders: mockOrders,
        hasMore: mockOrders.length >= this.data.pageSize
      })
    } catch (error) {
      console.error('加载订单失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载更多
  async loadMore() {
    const newPage = this.data.page + 1
    this.setData({ page: newPage, loading: true })
    try {
      const moreOrders = this.getMockOrders()
      this.setData({
        orders: [...this.data.orders, ...moreOrders],
        hasMore: moreOrders.length >= this.data.pageSize
      })
    } catch (error) {
      console.error('加载更多失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 获取模拟订单
  getMockOrders() {
    const statuses = ['待付款', '待发货', '已发货', '已完成', '退款中']
    const orders = []
    for (let i = 0; i < 5; i++) {
      orders.push({
        id: Date.now() + i,
        orderNo: 'ORD' + Date.now() + i,
        customerName: '用户' + Math.floor(Math.random() * 1000),
        customerPhone: '138****' + Math.floor(1000 + Math.random() * 9000),
        totalAmount: (Math.random() * 500 + 50).toFixed(2),
        status: statuses[Math.floor(Math.random() * statuses.length)],
        createTime: new Date().toLocaleString(),
        goods: [
          { name: '精品牛肉', quantity: 2, price: 128.00 }
        ]
      })
    }
    return orders
  },

  // 查看订单详情
  viewDetail(e) {
    const orderId = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/order/order-detail/index?id=' + orderId })
  },

  // 发货
  shipOrder(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认发货',
      content: '确定要发货吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '已发货', icon: 'success' })
          this.loadOrders()
        }
      }
    })
  },

  // 联系买家
  contactBuyer(e) {
    const phone = e.currentTarget.dataset.phone
    wx.makePhoneCall({ phoneNumber: phone.replace(/\*/g, '0') })
  },

  // 搜索订单
  searchOrders() {
    wx.showToast({ title: '搜索功能开发中', icon: 'none' })
  }
})

















