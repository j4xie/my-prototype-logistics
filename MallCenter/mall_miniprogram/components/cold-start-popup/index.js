/**
 * Copyright (C) 2024-2025
 * 食品商城小程序
 * 冷启动偏好设置弹窗组件
 * 只有首次使用的用户会看到此弹窗，选择偏好后不再显示
 */
const app = getApp()

Component({
  properties: {
    // 是否显示弹窗
    show: {
      type: Boolean,
      value: false
    },
    // 微信用户ID
    wxUserId: {
      type: String,
      value: ''
    }
  },

  data: {
    // 商品分类列表
    categories: [],
    // 选中的分类ID列表
    selectedCategories: [],
    // 价格区间选项
    priceRanges: [
      { id: 'low', name: '实惠优选', desc: '50元以下', selected: false },
      { id: 'medium', name: '品质之选', desc: '50-200元', selected: false },
      { id: 'high', name: '高端精选', desc: '200元以上', selected: false }
    ],
    // 选中的价格区间
    selectedPriceRange: '',
    // 是否正在提交
    submitting: false,
    // 当前步骤 1=选分类 2=选价格区间
    step: 1
  },

  lifetimes: {
    attached() {
      // 如果没有传入wxUserId，从全局获取
      // 注意：不在这里加载分类，等弹窗显示且 session 就绪后再加载
      if (!this.data.wxUserId) {
        const wxUser = app.globalData.wxUser
        if (wxUser && wxUser.id) {
          this.setData({ wxUserId: wxUser.id })
        }
      }
    }
  },

  observers: {
    // 监听 show 属性变化，只有弹窗显示时才加载分类
    'show': function(show) {
      if (show && this.data.categories.length === 0) {
        this.loadCategories()
      }
    }
  },

  methods: {
    // 加载商品分类
    loadCategories() {
      // 检查 session 是否就绪
      const thirdSession = app.globalData.thirdSession
      if (!thirdSession) {
        console.log('冷启动弹窗: 等待 session 就绪...')
        // session 未就绪，500ms 后重试
        setTimeout(() => this.loadCategories(), 500)
        return
      }

      app.api.goodsCategoryGet()
        .then(res => {
          if (res.data && res.data.length > 0) {
            // 只取一级分类
            const categories = res.data.map(cat => ({
              id: cat.id,
              name: cat.name,
              icon: cat.picUrl || '/public/img/no_pic.png',
              selected: false
            }))
            this.setData({ categories })
            console.log('冷启动弹窗: 加载了', categories.length, '个分类')
          }
        })
        .catch(err => {
          console.error('加载分类失败:', err)
          // 如果是 session 错误，延迟重试
          if (err && err.code === 60002) {
            console.log('冷启动弹窗: session 错误，1秒后重试')
            setTimeout(() => this.loadCategories(), 1000)
          }
        })
    },

    // 切换分类选中状态
    toggleCategory(e) {
      const { index } = e.currentTarget.dataset
      const categories = this.data.categories
      categories[index].selected = !categories[index].selected

      const selectedCategories = categories
        .filter(c => c.selected)
        .map(c => c.id)

      this.setData({
        categories,
        selectedCategories
      })
    },

    // 选择价格区间
    selectPriceRange(e) {
      const { id } = e.currentTarget.dataset
      const priceRanges = this.data.priceRanges.map(p => ({
        ...p,
        selected: p.id === id
      }))

      this.setData({
        priceRanges,
        selectedPriceRange: id
      })
    },

    // 下一步
    nextStep() {
      if (this.data.selectedCategories.length === 0) {
        wx.showToast({
          title: '请选择至少一个喜欢的分类',
          icon: 'none'
        })
        return
      }
      this.setData({ step: 2 })
    },

    // 上一步
    prevStep() {
      this.setData({ step: 1 })
    },

    // 跳过设置
    skip() {
      this.triggerEvent('complete', { skipped: true })
    },

    // 完成设置
    complete() {
      if (this.data.selectedCategories.length === 0) {
        wx.showToast({
          title: '请选择至少一个喜欢的分类',
          icon: 'none'
        })
        return
      }

      if (!this.data.selectedPriceRange) {
        wx.showToast({
          title: '请选择价格偏好',
          icon: 'none'
        })
        return
      }

      this.setData({ submitting: true })

      // 构建偏好数据
      const selectedCategoryNames = this.data.categories
        .filter(c => c.selected)
        .map(c => c.name)

      const preferences = {
        categories: selectedCategoryNames,
        priceRange: {
          range: this.data.selectedPriceRange,
          label: this.data.priceRanges.find(p => p.id === this.data.selectedPriceRange)?.name
        }
      }

      // 调用API保存偏好
      app.api.completeColdStart({
        wxUserId: this.data.wxUserId,
        preferences: preferences
      })
        .then(res => {
          wx.showToast({
            title: '设置成功',
            icon: 'success'
          })
          this.triggerEvent('complete', {
            skipped: false,
            preferences: preferences
          })
        })
        .catch(err => {
          console.error('保存偏好失败:', err)
          wx.showToast({
            title: '保存失败，请重试',
            icon: 'none'
          })
        })
        .finally(() => {
          this.setData({ submitting: false })
        })
    }
  }
})
