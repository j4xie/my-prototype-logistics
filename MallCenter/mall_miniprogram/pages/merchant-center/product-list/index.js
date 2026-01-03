/**
 * 商家商品列表页面
 * 支持真实API调用
 */
const app = getApp()
const api = require('../../../utils/api')

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
        wx.navigateTo({
          url: '/pages/auth/login/index'
        })
      }, 500)
      return
    }
    // 每次显示时刷新列表
    this.setData({ page: 1, products: [], hasMore: true })
    this.loadProducts()
  },

  onLoad() {
    // 初始加载在onShow中处理
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true, products: [] })
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
      const { currentTab, page, pageSize } = this.data

      // 构建查询参数
      const params = {
        current: page,
        size: pageSize
      }

      // 根据Tab过滤状态
      if (currentTab === 'online') {
        params.shelfStatus = 1  // 上架中
      } else if (currentTab === 'offline') {
        params.shelfStatus = 0  // 已下架
      } else if (currentTab === 'soldout') {
        params.stock = 0  // 库存为0
      }

      const res = await api.merchantGoodsPage(params)

      if (res.code === 200 && res.data) {
        const records = res.data.records || res.data.content || []
        const products = this.formatProducts(records)

        this.setData({
          products: products,
          hasMore: records.length >= pageSize
        })

        // 更新Tab计数
        this.updateTabCounts(res.data)
      } else {
        throw new Error(res.msg || '加载失败')
      }
    } catch (error) {
      console.error('加载商品失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 格式化商品数据
  formatProducts(records) {
    return records.map(item => {
      // 处理图片URL
      let image = '/public/img/no_pic.png'
      if (item.picUrls) {
        if (typeof item.picUrls === 'string') {
          try {
            const urls = JSON.parse(item.picUrls)
            image = urls[0] || image
          } catch (e) {
            image = item.picUrls.split(',')[0] || image
          }
        } else if (Array.isArray(item.picUrls) && item.picUrls.length > 0) {
          image = item.picUrls[0]
        }
      }

      // 判断状态
      let status = 'online'
      let statusText = '上架中'
      if (item.shelfStatus === 0) {
        status = 'offline'
        statusText = '已下架'
      } else if (item.stock <= 0) {
        status = 'soldout'
        statusText = '已售罄'
      }

      return {
        id: item.id,
        name: item.name || '未命名商品',
        image: image,
        price: item.salesPrice || item.price || 0,
        stock: item.stock || 0,
        sales: item.saleNum || 0,
        status: status,
        statusText: statusText,
        shelfStatus: item.shelfStatus
      }
    })
  },

  // 更新Tab计数
  updateTabCounts(data) {
    // 如果后端返回了统计数据，更新Tab计数
    if (data.total !== undefined) {
      const tabs = [...this.data.tabs]
      tabs[0].count = data.total || 0
      this.setData({ tabs })
    }
  },

  // 加载更多
  async loadMore() {
    const newPage = this.data.page + 1
    this.setData({ page: newPage, loading: true })
    try {
      const { currentTab, pageSize } = this.data

      const params = {
        current: newPage,
        size: pageSize
      }

      if (currentTab === 'online') {
        params.shelfStatus = 1
      } else if (currentTab === 'offline') {
        params.shelfStatus = 0
      } else if (currentTab === 'soldout') {
        params.stock = 0
      }

      const res = await api.merchantGoodsPage(params)

      if (res.code === 200 && res.data) {
        const records = res.data.records || res.data.content || []
        const moreProducts = this.formatProducts(records)

        this.setData({
          products: [...this.data.products, ...moreProducts],
          hasMore: records.length >= pageSize
        })
      }
    } catch (error) {
      console.error('加载更多失败:', error)
    } finally {
      this.setData({ loading: false })
    }
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
  async toggleStatus(e) {
    const id = e.currentTarget.dataset.id
    const currentStatus = e.currentTarget.dataset.status
    const newStatus = currentStatus === 'online' ? '下架' : '上架'
    const shelfStatus = currentStatus === 'online' ? 0 : 1

    wx.showModal({
      title: '确认操作',
      content: `确定要${newStatus}该商品吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' })
            const result = await api.goodsEdit({ id, shelfStatus })
            wx.hideLoading()

            if (result.code === 200) {
              wx.showToast({ title: `已${newStatus}`, icon: 'success' })
              this.loadProducts()
            } else {
              throw new Error(result.msg || '操作失败')
            }
          } catch (error) {
            wx.hideLoading()
            wx.showToast({ title: error.message || '操作失败', icon: 'none' })
          }
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
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' })
            const result = await api.goodsDel(id)
            wx.hideLoading()

            if (result.code === 200) {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.loadProducts()
            } else {
              throw new Error(result.msg || '删除失败')
            }
          } catch (error) {
            wx.hideLoading()
            wx.showToast({ title: error.message || '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
})

























