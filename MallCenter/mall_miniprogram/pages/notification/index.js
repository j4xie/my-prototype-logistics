/**
 * 消息通知中心页面
 * 显示商家收到的各类通知（商品上架、系统消息等）
 */
const app = getApp()

Page({
  data: {
    notifications: [],
    loading: false,
    loadingMore: false,
    noMore: false,
    page: 1,
    pageSize: 20,
    unreadCount: 0,
    // 当前筛选分类
    currentCategory: 'all',
    categories: [
      { key: 'all', name: '全部' },
      { key: 'product_found', name: '商品上新' },
      { key: 'promotion', name: '优惠活动' },
      { key: 'system', name: '系统消息' }
    ]
  },

  onLoad() {
    this.loadNotifications()
    this.loadUnreadCount()
  },

  onShow() {
    // 检查登录状态 - 通知中心需要登录才能访问
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
    // 页面显示时刷新未读数
    this.loadUnreadCount()
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      page: 1,
      noMore: false,
      notifications: []
    })
    this.loadNotifications().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 上拉加载更多
  onReachBottom() {
    if (!this.data.noMore && !this.data.loadingMore) {
      this.loadMore()
    }
  },

  // 加载通知列表
  async loadNotifications() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      const params = {
        current: this.data.page,
        size: this.data.pageSize
      }

      // 如果选择了分类
      if (this.data.currentCategory !== 'all') {
        params.category = this.data.currentCategory
      }

      const res = await app.api.getNotificationList(params)

      if (res.code === 200 && res.data) {
        const records = res.data.records || []
        const formattedRecords = records.map(item => this.formatNotification(item))

        this.setData({
          notifications: formattedRecords,
          noMore: records.length < this.data.pageSize
        })
      }
    } catch (error) {
      console.error('加载通知列表失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载更多
  async loadMore() {
    if (this.data.loadingMore || this.data.noMore) return

    this.setData({
      loadingMore: true,
      page: this.data.page + 1
    })

    try {
      const params = {
        current: this.data.page,
        size: this.data.pageSize
      }

      if (this.data.currentCategory !== 'all') {
        params.category = this.data.currentCategory
      }

      const res = await app.api.getNotificationList(params)

      if (res.code === 200 && res.data) {
        const records = res.data.records || []
        const formattedRecords = records.map(item => this.formatNotification(item))

        this.setData({
          notifications: [...this.data.notifications, ...formattedRecords],
          noMore: records.length < this.data.pageSize
        })
      }
    } catch (error) {
      console.error('加载更多通知失败:', error)
      // 失败时回退页码
      this.setData({
        page: this.data.page - 1
      })
    } finally {
      this.setData({ loadingMore: false })
    }
  },

  // 加载未读数量
  async loadUnreadCount() {
    try {
      const res = await app.api.getUnreadNotificationCount()
      if (res.code === 200) {
        this.setData({
          unreadCount: res.data || 0
        })
      }
    } catch (error) {
      console.error('获取未读数量失败:', error)
    }
  },

  // 格式化通知数据
  formatNotification(item) {
    return {
      ...item,
      timeStr: this.formatTime(item.createTime),
      categoryName: this.getCategoryName(item.category),
      isUnread: item.inAppStatus === 0 || item.inAppStatus === 1
    }
  },

  // 获取分类名称
  getCategoryName(category) {
    const categoryMap = {
      'product_found': '商品上新',
      'promotion': '优惠活动',
      'system': '系统消息'
    }
    return categoryMap[category] || '通知'
  },

  // 格式化时间
  formatTime(timeStr) {
    if (!timeStr) return ''

    const date = new Date(timeStr)
    const now = new Date()
    const diff = now - date

    // 1分钟内
    if (diff < 60 * 1000) {
      return '刚刚'
    }
    // 1小时内
    if (diff < 60 * 60 * 1000) {
      return Math.floor(diff / (60 * 1000)) + '分钟前'
    }
    // 24小时内
    if (diff < 24 * 60 * 60 * 1000) {
      return Math.floor(diff / (60 * 60 * 1000)) + '小时前'
    }
    // 7天内
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return Math.floor(diff / (24 * 60 * 60 * 1000)) + '天前'
    }
    // 超过7天显示日期
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${month}-${day}`
  },

  // 切换分类
  switchCategory(e) {
    const category = e.currentTarget.dataset.category
    if (category === this.data.currentCategory) return

    this.setData({
      currentCategory: category,
      page: 1,
      noMore: false,
      notifications: []
    })
    this.loadNotifications()
  },

  // 点击通知项
  async tapNotification(e) {
    const notification = e.currentTarget.dataset.item

    // 标记为已读
    if (notification.isUnread) {
      this.markAsRead([notification.id])
    }

    // 根据类型跳转
    if (notification.category === 'product_found' && notification.relatedProductIds) {
      // 有关联商品，跳转到商品详情或商品列表
      const productIds = typeof notification.relatedProductIds === 'string'
        ? JSON.parse(notification.relatedProductIds)
        : notification.relatedProductIds

      if (productIds && productIds.length === 1) {
        // 单个商品跳转详情
        wx.navigateTo({
          url: '/pages/goods/goods-detail/index?id=' + productIds[0]
        })
      } else if (productIds && productIds.length > 1) {
        // 多个商品，传关键词搜索
        wx.navigateTo({
          url: '/pages/goods/goods-list/index?name=' + encodeURIComponent(notification.relatedKeyword || '')
        })
      }
    } else if (notification.category === 'promotion') {
      // 优惠活动跳转首页
      wx.switchTab({
        url: '/pages/home/index'
      })
    }
  },

  // 标记已读
  async markAsRead(ids) {
    try {
      await app.api.markNotificationRead({ ids: ids })

      // 更新本地状态
      const notifications = this.data.notifications.map(item => {
        if (ids.includes(item.id)) {
          return { ...item, isUnread: false, inAppStatus: 2 }
        }
        return item
      })

      this.setData({
        notifications,
        unreadCount: Math.max(0, this.data.unreadCount - ids.length)
      })
    } catch (error) {
      console.error('标记已读失败:', error)
    }
  },

  // 全部标记已读
  async markAllAsRead() {
    if (this.data.unreadCount === 0) {
      wx.showToast({
        title: '没有未读消息',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认',
      content: '确定将所有消息标记为已读？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await app.api.markAllNotificationsRead()

            // 更新本地状态
            const notifications = this.data.notifications.map(item => ({
              ...item,
              isUnread: false,
              inAppStatus: 2
            }))

            this.setData({
              notifications,
              unreadCount: 0
            })

            wx.showToast({
              title: '已全部标记',
              icon: 'success'
            })
          } catch (error) {
            console.error('全部标记已读失败:', error)
            wx.showToast({
              title: '操作失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '消息通知 - 溯源商城',
      path: '/pages/notification/index'
    }
  }
})
