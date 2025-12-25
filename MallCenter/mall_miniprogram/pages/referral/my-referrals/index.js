/**
 * 我的推荐页面
 */
const app = getApp()

Page({
  data: {
    loading: true,
    refreshing: false,
    loadingMore: false,
    hasMore: true,

    // 统计
    stats: {
      total: 0,
      success: 0,
      pending: 0,
      totalRewards: 0
    },

    // 标签页
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'success', name: '已成功' },
      { key: 'pending', name: '待确认' }
    ],
    activeTab: 'all',

    // 推荐列表
    referralList: [],
    page: 1,
    pageSize: 10
  },

  onLoad() {
    this.loadData()
  },

  onPullDownRefresh() {
    this.refreshData()
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMoreData()
    }
  },

  /**
   * 加载数据
   */
  async loadData() {
    this.setData({ loading: true })

    try {
      const [statsRes, listRes] = await Promise.all([
        this.fetchStats(),
        this.fetchReferralList(1)
      ])

      const stats = statsRes.code === 200 ? statsRes.data : this.data.stats
      const list = listRes.code === 200 ? listRes.data.records || listRes.data : []

      this.setData({
        stats: stats,
        referralList: list,
        page: 1,
        hasMore: list.length >= this.data.pageSize,
        loading: false
      })
    } catch (error) {
      console.error('加载数据失败:', error)
      this.loadDemoData()
    }
  },

  /**
   * 加载演示数据
   */
  loadDemoData() {
    const demoList = [
      {
        id: 1,
        userName: '张三',
        avatar: '',
        phone: '138****8888',
        registerTime: '2024-01-15 14:30',
        firstOrderTime: '2024-01-16 10:20',
        status: 'success',
        reward: 10
      },
      {
        id: 2,
        userName: '李四',
        avatar: '',
        phone: '139****9999',
        registerTime: '2024-01-14 09:15',
        firstOrderTime: null,
        status: 'pending',
        reward: 0
      },
      {
        id: 3,
        userName: '王五',
        avatar: '',
        phone: '137****7777',
        registerTime: '2024-01-13 16:45',
        firstOrderTime: '2024-01-14 11:30',
        status: 'success',
        reward: 10
      },
      {
        id: 4,
        userName: '赵六',
        avatar: '',
        phone: '136****6666',
        registerTime: '2024-01-12 08:00',
        firstOrderTime: null,
        status: 'pending',
        reward: 0
      },
      {
        id: 5,
        userName: '钱七',
        avatar: '',
        phone: '135****5555',
        registerTime: '2024-01-11 19:30',
        firstOrderTime: '2024-01-12 14:20',
        status: 'success',
        reward: 10
      }
    ]

    this.setData({
      stats: {
        total: 12,
        success: 8,
        pending: 4,
        totalRewards: 80
      },
      referralList: demoList,
      loading: false,
      hasMore: false
    })
  },

  /**
   * 刷新数据
   */
  async refreshData() {
    this.setData({ refreshing: true, page: 1 })

    try {
      const [statsRes, listRes] = await Promise.all([
        this.fetchStats(),
        this.fetchReferralList(1)
      ])

      const stats = statsRes.code === 200 ? statsRes.data : this.data.stats
      const list = listRes.code === 200 ? listRes.data.records || listRes.data : []

      this.setData({
        stats: stats,
        referralList: list,
        hasMore: list.length >= this.data.pageSize,
        refreshing: false
      })
    } catch (error) {
      console.error('刷新失败:', error)
      this.setData({ refreshing: false })
    }

    wx.stopPullDownRefresh()
  },

  /**
   * 加载更多
   */
  async loadMoreData() {
    if (!this.data.hasMore || this.data.loadingMore) return

    this.setData({ loadingMore: true })
    const nextPage = this.data.page + 1

    try {
      const res = await this.fetchReferralList(nextPage)
      const newList = res.code === 200 ? res.data.records || res.data : []

      this.setData({
        referralList: [...this.data.referralList, ...newList],
        page: nextPage,
        hasMore: newList.length >= this.data.pageSize,
        loadingMore: false
      })
    } catch (error) {
      console.error('加载更多失败:', error)
      this.setData({ loadingMore: false })
    }
  },

  /**
   * 获取统计API
   */
  fetchStats() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}/weixin/api/ma/referral/stats`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${app.globalData.token || ''}`
        },
        success: (res) => resolve(res.data),
        fail: reject
      })
    })
  },

  /**
   * 获取推荐列表API
   */
  fetchReferralList(page) {
    const { activeTab, pageSize } = this.data
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}/weixin/api/ma/referral/list`,
        method: 'GET',
        data: {
          page: page,
          pageSize: pageSize,
          status: activeTab === 'all' ? '' : activeTab
        },
        header: {
          'Authorization': `Bearer ${app.globalData.token || ''}`
        },
        success: (res) => resolve(res.data),
        fail: reject
      })
    })
  },

  /**
   * 切换标签
   */
  switchTab(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.activeTab) return

    this.setData({
      activeTab: key,
      page: 1,
      referralList: [],
      hasMore: true
    })

    this.filterList(key)
  },

  /**
   * 过滤列表
   */
  filterList(status) {
    this.setData({ loading: true })

    // 演示模式：本地过滤
    const allList = [
      { id: 1, userName: '张三', phone: '138****8888', registerTime: '2024-01-15 14:30', firstOrderTime: '2024-01-16 10:20', status: 'success', reward: 10 },
      { id: 2, userName: '李四', phone: '139****9999', registerTime: '2024-01-14 09:15', firstOrderTime: null, status: 'pending', reward: 0 },
      { id: 3, userName: '王五', phone: '137****7777', registerTime: '2024-01-13 16:45', firstOrderTime: '2024-01-14 11:30', status: 'success', reward: 10 },
      { id: 4, userName: '赵六', phone: '136****6666', registerTime: '2024-01-12 08:00', firstOrderTime: null, status: 'pending', reward: 0 },
      { id: 5, userName: '钱七', phone: '135****5555', registerTime: '2024-01-11 19:30', firstOrderTime: '2024-01-12 14:20', status: 'success', reward: 10 }
    ]

    const filtered = status === 'all' ? allList : allList.filter(item => item.status === status)

    setTimeout(() => {
      this.setData({
        referralList: filtered,
        loading: false,
        hasMore: false
      })
    }, 300)
  },

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    const map = {
      'success': '已成功',
      'pending': '待确认',
      'expired': '已过期'
    }
    return map[status] || status
  },

  /**
   * 获取头像显示
   */
  getAvatarText(name) {
    return name ? name.charAt(0) : '?'
  },

  /**
   * 查看用户详情
   */
  viewDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.showToast({
      title: '查看详情: ' + id,
      icon: 'none'
    })
  },

  /**
   * 去邀请
   */
  goShare() {
    wx.navigateTo({
      url: '/pages/referral/share/index'
    })
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '邀请您加入白垩纪溯源平台',
      path: '/pages/auth/register/index'
    }
  }
})
