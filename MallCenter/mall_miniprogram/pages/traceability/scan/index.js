/**
 * 扫码溯源页面
 * 支持扫描二维码/条形码和手动输入批次号
 */
const app = getApp()

Page({
  data: {
    batchNo: '',
    inputMode: false,
    scanning: false,
    scanHistory: [],
    showHistory: false
  },

  onLoad() {
    this.loadScanHistory()
    // 页面加载时自动开始扫码
    this.startScan()
  },

  onShow() {
    // 检查登录状态 - 溯源扫码页需要登录才能访问
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

  // 加载扫码历史
  loadScanHistory() {
    try {
      const history = wx.getStorageSync('scanHistory') || []
      this.setData({ scanHistory: history.slice(0, 10) })
    } catch (e) {
      console.error('加载扫码历史失败:', e)
    }
  },

  // 保存扫码历史
  saveScanHistory(batchNo) {
    try {
      let history = wx.getStorageSync('scanHistory') || []
      // 移除重复项
      history = history.filter(item => item.batchNo !== batchNo)
      // 添加到开头
      history.unshift({
        batchNo: batchNo,
        time: new Date().toLocaleString()
      })
      // 只保留最近10条
      history = history.slice(0, 10)
      wx.setStorageSync('scanHistory', history)
      this.setData({ scanHistory: history })
    } catch (e) {
      console.error('保存扫码历史失败:', e)
    }
  },

  // 开始扫码
  startScan() {
    this.setData({ scanning: true })
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode', 'barCode'],
      success: (res) => {
        console.log('扫码结果:', res)
        let result = res.result
        let batchNo = this.extractBatchNo(result)
        
        if (batchNo) {
          this.setData({ batchNo: batchNo })
          this.goToDetail(batchNo)
        } else {
          wx.showToast({
            title: '无法识别批次号',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        console.log('扫码失败或取消:', err)
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({
            title: '扫码失败，请重试',
            icon: 'none'
          })
        }
      },
      complete: () => {
        this.setData({ scanning: false })
      }
    })
  },

  // 从扫码结果中提取批次号
  extractBatchNo(result) {
    if (!result) return null
    
    // 如果是URL，尝试提取参数
    if (result.includes('batchNo=')) {
      const match = result.match(/batchNo=([^&]+)/)
      return match ? decodeURIComponent(match[1]) : null
    }
    
    // 如果是URL带path
    if (result.includes('/traceability/')) {
      const match = result.match(/\/traceability\/([^\/\?]+)/)
      return match ? decodeURIComponent(match[1]) : null
    }
    
    // 直接作为批次号（假设是纯批次号格式）
    // 批次号格式通常为: FAC001-20250105-001 或纯数字
    if (/^[A-Za-z0-9\-_]+$/.test(result) && result.length >= 5 && result.length <= 50) {
      return result
    }
    
    return result
  },

  // 切换输入模式
  toggleInputMode() {
    this.setData({
      inputMode: !this.data.inputMode
    })
    if (this.data.inputMode) {
      // 聚焦输入框
      setTimeout(() => {
        this.setData({ focus: true })
      }, 100)
    }
  },

  // 输入批次号
  onInputChange(e) {
    this.setData({
      batchNo: e.detail.value
    })
  },

  // 确认输入
  onInputConfirm() {
    const batchNo = this.data.batchNo.trim()
    if (!batchNo) {
      wx.showToast({
        title: '请输入批次号',
        icon: 'none'
      })
      return
    }
    this.goToDetail(batchNo)
  },

  // 提交手动输入
  submitManualInput() {
    this.onInputConfirm()
  },

  // 跳转到详情页
  goToDetail(batchNo) {
    // 保存到历史记录
    this.saveScanHistory(batchNo)
    
    // 跳转到详情页
    wx.navigateTo({
      url: '/pages/traceability/detail/index?batchNo=' + encodeURIComponent(batchNo)
    })
  },

  // 切换历史记录显示
  toggleHistory() {
    this.setData({
      showHistory: !this.data.showHistory
    })
  },

  // 从历史记录中选择
  selectFromHistory(e) {
    const batchNo = e.currentTarget.dataset.batchno
    this.goToDetail(batchNo)
  },

  // 清除历史记录
  clearHistory() {
    wx.showModal({
      title: '确认',
      content: '确定要清除所有扫码记录吗？',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.removeStorageSync('scanHistory')
            this.setData({
              scanHistory: [],
              showHistory: false
            })
            wx.showToast({
              title: '已清除',
              icon: 'success'
            })
          } catch (e) {
            console.error('清除历史失败:', e)
          }
        }
      }
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '扫码溯源 - 追溯产品来源',
      path: '/pages/traceability/scan/index'
    }
  }
})

















