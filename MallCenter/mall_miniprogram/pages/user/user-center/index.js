/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 注意：
 * 基于 JooLun 框架二次开发
 */
const app = getApp()

Page({
  data: {
    config: app.globalData.config,
    wxUser: null,
    userInfo: null,
    orderCountAll: [],
    unreadCount: 0,
    showAiAssistant: false  // AI助手开关
  },
  onShow(){
    const wxUser = app.globalData.wxUser

    // 更新页面数据
    this.setData({
      wxUser: wxUser
    })

    // 未登录时只显示登录按钮，不强制跳转
    if (!wxUser || !wxUser.id) {
      console.log('登录状态: 未登录', wxUser)
      return
    }

    console.log('登录状态: 已登录', wxUser.id)

    //更新tabbar购物车数量
    wx.setTabBarBadge({
      index: 2,
      text: app.globalData.shoppingCartCount + ''
    })

    this.wxUserGet()
    this.orderCountAll()
    this.loadAiConfig()
    this.loadUnreadCount()
    if(this.data.config.adEnable){
      // 在页面中定义插屏广告
      let interstitialAd = null
      // 在页面onLoad回调事件中创建插屏广告实例
      if (wx.createInterstitialAd) {
        interstitialAd = wx.createInterstitialAd({
          adUnitId: this.data.config.adInsertScreenID
        })
        interstitialAd.onLoad(() => { })
        interstitialAd.onError((err) => { })
        interstitialAd.onClose(() => { })
      }
      // 在适合的场景显示插屏广告
      if (interstitialAd) {
        interstitialAd.show().catch((err) => {
          console.error(err)
        })
      }
    }
  },
  onLoad(){
    
  },
  /**
   * 小程序设置
  */
  settings: function () {
    wx.openSetting({
      success: function (res) {
        console.log(res.authSetting)
      }
    })
  },
  getUserProfile(e) {
    wx.getUserProfile({
      desc: '用于完善会员资料', // 声明获取用户个人信息后的用途，后续会展示在弹窗中，请谨慎填写
      success: (detail) => {
        app.api.wxUserSave(detail)
        .then(res => {
          let wxUser = res.data
          this.setData({
            wxUser: wxUser
          })
          app.globalData.wxUser = wxUser
          this.wxUserGet()
        })
      }
    })
  },
  // 加载AI配置
  loadAiConfig() {
    app.api.getAiConfig()
      .then(res => {
        if (res.code === 200 && res.data) {
          this.setData({
            showAiAssistant: res.data.enabled === true
          })
        }
      })
      .catch(err => {
        console.log('加载AI配置失败:', err)
      })
  },
  //获取商城用户信息
  wxUserGet(){
    app.api.wxUserGet()
      .then(res => {
        this.setData({
          userInfo: res.data
        })
      })
  },
  orderCountAll(){
    app.api.orderCountAll()
      .then(res => {
        this.setData({
          orderCountAll: res.data
        })
      })
  },
  //获取未读通知数量
  loadUnreadCount(){
    app.api.getUnreadNotificationCount()
      .then(res => {
        if (res.code === 200) {
          this.setData({
            unreadCount: res.data || 0
          })
        }
      })
      .catch(err => {
        console.error('获取未读通知数量失败:', err)
      })
  },
  // 跳转到商家工作台
  goToMerchantCenter() {
    const userInfo = this.data.userInfo
    const wxUser = this.data.wxUser

    // 首先检查用户是否已登录（有微信授权且有系统用户ID）
    if (!wxUser || !wxUser.nickName) {
      wx.showToast({
        title: '请先授权微信登录',
        icon: 'none'
      })
      wx.navigateTo({
        url: '/pages/auth/login/index'
      })
      return
    }

    // 检查是否有系统用户ID（已注册/登录到系统）
    if (!userInfo || !userInfo.id) {
      wx.showModal({
        title: '提示',
        content: '请先完成登录注册',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/auth/login/index'
            })
          }
        }
      })
      return
    }

    // 检查用户是否已绑定商户
    const merchantId = app.globalData.merchantId || userInfo.merchantId

    if (merchantId) {
      // 已绑定商户，跳转到商家工作台
      wx.navigateTo({
        url: '/pages/merchant-center/index/index'
      })
    } else {
      // 未绑定商户，提示绑定
      wx.showModal({
        title: '提示',
        content: '您还未绑定商户，是否前往绑定？',
        confirmText: '去绑定',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/auth/bind-merchant/index'
            })
          }
        }
      })
    }
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      confirmColor: '#e54d42',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 清除全局用户数据
          app.globalData.wxUser = null
          app.globalData.userInfo = null
          app.globalData.merchantId = null
          app.globalData.token = null

          // 清除本地存储
          wx.removeStorageSync('userInfo')
          wx.removeStorageSync('token')
          wx.removeStorageSync('wxUser')

          // 重置购物车数量
          app.globalData.shoppingCartCount = 0
          wx.removeTabBarBadge({ index: 2 })

          // 清除页面数据，让按钮变成"登录"
          this.setData({
            wxUser: null,
            userInfo: null
          })

          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1500
          })
        }
      }
    })
  },

  // 跳转到登录页
  goToLogin() {
    wx.navigateTo({
      url: '/pages/auth/login/index'
    })
  }
})
