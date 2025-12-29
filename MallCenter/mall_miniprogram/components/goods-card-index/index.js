/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 注意：
 * 基于 JooLun 框架二次开发
 */
Component({
  properties: {
    goodsList: {
      type: Object,
      value: []
    },
    // 登录状态，用于控制价格显示
    isLoggedIn: {
      type: Boolean,
      value: false
    }
  },
  data: {

  },
  methods: {
    // 跳转登录页
    goToLogin() {
      wx.showToast({
        title: '请先登录查看价格',
        icon: 'none',
        duration: 1500
      })
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/auth/login/index'
        })
      }, 500)
    }
  }
})