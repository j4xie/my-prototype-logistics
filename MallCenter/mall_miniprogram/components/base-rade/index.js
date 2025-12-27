/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 注意：
 * 基于 JooLun 框架二次开发
 */
Component({
  properties: {
    value: {
      type: Number,
      value: 0
    },
    size: {
      type: String,
      value: 'xxl'
    }
  },
  data: {

  },
  methods: {
    redeHander(e){
      let value = e.currentTarget.dataset.index + 1
      this.setData({
        value: value
      })
      this.triggerEvent('onChange', value)
    }
  }
})