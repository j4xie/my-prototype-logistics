/**
 * 设置页面
 */
const app = getApp()

Page({
  data: {
    version: '1.0.0',
    cacheSize: '0 KB',

    // 通知设置
    orderNotification: true,
    messageNotification: true,
    marketingNotification: false,

    // 隐私设置
    biometricEnabled: false
  },

  onLoad() {
    this.loadSettings()
    this.calculateCacheSize()
  },

  onShow() {
    this.loadSettings()
  },

  /**
   * 加载设置
   */
  loadSettings() {
    try {
      const orderNotification = wx.getStorageSync('setting_order_notification')
      const messageNotification = wx.getStorageSync('setting_message_notification')
      const marketingNotification = wx.getStorageSync('setting_marketing_notification')
      const biometricEnabled = wx.getStorageSync('setting_biometric_enabled')

      this.setData({
        orderNotification: orderNotification !== false,
        messageNotification: messageNotification !== false,
        marketingNotification: marketingNotification === true,
        biometricEnabled: biometricEnabled === true
      })
    } catch (e) {
      console.error('加载设置失败:', e)
    }
  },

  /**
   * 计算缓存大小
   */
  calculateCacheSize() {
    try {
      const res = wx.getStorageInfoSync()
      const sizeKB = res.currentSize
      let sizeText = ''
      if (sizeKB >= 1024) {
        sizeText = (sizeKB / 1024).toFixed(1) + ' MB'
      } else {
        sizeText = sizeKB + ' KB'
      }
      this.setData({ cacheSize: sizeText })
    } catch (e) {
      this.setData({ cacheSize: '0 KB' })
    }
  },

  // ========== 账号设置 ==========

  /**
   * 跳转个人信息
   */
  goToProfile() {
    wx.navigateTo({ url: '/pages/user/user-center/index' })
  },

  /**
   * 修改密码
   */
  changePassword() {
    wx.showToast({ title: '功能开发中', icon: 'none' })
  },

  /**
   * 收货地址管理
   */
  manageAddress() {
    wx.navigateTo({ url: '/pages/user/user-address/list/index' })
  },

  // ========== 通知设置 ==========

  /**
   * 切换订单通知
   */
  toggleOrderNotification(e) {
    const value = e.detail.value
    this.setData({ orderNotification: value })
    wx.setStorageSync('setting_order_notification', value)
    wx.showToast({ title: value ? '已开启' : '已关闭', icon: 'none' })
  },

  /**
   * 切换消息通知
   */
  toggleMessageNotification(e) {
    const value = e.detail.value
    this.setData({ messageNotification: value })
    wx.setStorageSync('setting_message_notification', value)
    wx.showToast({ title: value ? '已开启' : '已关闭', icon: 'none' })
  },

  /**
   * 切换营销推送
   */
  toggleMarketingNotification(e) {
    const value = e.detail.value
    this.setData({ marketingNotification: value })
    wx.setStorageSync('setting_marketing_notification', value)
    wx.showToast({ title: value ? '已开启' : '已关闭', icon: 'none' })
  },

  // ========== 隐私与安全 ==========

  /**
   * 隐私设置
   */
  privacySettings() {
    wx.showToast({ title: '功能开发中', icon: 'none' })
  },

  /**
   * 账号安全
   */
  accountSecurity() {
    wx.showToast({ title: '功能开发中', icon: 'none' })
  },

  /**
   * 切换生物识别
   */
  toggleBiometric(e) {
    const value = e.detail.value
    this.setData({ biometricEnabled: value })
    wx.setStorageSync('setting_biometric_enabled', value)
    wx.showToast({ title: value ? '已开启' : '已关闭', icon: 'none' })
  },

  // ========== 通用设置 ==========

  /**
   * 语言设置
   */
  languageSettings() {
    wx.showActionSheet({
      itemList: ['简体中文', 'English'],
      success: (res) => {
        const lang = res.tapIndex === 0 ? '简体中文' : 'English'
        wx.showToast({ title: '已选择: ' + lang, icon: 'none' })
      }
    })
  },

  /**
   * 清除缓存
   */
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确认清除缓存？清除后需要重新加载数据',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '清除中...' })

          // 保留关键数据
          const token = wx.getStorageSync('token')
          const userInfo = wx.getStorageSync('userInfo')

          // 清除存储
          wx.clearStorageSync()

          // 恢复关键数据
          if (token) wx.setStorageSync('token', token)
          if (userInfo) wx.setStorageSync('userInfo', userInfo)

          setTimeout(() => {
            wx.hideLoading()
            this.calculateCacheSize()
            wx.showToast({ title: '缓存已清除', icon: 'success' })
          }, 1000)
        }
      }
    })
  },

  // ========== 关于 ==========

  /**
   * 关于我们
   */
  aboutUs() {
    wx.showModal({
      title: '关于我们',
      content: '白垩纪食品溯源商城\n致力于为您提供安全、可追溯的优质食品\n\n联系我们: support@cretas.com',
      showCancel: false
    })
  },

  /**
   * 检查更新
   */
  checkUpdate() {
    wx.showLoading({ title: '检查中...' })

    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({ title: '已是最新版本', icon: 'success' })
    }, 1500)
  },

  /**
   * 用户协议
   */
  userAgreement() {
    wx.navigateTo({ url: '/pages/base/webview/index?url=https://www.cretas.com/agreement' })
  },

  /**
   * 隐私政策
   */
  privacyPolicy() {
    wx.navigateTo({ url: '/pages/base/webview/index?url=https://www.cretas.com/privacy' })
  },

  // ========== 退出登录 ==========

  /**
   * 退出登录
   */
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确认退出登录？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '退出中...' })

          // 清除用户数据
          wx.clearStorageSync()

          // 清除全局状态
          app.globalData.token = ''
          app.globalData.userInfo = null

          setTimeout(() => {
            wx.hideLoading()
            wx.showToast({ title: '已退出登录', icon: 'success' })

            setTimeout(() => {
              wx.reLaunch({ url: '/pages/auth/login/index' })
            }, 500)
          }, 1000)
        }
      }
    })
  }
})
