/**
 * 溯源详情页
 */
const app = getApp()

// 阶段图标和颜色配置
const STAGE_CONFIG = {
  'sourcing': { icon: 'cuIcon-location', color: '#1890ff', name: '原料采购' },
  'receiving': { icon: 'cuIcon-deliver', color: '#52c41a', name: '原料接收' },
  'storage': { icon: 'cuIcon-home', color: '#faad14', name: '仓储管理' },
  'processing': { icon: 'cuIcon-settings', color: '#eb2f96', name: '加工生产' },
  'quality': { icon: 'cuIcon-safe', color: '#13c2c2', name: '质量检测' },
  'packaging': { icon: 'cuIcon-present', color: '#722ed1', name: '包装入库' },
  'shipping': { icon: 'cuIcon-send', color: '#fa541c', name: '出货运输' },
  'default': { icon: 'cuIcon-roundcheck', color: '#52c41a', name: '生产环节' }
}

Page({
  data: {
    batchNo: '',
    loading: true,
    error: false,
    errorMsg: '',
    batchInfo: null,
    timeline: [],
    rawMaterials: [],
    qualityReports: [],
    evidences: [],
    currentTab: 'timeline', // timeline, materials, quality, evidence
    expandedItems: {} // 控制时间线项展开状态
  },

  onShow() {
    // 检查登录状态 - 溯源详情页需要登录才能访问
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

  onLoad(options) {
    if (options.batchNo) {
      this.setData({
        batchNo: options.batchNo
      })
      this.loadTraceInfo(options.batchNo)
    } else {
      this.setData({
        loading: false,
        error: true,
        errorMsg: '缺少批次号参数'
      })
    }
  },

  // 加载溯源信息
  loadTraceInfo(batchNo) {
    this.setData({ loading: true, error: false })

    app.api.getTraceabilityByBatchNo(batchNo)
      .then(res => {
        if (res.data) {
          const data = res.data
          // 处理时间线数据，添加阶段配置
          const timeline = (data.timelineList || []).map((item, index) => {
            const stageKey = item.stage || 'default'
            const config = STAGE_CONFIG[stageKey] || STAGE_CONFIG['default']
            return {
              ...item,
              stageIcon: config.icon,
              stageColor: config.color,
              stageName: item.title || config.name,
              isFirst: index === 0,
              isLast: index === (data.timelineList || []).length - 1,
              // 格式化时间
              formattedTime: this.formatTime(item.timestamp || item.operateTime)
            }
          })

          this.setData({
            loading: false,
            batchInfo: data,
            timeline: timeline,
            rawMaterials: data.rawMaterialList || [],
            qualityReports: data.qualityReportList || [],
            evidences: data.evidenceList || []
          })
        } else {
          this.setData({
            loading: false,
            error: true,
            errorMsg: '未找到该批次的溯源信息'
          })
        }
      })
      .catch(err => {
        console.error('加载溯源信息失败:', err)
        this.setData({
          loading: false,
          error: true,
          errorMsg: '加载失败，请稍后重试'
        })
      })
  },

  // 格式化时间
  formatTime(dateStr) {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      const hour = date.getHours().toString().padStart(2, '0')
      const minute = date.getMinutes().toString().padStart(2, '0')
      return `${month}-${day} ${hour}:${minute}`
    } catch (e) {
      return dateStr
    }
  },

  // 展开/收起时间线项
  toggleTimelineItem(e) {
    const index = e.currentTarget.dataset.index
    const key = `expandedItems.${index}`
    const currentValue = this.data.expandedItems[index] || false
    this.setData({
      [key]: !currentValue
    })
  },

  // 切换Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url
    const urls = e.currentTarget.dataset.urls || [url]
    wx.previewImage({
      current: url,
      urls: urls
    })
  },

  // 刷新
  refresh() {
    if (this.data.batchNo) {
      this.loadTraceInfo(this.data.batchNo)
    }
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '查看商品溯源信息',
      path: '/pages/traceability/detail/index?batchNo=' + this.data.batchNo
    }
  },

  // 重新扫码 - 统一跳转到扫码页
  reScan() {
    wx.navigateTo({
      url: '/pages/traceability/scan/index'
    })
  }
})
