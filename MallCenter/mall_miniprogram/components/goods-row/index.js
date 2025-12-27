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
    }
  },
  data: {

  },
  methods: {
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