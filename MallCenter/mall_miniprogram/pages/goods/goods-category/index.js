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
    TabCur: 0,
    MainCur: 0,
    VerticalNavTop: 0,
    goodsCategory: [],
    load: true
  },
  onLoad() { 
    app.initPage()
      .then(res => {
        this.goodsCategoryGet()
      })
  },
  onShow() {
    // 检查登录状态 - 分类页需要登录才能访问
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

    //更新tabbar购物车数量
    wx.setTabBarBadge({
      index: 2,
      text: app.globalData.shoppingCartCount + ''
    })
  },
  goodsCategoryGet() {
    app.api.goodsCategoryGet()
      .then(res => {
        let goodsCategory = res.data
        this.setData({
          goodsCategory: goodsCategory
        })
      })
  },
  tabSelect(e) {
    this.setData({
      TabCur: e.currentTarget.dataset.id,
      MainCur: e.currentTarget.dataset.id,
      VerticalNavTop: (e.currentTarget.dataset.id - 1) * 50
    })
  },
  VerticalMain(e) {
    let that = this
    let list = this.data.goodsCategory
    let tabHeight = 0
    if (this.data.load) {
      for (let i = 0; i < list.length; i++) {
        let view = wx.createSelectorQuery().select("#main-" + i)
        view.fields({
          size: true
        }, data => {
          list[i].top = tabHeight
          tabHeight = tabHeight + data.height
          list[i].bottom = tabHeight
        }).exec()
      }
      that.setData({
        load: false,
        goodsCategory: list
      })
    }
    let scrollTop = e.detail.scrollTop + 20
    for (let i = 0; i < list.length; i++) {
      if (scrollTop > list[i].top && scrollTop < list[i].bottom) {
        that.setData({
          VerticalNavTop: (i - 1) * 50,
          TabCur: i
        })
        return false
      }
    }
  }
})
