/**
 * 商户绑定页面
 */
const app = getApp()

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
      contactPhone: ''
    },
    licenseImage: '',
    submitting: false,
    companyTypes: [
      { value: 'manufacturer', label: '生产商/工厂' },
      { value: 'distributor', label: '经销商' },
      { value: 'restaurant', label: '餐饮企业' },
      { value: 'retailer', label: '零售商' },
      { value: 'other', label: '其他' }
    ]
  },

  onLoad(options) {
    // 检查是否已登录
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo || !userInfo.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/auth/login/index'
        })
      }, 1500)
      return
    }

    this.setData({ userInfo })
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

  // 上传营业执照
  uploadLicense() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
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

  // 表单验证
  validateForm() {
    const { formData, licenseImage } = this.data

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

    return true
  },

  // 提交绑定
  async handleSubmit() {
    if (!this.validateForm()) return

    this.setData({ submitting: true })

    try {
      const { formData, licenseImage, userInfo } = this.data

      // 先上传营业执照
      let licenseUrl = ''
      if (licenseImage) {
        const uploadRes = await this.uploadFile(licenseImage)
        licenseUrl = uploadRes.url
      }

      // 构建绑定数据
      const bindData = {
        userId: userInfo.id,
        companyName: formData.companyName,
        creditCode: formData.creditCode,
        companyType: formData.companyType,
        companyAddress: formData.companyAddress,
        businessLicenseImage: licenseUrl || licenseImage,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone
      }

      // 调用绑定API
      const res = await app.api.bindMerchant(bindData)

      if (res.code === 0) {
        // 更新本地用户信息
        const newUserInfo = { ...userInfo }
        newUserInfo.merchantId = res.data.merchantId
        newUserInfo.merchantStatus = 'pending'
        wx.setStorageSync('userInfo', newUserInfo)

        wx.showModal({
          title: '提交成功',
          content: '您的绑定信息已提交，平台将在1-3个工作日内完成审核。审核结果将通过微信通知您。',
          showCancel: false,
          confirmText: '知道了',
          success: () => {
            wx.switchTab({
              url: '/pages/home/index'
            })
          }
        })
      } else {
        throw new Error(res.message || '绑定失败')
      }
    } catch (error) {
      console.error('绑定失败:', error)
      wx.showToast({
        title: error.message || '绑定失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 上传文件
  uploadFile(filePath) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: app.globalData.config.baseUrl + '/api/upload',
        filePath: filePath,
        name: 'file',
        header: {
          'Authorization': 'Bearer ' + wx.getStorageSync('accessToken')
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data)
            if (data.code === 0) {
              resolve(data.data)
            } else {
              reject(new Error(data.message || '上传失败'))
            }
          } catch (e) {
            reject(new Error('上传失败'))
          }
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  }
})
