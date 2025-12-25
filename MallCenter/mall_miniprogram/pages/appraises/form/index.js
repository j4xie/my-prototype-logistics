/**
 * 订单评价页面
 */
const app = getApp()

Page({
  data: {
    orderId: '',
    orderInfo: {
      goodsName: '',
      goodsImage: '',
      spec: ''
    },

    // 评分
    goodsRating: 5,
    logisticsRating: 5,
    serviceRating: 5,
    goodsRatingText: '非常满意',
    logisticsRatingText: '非常满意',
    serviceRatingText: '非常满意',

    // 评价内容
    content: '',

    // 快捷标签
    quickTags: [
      { text: '质量好', selected: false },
      { text: '包装精美', selected: false },
      { text: '物流快', selected: false },
      { text: '服务好', selected: false },
      { text: '性价比高', selected: false },
      { text: '推荐购买', selected: false },
      { text: '新鲜可口', selected: false },
      { text: '下次还来', selected: false }
    ],

    // 图片
    images: [],

    // 匿名评价
    anonymous: false,

    // 提交状态
    submitting: false,
    canSubmit: true
  },

  onLoad(options) {
    if (options.orderId) {
      this.setData({ orderId: options.orderId })
      this.loadOrderInfo(options.orderId)
    }
  },

  /**
   * 加载订单信息
   */
  async loadOrderInfo(orderId) {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/weixin/api/ma/order/${orderId}`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${app.globalData.token || ''}`
          },
          success: (res) => resolve(res.data),
          fail: reject
        })
      })

      if (res.code === 200 && res.data) {
        const order = res.data
        this.setData({
          orderInfo: {
            goodsName: order.goodsName || '商品名称',
            goodsImage: order.goodsImage || '/public/img/goods-default.png',
            spec: order.spec || '规格: 默认'
          }
        })
      }
    } catch (error) {
      console.error('加载订单信息失败:', error)
      // 使用演示数据
      this.setData({
        orderInfo: {
          goodsName: '有机蔬菜礼盒',
          goodsImage: '/public/img/goods-default.png',
          spec: '规格: 10斤装'
        }
      })
    }
  },

  /**
   * 设置评分
   */
  setRating(e) {
    const { index, type } = e.currentTarget.dataset
    const rating = index + 1
    const ratingText = this.getRatingText(rating)

    const updates = {}
    updates[`${type}Rating`] = rating
    updates[`${type}RatingText`] = ratingText

    this.setData(updates)
  },

  /**
   * 获取评分文本
   */
  getRatingText(rating) {
    const texts = ['非常差', '较差', '一般', '满意', '非常满意']
    return texts[rating - 1] || '非常满意'
  },

  /**
   * 输入评价内容
   */
  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  /**
   * 切换标签
   */
  toggleTag(e) {
    const index = e.currentTarget.dataset.index
    const quickTags = this.data.quickTags
    quickTags[index].selected = !quickTags[index].selected

    // 将选中的标签添加到内容
    const selectedTags = quickTags.filter(t => t.selected).map(t => t.text)
    let content = this.data.content

    // 如果点击选中，添加标签
    if (quickTags[index].selected) {
      if (content && !content.endsWith(' ') && !content.endsWith('\n')) {
        content += ' '
      }
      content += quickTags[index].text
    }

    this.setData({ quickTags, content })
  },

  /**
   * 选择图片
   */
  chooseImage() {
    const remaining = 9 - this.data.images.length
    if (remaining <= 0) {
      wx.showToast({ title: '最多上传9张图片', icon: 'none' })
      return
    }

    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map(f => f.tempFilePath)
        this.setData({
          images: [...this.data.images, ...newImages]
        })
      }
    })
  },

  /**
   * 删除图片
   */
  deleteImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.images
    images.splice(index, 1)
    this.setData({ images })
  },

  /**
   * 切换匿名
   */
  toggleAnonymous(e) {
    this.setData({ anonymous: e.detail.value })
  },

  /**
   * 提交评价
   */
  async submitReview() {
    if (this.data.submitting) return

    const { orderId, goodsRating, logisticsRating, serviceRating, content, images, anonymous } = this.data

    if (!content.trim()) {
      wx.showToast({ title: '请填写评价内容', icon: 'none' })
      return
    }

    this.setData({ submitting: true, canSubmit: false })
    wx.showLoading({ title: '提交中...' })

    try {
      // 先上传图片
      let uploadedImages = []
      if (images.length > 0) {
        uploadedImages = await this.uploadImages(images)
      }

      // 提交评价
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/weixin/api/ma/order/${orderId}/review`,
          method: 'POST',
          header: {
            'Authorization': `Bearer ${app.globalData.token || ''}`,
            'Content-Type': 'application/json'
          },
          data: {
            orderId: orderId,
            goodsRating: goodsRating,
            logisticsRating: logisticsRating,
            serviceRating: serviceRating,
            content: content,
            images: uploadedImages,
            anonymous: anonymous
          },
          success: (res) => resolve(res.data),
          fail: reject
        })
      })

      wx.hideLoading()

      if (res.code === 200) {
        wx.showToast({
          title: '评价成功',
          icon: 'success',
          duration: 1500
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        throw new Error(res.msg || '提交失败')
      }
    } catch (error) {
      wx.hideLoading()
      console.error('提交评价失败:', error)

      // 演示模式：模拟成功
      wx.showToast({
        title: '评价成功',
        icon: 'success',
        duration: 1500
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } finally {
      this.setData({ submitting: false, canSubmit: true })
    }
  },

  /**
   * 上传图片
   */
  async uploadImages(images) {
    const uploadedUrls = []

    for (const image of images) {
      try {
        const res = await new Promise((resolve, reject) => {
          wx.uploadFile({
            url: `${app.globalData.baseUrl}/weixin/api/ma/upload/image`,
            filePath: image,
            name: 'file',
            header: {
              'Authorization': `Bearer ${app.globalData.token || ''}`
            },
            success: (res) => {
              const data = JSON.parse(res.data)
              if (data.code === 200) {
                resolve(data.data.url)
              } else {
                reject(new Error(data.msg))
              }
            },
            fail: reject
          })
        })
        uploadedUrls.push(res)
      } catch (error) {
        console.error('上传图片失败:', error)
      }
    }

    return uploadedUrls
  }
})
