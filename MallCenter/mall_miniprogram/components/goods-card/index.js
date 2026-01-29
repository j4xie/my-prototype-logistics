/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 注意：
 * 基于 JooLun 框架二次开发
 */
const app = getApp()
const tracker = require('../../utils/tracker')

Component({
  properties: {
    goodsList: {
      type: Object,
      value: []
    },
    // 来源标记，用于追踪点击来源
    source: {
      type: String,
      value: ''
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
    },

    // 图片加载失败，替换为默认图
    onImageError(e) {
      const index = e.currentTarget.dataset.index
      this.setData({
        [`goodsList[${index}].picUrls[0]`]: '/public/img/no_pic.png'
      })
    },

    // 商品点击事件
    onProductTap(e) {
      const product = e.currentTarget.dataset.product
      if (!product || !product.id) return

      // 追踪点击行为
      const wxUser = app.globalData.wxUser
      if (wxUser && wxUser.id) {
        tracker.trackView({
          productId: product.id,
          productName: product.name,
          source: this.properties.source || 'goods_list',
          duration: 0
        })
      }

      // 跳转到商品详情页，携带来源参数
      const sourceParam = this.properties.source ? `&source=${this.properties.source}` : ''
      wx.navigateTo({
        url: `/pages/goods/goods-detail/index?id=${product.id}${sourceParam}`
      })
    }
  }
})