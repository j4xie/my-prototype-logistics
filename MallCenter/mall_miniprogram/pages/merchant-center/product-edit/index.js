/**
 * 商品发布/编辑页面
 * 支持图片直传到阿里云OSS
 */
const app = getApp()
const api = require('../../../utils/api')
const ossUpload = require('../../../utils/oss')

Page({
  data: {
    isEdit: false,
    productId: null,
    loading: false,
    submitting: false,
    uploadingImages: false,
    form: {
      name: '',
      categoryId: '',
      categoryName: '',
      price: '',
      originalPrice: '',
      stock: '',
      unit: '件',
      description: '',
      images: [],        // 本地临时图片路径
      uploadedUrls: [],  // 已上传到服务器的图片URL
      hasTraceability: false,
      batchNo: ''
    },
    categories: [
      { id: 1, name: '生鲜肉类' },
      { id: 2, name: '蔬菜水果' },
      { id: 3, name: '海鲜水产' },
      { id: 4, name: '酒水饮料' },
      { id: 5, name: '休闲零食' }
    ],
    units: ['件', '斤', '公斤', '盒', '袋', '瓶']
  },

  onShow() {
    // 检查登录状态 - 商品编辑页需要登录才能访问
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
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        isEdit: true,
        productId: options.id
      })
      this.loadProduct(options.id)
    }
  },

  // 加载商品详情
  async loadProduct(id) {
    this.setData({ loading: true })
    try {
      const res = await api.goodsGet(id)
      if (res.code === 200 && res.data) {
        const product = res.data
        // 处理图片URL
        let images = []
        let uploadedUrls = []
        if (product.picUrls) {
          if (typeof product.picUrls === 'string') {
            try {
              uploadedUrls = JSON.parse(product.picUrls)
            } catch (e) {
              uploadedUrls = product.picUrls.split(',').filter(u => u)
            }
          } else if (Array.isArray(product.picUrls)) {
            uploadedUrls = product.picUrls
          }
          images = [...uploadedUrls]
        }

        this.setData({
          form: {
            name: product.name || '',
            categoryId: product.categoryId || '',
            categoryName: product.categoryName || '',
            price: product.salesPrice ? String(product.salesPrice) : '',
            originalPrice: product.marketPrice ? String(product.marketPrice) : '',
            stock: product.stock ? String(product.stock) : '',
            unit: product.unit || '件',
            description: product.description || '',
            images: images,
            uploadedUrls: uploadedUrls,
            hasTraceability: !!product.batchNo,
            batchNo: product.batchNo || ''
          }
        })
      }
    } catch (error) {
      console.error('加载商品失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 输入处理
  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`form.${field}`]: e.detail.value
    })
  },

  // 选择分类
  onCategoryChange(e) {
    const index = e.detail.value
    const category = this.data.categories[index]
    this.setData({
      'form.categoryId': category.id,
      'form.categoryName': category.name
    })
  },

  // 选择单位
  onUnitChange(e) {
    const index = e.detail.value
    this.setData({
      'form.unit': this.data.units[index]
    })
  },

  // 切换溯源
  onTraceabilityChange(e) {
    this.setData({
      'form.hasTraceability': e.detail.value
    })
  },

  // 选择图片
  chooseImage() {
    const maxCount = 9 - this.data.form.images.length
    if (maxCount <= 0) {
      wx.showToast({ title: '最多上传9张图片', icon: 'none' })
      return
    }

    wx.chooseMedia({
      count: maxCount,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (res) => {
        const newImages = res.tempFiles.map(f => f.tempFilePath)
        this.setData({
          'form.images': [...this.data.form.images, ...newImages]
        })
      }
    })
  },

  // 删除图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index
    const images = [...this.data.form.images]
    const uploadedUrls = [...this.data.form.uploadedUrls]

    // 如果删除的是已上传的图片，也要从uploadedUrls中移除
    const deletedImage = images[index]
    const uploadedIndex = uploadedUrls.indexOf(deletedImage)
    if (uploadedIndex > -1) {
      uploadedUrls.splice(uploadedIndex, 1)
    }

    images.splice(index, 1)
    this.setData({
      'form.images': images,
      'form.uploadedUrls': uploadedUrls
    })
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url
    wx.previewImage({
      current: url,
      urls: this.data.form.images
    })
  },

  // 上传单张图片到OSS
  async uploadSingleImage(filePath) {
    try {
      const url = await ossUpload.uploadImage(filePath, 'product')
      return url
    } catch (error) {
      console.error('OSS上传失败:', error)
      throw error
    }
  },

  // 上传所有新图片
  async uploadAllImages() {
    const { images, uploadedUrls } = this.data.form
    const finalUrls = [...uploadedUrls]

    // 找出需要上传的新图片（本地临时路径）
    const newImages = images.filter(img =>
      img.startsWith('wxfile://') ||
      img.startsWith('http://tmp') ||
      img.startsWith('tmp')
    )

    if (newImages.length === 0) {
      return finalUrls
    }

    this.setData({ uploadingImages: true })
    wx.showLoading({ title: '上传图片中...' })

    try {
      for (const img of newImages) {
        const url = await this.uploadSingleImage(img)
        finalUrls.push(url)
      }
      return finalUrls
    } finally {
      this.setData({ uploadingImages: false })
      wx.hideLoading()
    }
  },

  // 验证表单
  validateForm() {
    const { form } = this.data
    if (!form.name) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' })
      return false
    }
    if (!form.categoryId) {
      wx.showToast({ title: '请选择商品分类', icon: 'none' })
      return false
    }
    if (!form.price || parseFloat(form.price) <= 0) {
      wx.showToast({ title: '请输入正确的价格', icon: 'none' })
      return false
    }
    if (!form.stock || parseInt(form.stock) < 0) {
      wx.showToast({ title: '请输入正确的库存', icon: 'none' })
      return false
    }
    if (form.images.length === 0) {
      wx.showToast({ title: '请上传商品图片', icon: 'none' })
      return false
    }
    return true
  },

  // 提交表单
  async submitForm() {
    if (!this.validateForm()) return

    this.setData({ submitting: true })
    try {
      // 1. 先上传图片
      const uploadedUrls = await this.uploadAllImages()

      // 2. 构建商品数据
      const { form, isEdit, productId } = this.data
      const productData = {
        name: form.name,
        categoryId: form.categoryId,
        salesPrice: parseFloat(form.price),
        marketPrice: form.originalPrice ? parseFloat(form.originalPrice) : null,
        stock: parseInt(form.stock),
        unit: form.unit,
        description: form.description,
        picUrls: uploadedUrls,
        batchNo: form.hasTraceability ? form.batchNo : null
      }

      // 3. 调用API保存商品
      let res
      if (isEdit) {
        productData.id = productId
        res = await api.goodsEdit(productData)
      } else {
        res = await api.goodsAdd(productData)
      }

      if (res.code === 200) {
        wx.showToast({
          title: isEdit ? '修改成功' : '发布成功',
          icon: 'success'
        })

        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        throw new Error(res.msg || '保存失败')
      }
    } catch (error) {
      console.error('提交失败:', error)
      wx.showToast({
        title: error.message || '提交失败',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  }
})










