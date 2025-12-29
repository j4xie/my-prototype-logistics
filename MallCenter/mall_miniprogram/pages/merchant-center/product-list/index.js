/**
 * 商家商品列表页面
 */
const app = getApp()

Page({
  data: {
    loading: false,
    currentTab: 'all',
    tabs: [
      { key: 'all', title: '全部', count: 0 },
      { key: 'online', title: '上架中', count: 0 },
      { key: 'offline', title: '已下架', count: 0 },
      { key: 'soldout', title: '已售罄', count: 0 }
    ],
    products: [],
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  onShow() {
    // 检查登录状态 - 商品列表管理需要登录才能访问
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
    this.loadProducts()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true })
    this.loadProducts().then(() => wx.stopPullDownRefresh())
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
      products: [],
      hasMore: true
    })
    this.loadProducts()
  },

  // 加载商品
  async loadProducts() {
    this.setData({ loading: true })
    try {
      const mockProducts = this.getMockProducts()
      this.setData({
        products: mockProducts,
        hasMore: mockProducts.length >= this.data.pageSize
      })
    } catch (error) {
      console.error('加载商品失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载更多
  async loadMore() {
    const newPage = this.data.page + 1
    this.setData({ page: newPage, loading: true })
    try {
      const moreProducts = this.getMockProducts()
      this.setData({
        products: [...this.data.products, ...moreProducts],
        hasMore: moreProducts.length >= this.data.pageSize
      })
    } catch (error) {
      console.error('加载更多失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 获取模拟商品
  getMockProducts() {
    const products = []
    const names = ['精选牛肉', '新鲜蔬菜', '有机水果', '海鲜礼盒', '进口红酒']
    for (let i = 0; i < 6; i++) {
      const status = Math.random() > 0.3 ? 'online' : 'offline'
      products.push({
        id: Date.now() + i,
        name: names[Math.floor(Math.random() * names.length)],
        image: '/public/img/no_pic.png',
        price: (Math.random() * 200 + 50).toFixed(2),
        stock: Math.floor(Math.random() * 100),
        sales: Math.floor(Math.random() * 500),
        status: status,
        statusText: status === 'online' ? '上架中' : '已下架'
      })
    }
    return products
  },

  // 添加商品
  addProduct() {
    wx.navigateTo({ url: '/pages/merchant-center/product-edit/index' })
  },

  // 编辑商品
  editProduct(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/merchant-center/product-edit/index?id=' + id })
  },

  // 上架/下架
  toggleStatus(e) {
    const id = e.currentTarget.dataset.id
    const currentStatus = e.currentTarget.dataset.status
    const newStatus = currentStatus === 'online' ? '下架' : '上架'
    
    wx.showModal({
      title: '确认操作',
      content: `确定要${newStatus}该商品吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: `已${newStatus}`, icon: 'success' })
          this.loadProducts()
        }
      }
    })
  },

  // 删除商品
  deleteProduct(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除吗？',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadProducts()
        }
      }
    })
  }
})











