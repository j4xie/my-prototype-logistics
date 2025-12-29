/**
 * 注册完善信息页面
 */
const app = getApp()
const api = require('../../../utils/api')

Page({
  data: {
    userInfo: {},
    formData: {
      companyName: '',
      creditCode: '',
      companyType: '',
      companyTypeLabel: '',
      companyAddress: '',
      contactName: '',
      contactPhone: '',
      position: '',
      email: '',
      purchaseVolume: '',
      purchaseVolumeLabel: '',
      remarks: '',
      referralCode: '' // 推荐码字段
    },
    licenseImage: '',
    agreed: false,
    submitting: false,
    companyTypes: [
      { value: 'manufacturer', label: '生产商/工厂' },
      { value: 'distributor', label: '经销商' },
      { value: 'restaurant', label: '餐饮企业' },
      { value: 'retailer', label: '零售商' },
      { value: 'other', label: '其他' }
    ],
    categories: [
      { value: 'seafood', label: '海鲜水产', checked: false },
      { value: 'meat', label: '肉类禽蛋', checked: false },
      { value: 'vegetable', label: '蔬菜果蔬', checked: false },
      { value: 'grain', label: '粮油米面', checked: false }
    ],
    purchaseVolumes: [
      { value: 'small', label: '500件以下' },
      { value: 'medium', label: '500-2000件' },
      { value: 'large', label: '2000-5000件' },
      { value: 'xlarge', label: '5000件以上' }
    ]
  },

  onLoad(options) {
    // 加载微信用户信息
    const userInfo = wx.getStorageSync('userInfo') || {}
    this.setData({ userInfo })

    // 捕获推荐码参数
    if (options.ref) {
      this.setData({
        'formData.referralCode': options.ref
      })
      console.log('注册页接收到推荐码:', options.ref)
    }
  },

  // 输入变化
  onInputChange(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`formData.${field}`]: e.detail.value
    })
  },

  // 公司类型选择
  onCompanyTypeChange(e) {
    const index = e.detail.value
    const type = this.data.companyTypes[index]
    this.setData({
      'formData.companyType': type.value,
      'formData.companyTypeLabel': type.label
    })
  },

  // 采购量选择
  onVolumeChange(e) {
    const index = e.detail.value
    const volume = this.data.purchaseVolumes[index]
    this.setData({
      'formData.purchaseVolume': volume.value,
      'formData.purchaseVolumeLabel': volume.label
    })
  },

  // 切换品类
  toggleCategory(e) {
    const index = e.currentTarget.dataset.index
    const categories = this.data.categories
    categories[index].checked = !categories[index].checked
    this.setData({ categories })
  },

  // 上传营业执照
  uploadLicense() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        // 验证文件大小
        wx.getFileInfo({
          filePath: tempFilePath,
          success: (info) => {
            if (info.size > 5 * 1024 * 1024) {
              wx.showToast({
                title: '图片大小不能超过5MB',
                icon: 'none'
              })
              return
            }
            this.setData({ licenseImage: tempFilePath })
          }
        })
      }
    })
  },

  // 查看营业执照
  viewLicense() {
    if (this.data.licenseImage) {
      wx.previewImage({
        urls: [this.data.licenseImage]
      })
    }
  },

  // 删除营业执照
  removeLicense() {
    this.setData({ licenseImage: '' })
  },

  // 协议勾选
  onAgreementChange(e) {
    this.setData({
      agreed: e.detail.value.length > 0
    })
  },

  // 查看用户协议
  showUserAgreement() {
    wx.navigateTo({
      url: '/pages/base/webview/index?url=' + encodeURIComponent('https://example.com/user-agreement') + '&title=' + encodeURIComponent('用户服务协议')
    })
  },

  // 查看隐私政策
  showPrivacyPolicy() {
    wx.navigateTo({
      url: '/pages/base/webview/index?url=' + encodeURIComponent('https://example.com/privacy-policy') + '&title=' + encodeURIComponent('隐私政策')
    })
  },

  // 表单验证
  validateForm() {
    const { formData, licenseImage, agreed } = this.data

    if (!formData.companyName.trim()) {
      wx.showToast({ title: '请输入公司名称', icon: 'none' })
      return false
    }

    if (!formData.creditCode.trim() || formData.creditCode.length !== 18) {
      wx.showToast({ title: '请输入正确的统一社会信用代码', icon: 'none' })
      return false
    }

    if (!formData.companyType) {
      wx.showToast({ title: '请选择公司类型', icon: 'none' })
      return false
    }

    if (!formData.companyAddress.trim()) {
      wx.showToast({ title: '请输入公司地址', icon: 'none' })
      return false
    }

    if (!licenseImage) {
      wx.showToast({ title: '请上传营业执照照片', icon: 'none' })
      return false
    }

    if (!formData.contactName.trim()) {
      wx.showToast({ title: '请输入联系人姓名', icon: 'none' })
      return false
    }

    const phoneReg = /^1[3-9]\d{9}$/
    if (!phoneReg.test(formData.contactPhone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return false
    }

    if (!agreed) {
      wx.showToast({ title: '请先阅读并同意用户协议', icon: 'none' })
      return false
    }

    return true
  },

  // 提交注册
  async handleSubmit() {
    if (!this.validateForm()) return

    this.setData({ submitting: true })

    try {
      const { formData, licenseImage, categories } = this.data

      // 先上传营业执照（使用统一的 api.js）
      let licenseUrl = ''
      if (licenseImage) {
        const uploadRes = await api.uploadFile(licenseImage)
        licenseUrl = uploadRes.data?.url || uploadRes.url || ''
      }

      // 获取选中的品类
      const selectedCategories = categories
        .filter(c => c.checked)
        .map(c => c.value)

      // 构建注册数据（包含推荐码）
      const registerData = {
        companyName: formData.companyName,
        creditCode: formData.creditCode,
        companyType: formData.companyType,
        companyAddress: formData.companyAddress,
        businessLicenseImage: licenseUrl || licenseImage,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        position: formData.position,
        email: formData.email,
        categories: selectedCategories,
        purchaseVolume: formData.purchaseVolume,
        remarks: formData.remarks,
        referralCode: formData.referralCode // 提交推荐码
      }

      // 调用注册API（使用统一的 api.js）
      const res = await api.registerMerchant(registerData)

      if (res.code === 0 || res.code === 200) {
        // 更新本地用户信息
        const userInfo = wx.getStorageSync('userInfo') || {}
        userInfo.merchantId = res.data.merchantId
        userInfo.merchantStatus = 'pending'
        wx.setStorageSync('userInfo', userInfo)

        wx.showModal({
          title: '提交成功',
          content: '您的注册信息已提交，平台将在1-3个工作日内完成审核。审核结果将通过微信通知您。',
          showCancel: false,
          confirmText: '知道了',
          success: () => {
            wx.switchTab({
              url: '/pages/home/index'
            })
          }
        })
      } else {
        throw new Error(res.message || res.msg || '注册失败')
      }
    } catch (error) {
      console.error('注册失败:', error)
      wx.showToast({
        title: error.message || '注册失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
