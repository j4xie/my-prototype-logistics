/**
 * Copyright (C) 2018-2019
 * All rights reserved, Designed By www.joolun.com
 * 注意：
 * 本软件为www.joolun.com开发研制，项目使用请保留此说明
 */
const app = getApp()

Page({
  data: {
    config: app.globalData.config,
    wxUser: null,
    userInfo: null,
    orderCountAll: [],
    unreadCount: 0
  },
  onShow(){
    //更新tabbar购物车数量
    wx.setTabBarBadge({
      index: 2,
      text: app.globalData.shoppingCartCount + ''
    })
    
    let wxUser = app.globalData.wxUser
    this.setData({
      wxUser: wxUser
    })
    this.wxUserGet()
    this.orderCountAll()
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
    // 检查用户是否已绑定商户
    const userInfo = this.data.userInfo
    const merchantId = app.globalData.merchantId || (userInfo && userInfo.merchantId)
    
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
  }
})
