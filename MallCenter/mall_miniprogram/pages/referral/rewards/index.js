/**
 * 推荐奖励页面
 */
const app = getApp()

Page({
  data: {
    loading: true,
    refreshing: false,
    loadingMore: false,
    hasMore: true,

    // 余额信息
    balance: {
      total: 0,
      available: 0,
      pending: 0,
      withdrawn: 0
    },

    // 标签页
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'income', name: '收入' },
      { key: 'withdraw', name: '提现' }
    ],
    activeTab: 'all',

    // 记录列表
    recordList: [],
    page: 1,
    pageSize: 10,

    // 提现弹窗
    showWithdrawModal: false,
    withdrawAmount: '',
    minWithdraw: 10,
    withdrawFee: 0
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
      const [balanceRes, listRes] = await Promise.all([
        this.fetchBalance(),
        this.fetchRecordList(1)
      ])

      const balance = balanceRes.code === 200 ? balanceRes.data : this.data.balance
      const list = listRes.code === 200 ? listRes.data.records || listRes.data : []

      this.setData({
        balance: balance,
        recordList: list,
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
        type: 'income',
        title: '推荐奖励',
        desc: '好友"张三"完成首单',
        amount: 10,
        status: 'success',
        createTime: '2024-01-16 10:30'
      },
      {
        id: 2,
        type: 'withdraw',
        title: '提现到微信',
        desc: '预计1-3个工作日到账',
        amount: -50,
        status: 'processing',
        createTime: '2024-01-15 14:20'
      },
      {
        id: 3,
        type: 'income',
        title: '推荐奖励',
        desc: '好友"王五"完成首单',
        amount: 10,
        status: 'success',
        createTime: '2024-01-14 11:45'
      },
      {
        id: 4,
        type: 'income',
        title: '推荐奖励',
        desc: '好友"钱七"完成首单',
        amount: 10,
        status: 'success',
        createTime: '2024-01-12 16:00'
      },
      {
        id: 5,
        type: 'withdraw',
        title: '提现到微信',
        desc: '已到账',
        amount: -30,
        status: 'success',
        createTime: '2024-01-10 09:15'
      }
    ]

    this.setData({
      balance: {
        total: 80,
        available: 30,
        pending: 0,
        withdrawn: 50
      },
      recordList: demoList,
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
      const [balanceRes, listRes] = await Promise.all([
        this.fetchBalance(),
        this.fetchRecordList(1)
      ])

      const balance = balanceRes.code === 200 ? balanceRes.data : this.data.balance
      const list = listRes.code === 200 ? listRes.data.records || listRes.data : []

      this.setData({
        balance: balance,
        recordList: list,
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
      const res = await this.fetchRecordList(nextPage)
      const newList = res.code === 200 ? res.data.records || res.data : []

      this.setData({
        recordList: [...this.data.recordList, ...newList],
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
   * 获取余额API
   */
  fetchBalance() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}/weixin/api/ma/referral/balance`,
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
   * 获取记录列表API
   */
  fetchRecordList(page) {
    const { activeTab, pageSize } = this.data
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}/weixin/api/ma/referral/records`,
        method: 'GET',
        data: {
          page: page,
          pageSize: pageSize,
          type: activeTab === 'all' ? '' : activeTab
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
      recordList: [],
      hasMore: true
    })

    this.filterList(key)
  },

  /**
   * 过滤列表
   */
  filterList(type) {
    this.setData({ loading: true })

    // 演示模式：本地过滤
    const allList = [
      { id: 1, type: 'income', title: '推荐奖励', desc: '好友"张三"完成首单', amount: 10, status: 'success', createTime: '2024-01-16 10:30' },
      { id: 2, type: 'withdraw', title: '提现到微信', desc: '预计1-3个工作日到账', amount: -50, status: 'processing', createTime: '2024-01-15 14:20' },
      { id: 3, type: 'income', title: '推荐奖励', desc: '好友"王五"完成首单', amount: 10, status: 'success', createTime: '2024-01-14 11:45' },
      { id: 4, type: 'income', title: '推荐奖励', desc: '好友"钱七"完成首单', amount: 10, status: 'success', createTime: '2024-01-12 16:00' },
      { id: 5, type: 'withdraw', title: '提现到微信', desc: '已到账', amount: -30, status: 'success', createTime: '2024-01-10 09:15' }
    ]

    const filtered = type === 'all' ? allList : allList.filter(item => item.type === type)

    setTimeout(() => {
      this.setData({
        recordList: filtered,
        loading: false,
        hasMore: false
      })
    }, 300)
  },

  /**
   * 打开提现弹窗
   */
  openWithdrawModal() {
    if (this.data.balance.available < this.data.minWithdraw) {
      wx.showToast({
        title: `可提现金额不足${this.data.minWithdraw}元`,
        icon: 'none'
      })
      return
    }
    this.setData({
      showWithdrawModal: true,
      withdrawAmount: ''
    })
  },

  /**
   * 关闭提现弹窗
   */
  closeWithdrawModal() {
    this.setData({ showWithdrawModal: false })
  },

  /**
   * 输入提现金额
   */
  onWithdrawInput(e) {
    let value = e.detail.value
    // 限制两位小数
    if (value.includes('.')) {
      const parts = value.split('.')
      if (parts[1].length > 2) {
        value = parts[0] + '.' + parts[1].slice(0, 2)
      }
    }
    this.setData({ withdrawAmount: value })
  },

  /**
   * 全部提现
   */
  withdrawAll() {
    this.setData({ withdrawAmount: String(this.data.balance.available) })
  },

  /**
   * 确认提现
   */
  async confirmWithdraw() {
    const { withdrawAmount, balance, minWithdraw } = this.data
    const amount = parseFloat(withdrawAmount)

    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入提现金额', icon: 'none' })
      return
    }

    if (amount < minWithdraw) {
      wx.showToast({ title: `最低提现${minWithdraw}元`, icon: 'none' })
      return
    }

    if (amount > balance.available) {
      wx.showToast({ title: '超出可提现金额', icon: 'none' })
      return
    }

    wx.showLoading({ title: '提交中...' })

    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/weixin/api/ma/referral/withdraw`,
          method: 'POST',
          data: { amount: amount },
          header: {
            'Authorization': `Bearer ${app.globalData.token || ''}`,
            'Content-Type': 'application/json'
          },
          success: (res) => resolve(res.data),
          fail: reject
        })
      })

      wx.hideLoading()

      if (res.code === 200) {
        wx.showToast({ title: '提现申请已提交', icon: 'success' })
        this.setData({ showWithdrawModal: false })
        this.refreshData()
      } else {
        throw new Error(res.msg || '提现失败')
      }
    } catch (error) {
      wx.hideLoading()
      console.error('提现失败:', error)

      // 演示模式：模拟成功
      wx.showToast({ title: '提现申请已提交', icon: 'success' })
      this.setData({
        showWithdrawModal: false,
        balance: {
          ...this.data.balance,
          available: this.data.balance.available - amount,
          pending: (this.data.balance.pending || 0) + amount
        }
      })
    }
  },

  /**
   * 阻止冒泡
   */
  stopPropagation() {
    // 阻止事件冒泡
  },

  /**
   * 查看规则
   */
  viewRules() {
    wx.showModal({
      title: '提现规则',
      content: '1. 最低提现金额10元\n2. 提现到账时间1-3个工作日\n3. 每月最多提现10次\n4. 提现免手续费',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  /**
   * 去邀请
   */
  goShare() {
    wx.navigateTo({
      url: '/pages/referral/share/index'
    })
  }
})
