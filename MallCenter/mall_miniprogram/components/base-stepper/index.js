/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 注意：
 * 基于 JooLun 框架二次开发
 */
Component({
  properties: {
    max: {
      type: Number,
      value: 0
    },
    min: {
      type: Number,
      value: 0
    },
    stNum: {
      type: Number,
      value: 0
    },
    customClass:{
      type: String,
      value: ''
    }
  },
  data: {

  },
  methods: {
    stNumMinus() {
      this.setData({
        stNum: this.data.stNum - 1
      })
      this.triggerEvent('numChange', this.data.stNum)
    },
    stNumAdd() {
      this.setData({
        stNum: this.data.stNum + 1
      })
      this.triggerEvent('numChange', this.data.stNum)
    },
    numChange(e){
      this.triggerEvent('numChange', val)
    }
  }
})