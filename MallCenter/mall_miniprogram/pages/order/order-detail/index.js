/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 注意：
 * 基于 JooLun 框架二次开发
 */
const app = getApp()

Page({
  data: {
    orderInfo: null,
    id: null,
    callPay: false//是否直接调起支付
  },
  onShow() {
    // 检查登录状态 - 订单详情页需要登录才能访问
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
    app.initPage()
      .then(res => {
        this.orderGet(this.data.id)
      })
  },
  onLoad(options) {
    this.setData({
      id: options.id
    })
    if (options.callPay){
      this.setData({
        callPay: true
      })
    }
  },
  orderGet(id){
    let that = this
    app.api.orderGet(id)
      .then(res => {
        let orderInfo = res.data
        if (!orderInfo){
          wx.redirectTo({
            url: '/pages/order/order-list/index'
          })
        }
        this.setData({
          orderInfo: orderInfo
        })
        setTimeout(function () {
          that.setData({
            callPay: false
          })
        }, 4000)
      })
  },
  //复制内容
  copyData(e) {
    wx.setClipboardData({
      data: e.currentTarget.dataset.data
    })
  },
  refunds(e){
    let that = this
    wx.showModal({
      content: '确认申请退款吗？',
      cancelText: '我再想想',
      confirmColor: '#ff0000',
      success(res) {
        if (res.confirm) {
          let orderItemId = e.currentTarget.dataset.data
          app.api.orderRefunds({
            id: orderItemId
          })
          .then(res => {
            let id = that.data.orderInfo.id
            that.orderGet(id)
          })
        }
      }
    })
  
  },
  orderCancel(){
    let id = this.data.orderInfo.id
    this.orderGet(id)
  },
  orderDel(){
    wx.navigateBack()
  },
  unifiedOrder() {
    this.onShow()
  },
  countDownDone(){
    this.orderGet(this.data.id)
  }
})