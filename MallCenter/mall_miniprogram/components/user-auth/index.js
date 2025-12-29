/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 注意：
 * 基于 JooLun 框架二次开发
 */
const app = getApp()
Component({
  properties: {
    switchOn: {
      type: Boolean,
      value: true
    },
  },
  data: {
    wxUser: null
  },
  lifetimes: {
    // 组件所在页面的生命周期函数
    ready: function () {
      this.setData({
        wxUser: app.globalData.wxUser
      })
    }
  },
  methods: {
    agreeGetUser(e) {
      if (e.detail.errMsg == 'getUserInfo:ok') {
        app.api.wxUserSave(e.detail)
          .then(res => {
            let wxUser = res.data
            this.setData({
              wxUser: wxUser
            })
            app.globalData.wxUser = wxUser
          })
      }
    },
  }
})