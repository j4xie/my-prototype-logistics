/**
 * 物流跟踪页面
 */
const app = getApp()

Page({
  data: {
    loading: true,
    orderId: '',
    logisticsId: '',

    // 物流信息
    logistics: {
      companyName: '',
      companyLogo: '',
      trackingNumber: '',
      status: '',
      estimatedTime: '',
      courierPhone: ''
    },

    // 物流轨迹
    trackList: [],

    // 状态文本映射
    statusText: '运输中'
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ logisticsId: options.id })
    }
    if (options.orderId) {
      this.setData({ orderId: options.orderId })
    }
    this.loadLogistics()
  },

  onPullDownRefresh() {
    this.loadLogistics().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 加载物流信息
   */
  async loadLogistics() {
    this.setData({ loading: true })

    try {
      const res = await this.fetchLogistics()

      if (res.code === 200 && res.data) {
        const data = res.data
        const statusText = this.getStatusText(data.status)

        this.setData({
          logistics: {
            companyName: data.companyName || '物流公司',
            companyLogo: data.companyLogo || '',
            trackingNumber: data.trackingNumber || '--',
            status: data.status || 'shipping',
            estimatedTime: data.estimatedTime || '',
            courierPhone: data.courierPhone || ''
          },
          trackList: data.tracks || [],
          statusText: statusText,
          loading: false
        })
      } else {
        throw new Error(res.msg || '加载失败')
      }
    } catch (error) {
      console.error('加载物流信息失败:', error)
      this.loadDemoData()
    }
  },

  /**
   * 加载演示数据
   */
  loadDemoData() {
    const demoTracks = [
      {
        desc: '【上海市】您的快递已签收，签收人：本人签收',
        time: '2024-01-16 14:30'
      },
      {
        desc: '【上海市】派送中，快递员：张师傅，电话：138****1234',
        time: '2024-01-16 09:15'
      },
      {
        desc: '【上海市】已到达上海浦东新区营业点',
        time: '2024-01-16 06:20'
      },
      {
        desc: '【上海市】快件已到达上海分拨中心',
        time: '2024-01-15 22:45'
      },
      {
        desc: '【杭州市】快件离开杭州转运中心，发往上海',
        time: '2024-01-15 18:30'
      },
      {
        desc: '【杭州市】已揽收，等待发出',
        time: '2024-01-15 14:20'
      }
    ]

    this.setData({
      logistics: {
        companyName: '顺丰速运',
        companyLogo: '',
        trackingNumber: 'SF1234567890123',
        status: 'delivered',
        estimatedTime: '已签收',
        courierPhone: '13812341234'
      },
      trackList: demoTracks,
      statusText: '已签收',
      loading: false
    })
  },

  /**
   * 获取物流API
   */
  fetchLogistics() {
    const { logisticsId, orderId } = this.data
    const id = logisticsId || orderId

    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}/weixin/api/ma/order/logistics/${id}`,
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
   * 获取状态文本
   */
  getStatusText(status) {
    const statusMap = {
      'pending': '待发货',
      'shipped': '已发货',
      'shipping': '运输中',
      'delivering': '派送中',
      'delivered': '已签收',
      'exception': '物流异常'
    }
    return statusMap[status] || '运输中'
  },

  /**
   * 复制运单号
   */
  copyTrackingNumber() {
    const { trackingNumber } = this.data.logistics
    if (!trackingNumber || trackingNumber === '--') {
      wx.showToast({ title: '暂无运单号', icon: 'none' })
      return
    }

    wx.setClipboardData({
      data: trackingNumber,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  },

  /**
   * 联系快递员
   */
  callCourier() {
    const { courierPhone } = this.data.logistics
    if (!courierPhone) {
      wx.showToast({ title: '暂无快递员电话', icon: 'none' })
      return
    }

    wx.makePhoneCall({
      phoneNumber: courierPhone,
      fail: (err) => {
        if (err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '拨打失败', icon: 'none' })
        }
      }
    })
  },

  /**
   * 查看订单
   */
  viewOrder() {
    const { orderId } = this.data
    if (orderId) {
      wx.navigateTo({
        url: `/pages/order/order-detail/index?id=${orderId}`
      })
    } else {
      wx.navigateTo({
        url: '/pages/order/order-list/index'
      })
    }
  },

  /**
   * 刷新物流
   */
  refresh() {
    wx.showLoading({ title: '刷新中...' })
    this.loadLogistics().finally(() => {
      wx.hideLoading()
      wx.showToast({ title: '已刷新', icon: 'success' })
    })
  }
})
