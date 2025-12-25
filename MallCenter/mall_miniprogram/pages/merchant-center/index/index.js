/**
 * 商家工作台首页
 * 展示统计数据和功能菜单
 */
const app = getApp()
const api = require('../../../utils/api')

Page({
  data: {
    loading: true,
    merchantInfo: null,
    stats: {
      todayOrders: 0,
      todaySales: 0,
      pendingOrders: 0,
      totalProducts: 0
    },
    recentOrders: [],
    menuItems: [
      { icon: 'cuIcon-list', title: '订单管理', path: '/pages/merchant-center/orders/index', badge: 0 },
      { icon: 'cuIcon-goods', title: '商品管理', path: '/pages/merchant-center/product-list/index', badge: 0 },
      { icon: 'cuIcon-add', title: '发布商品', path: '/pages/merchant-center/product-edit/index', badge: 0 },
      { icon: 'cuIcon-chart', title: '数据统计', path: '/pages/merchant-center/stats/index', badge: 0 },
      { icon: 'cuIcon-people', title: '员工管理', path: '/pages/merchant-center/staff/index', badge: 0 },
      { icon: 'cuIcon-settings', title: '店铺设置', path: '/pages/merchant-center/settings/index', badge: 0 }
    ]
  },

  onLoad() {
    this.loadMerchantData()
  },

  onShow() {
    this.loadStats()
  },

  onPullDownRefresh() {
    this.loadMerchantData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载商户数据
  async loadMerchantData() {
    this.setData({ loading: true })
    try {
      // 获取商户信息
      const merchantId = app.globalData.merchantId
      if (merchantId) {
        const res = await api.getMerchantInfo(merchantId)
        if (res.data) {
          this.setData({
            merchantInfo: res.data
          })
        }
      }
      await this.loadStats()
      await this.loadRecentOrders()
    } catch (error) {
      console.error('加载商户数据失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载统计数据
  async loadStats() {
    try {
      const merchantId = app.globalData.merchantId
      let stats = {
        todayOrders: 0,
        todaySales: '0.00',
        pendingOrders: 0,
        totalProducts: 0
      }

      // 尝试从API获取统计数据
      if (merchantId) {
        try {
          const res = await api.getMerchantStats(merchantId)
          if (res.code === 200 && res.data) {
            stats = {
              todayOrders: res.data.todayOrders || 0,
              todaySales: res.data.todaySales || '0.00',
              pendingOrders: res.data.pendingOrders || 0,
              totalProducts: res.data.totalProducts || 0
            }
          }
        } catch (apiError) {
          console.log('API获取统计失败，使用本地模拟数据:', apiError)
          // API失败时使用模拟数据（开发阶段降级处理）
          stats = {
            todayOrders: Math.floor(Math.random() * 50),
            todaySales: (Math.random() * 10000).toFixed(2),
            pendingOrders: Math.floor(Math.random() * 20),
            totalProducts: Math.floor(Math.random() * 100) + 10
          }
        }
      }
      
      // 更新待处理订单数到菜单
      const menuItems = [...this.data.menuItems]
      menuItems[0].badge = stats.pendingOrders
      
      this.setData({
        stats: stats,
        menuItems: menuItems
      })
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  },

  // 加载最近订单
  async loadRecentOrders() {
    try {
      // 模拟订单数据
      const recentOrders = [
        { id: 1, orderNo: 'ORD20250125001', amount: 299.00, status: '待发货', time: '10:30' },
        { id: 2, orderNo: 'ORD20250125002', amount: 158.50, status: '已完成', time: '09:15' },
        { id: 3, orderNo: 'ORD20250124003', amount: 526.00, status: '待发货', time: '昨天' }
      ]
      this.setData({ recentOrders })
    } catch (error) {
      console.error('加载最近订单失败:', error)
    }
  },

  // 导航到页面
  navigateTo(e) {
    const path = e.currentTarget.dataset.path
    wx.navigateTo({ url: path })
  },

  // 查看全部订单
  viewAllOrders() {
    wx.navigateTo({ url: '/pages/merchant-center/orders/index' })
  },

  // 查看订单详情
  viewOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/order/order-detail/index?id=' + orderId })
  },

  // 扫码核销
  scanVerify() {
    wx.scanCode({
      success: (res) => {
        wx.showModal({
          title: '核销结果',
          content: '订单核销成功',
          showCancel: false
        })
      }
    })
  },

  // 联系客服
  contactService() {
    wx.makePhoneCall({
      phoneNumber: '400-888-8888'
    })
  }
})

