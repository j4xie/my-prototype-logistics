/**
 * 商品发布/编辑页面
 */
const app = getApp()

Page({
  data: {
    isEdit: false,
    productId: null,
    loading: false,
    submitting: false,
    form: {
      name: '',
      categoryId: '',
      categoryName: '',
      price: '',
      originalPrice: '',
      stock: '',
      unit: '件',
      description: '',
      images: [],
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
      // 模拟加载商品数据
      const product = {
        name: '精选牛肉',
        categoryId: 1,
        categoryName: '生鲜肉类',
        price: '128.00',
        originalPrice: '158.00',
        stock: '50',
        unit: '斤',
        description: '优质进口牛肉，新鲜直达',
        images: ['/public/img/no_pic.png'],
        hasTraceability: true,
        batchNo: 'FAC001-20250125-001'
      }
      this.setData({ form: product })
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
    images.splice(index, 1)
    this.setData({ 'form.images': images })
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url
    wx.previewImage({
      current: url,
      urls: this.data.form.images
    })
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
      // 模拟提交
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      wx.showToast({
        title: this.data.isEdit ? '修改成功' : '发布成功',
        icon: 'success'
      })
      
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('提交失败:', error)
      wx.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})




