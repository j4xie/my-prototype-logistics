/**
 * 分享推荐页面
 */
const app = getApp()
const api = require('../../../utils/api')

Page({
  data: {
    loading: true,

    // 用户推荐信息
    referralCode: '',
    qrCodeUrl: '',

    // 统计数据
    stats: {
      totalReferrals: 0,
      successCount: 0,
      pendingCount: 0,
      totalRewards: 0
    },

    // 奖励规则
    rules: [
      { icon: '1', title: '分享给好友', desc: '通过微信/朋友圈分享专属二维码' },
      { icon: '2', title: '好友注册', desc: '好友扫码注册并完成首单' },
      { icon: '3', title: '双方获益', desc: '您和好友各获得现金奖励' }
    ],

    // 奖励说明
    rewardInfo: {
      referrerReward: 10,
      refereeReward: 5,
      maxMonthly: 500
    }
  },

  onShow() {
    // 检查登录状态 - 推荐分享页需要登录才能访问
    const wxUser = app.globalData.wxUser
    if (!wxUser || !wxUser.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 1500
      })
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/home/index'
        })
      }, 500)
      return
    }
    // 每次显示时刷新统计
    if (!this.data.loading) {
      this.loadStats()
    }
  },

  onLoad() {
    this.loadReferralData()
  },

  /**
   * 加载推荐数据
   */
  async loadReferralData() {
    this.setData({ loading: true })

    try {
      // 使用统一的 api.js 调用
      const res = await api.getReferralInfo()

      if (res.code === 200 && res.data) {
        this.setData({
          referralCode: res.data.referralCode || '',
          qrCodeUrl: res.data.qrCodeUrl || '',
          stats: res.data.stats || this.data.stats,
          rewardInfo: res.data.rewardInfo || this.data.rewardInfo,
          loading: false
        })
      } else {
        throw new Error(res.msg || '加载失败')
      }
    } catch (error) {
      console.error('加载推荐数据失败:', error)

      // API失败时显示提示并使用默认空数据
      wx.showToast({
        title: '加载推荐数据失败',
        icon: 'none'
      })

      this.setData({
        referralCode: '',
        qrCodeUrl: '',
        loading: false
      })

      // 尝试生成推荐码
      this.tryGenerateReferralCode()
    }
  },

  /**
   * 尝试生成推荐码
   */
  async tryGenerateReferralCode() {
    try {
      const res = await api.generateReferralCode()
      if (res.code === 200 && res.data) {
        this.setData({
          referralCode: res.data.referralCode || res.data,
          qrCodeUrl: res.data.qrCodeUrl || ''
        })
        // 如果没有二维码URL，生成本地二维码
        if (!res.data.qrCodeUrl) {
          this.generateLocalQRCode()
        }
      }
    } catch (error) {
      console.error('生成推荐码失败:', error)
    }
  },

  /**
   * 加载统计数据
   */
  async loadStats() {
    try {
      // 使用统一的 api.js 调用
      const res = await api.getReferralStats()

      if (res.code === 200 && res.data) {
        this.setData({ stats: res.data })
      }
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  },

  /**
   * 生成本地二维码 (演示用)
   */
  generateLocalQRCode() {
    // 实际应该调用后端生成或使用weapp-qrcode库
    this.setData({
      qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' +
        encodeURIComponent(`https://example.com/register?ref=${this.data.referralCode}`)
    })
  },

  /**
   * 复制推荐码
   */
  copyCode() {
    wx.setClipboardData({
      data: this.data.referralCode,
      success: () => {
        wx.showToast({
          title: '推荐码已复制',
          icon: 'success'
        })
      }
    })
  },

  /**
   * 保存二维码到相册
   */
  saveQRCode() {
    if (!this.data.qrCodeUrl) {
      wx.showToast({ title: '二维码生成中', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    wx.downloadFile({
      url: this.data.qrCodeUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.hideLoading()
              wx.showToast({
                title: '已保存到相册',
                icon: 'success'
              })
            },
            fail: (err) => {
              wx.hideLoading()
              if (err.errMsg.includes('auth')) {
                wx.showModal({
                  title: '提示',
                  content: '需要您授权保存图片到相册',
                  success: (res) => {
                    if (res.confirm) {
                      wx.openSetting()
                    }
                  }
                })
              } else {
                wx.showToast({ title: '保存失败', icon: 'none' })
              }
            }
          })
        }
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '下载失败', icon: 'none' })
      }
    })
  },

  /**
   * 分享给好友
   */
  shareToFriend() {
    // 触发按钮的分享
  },

  /**
   * 分享到朋友圈
   */
  shareToMoments() {
    wx.showModal({
      title: '分享到朋友圈',
      content: '请保存二维码图片，然后发布到朋友圈',
      confirmText: '保存图片',
      success: (res) => {
        if (res.confirm) {
          this.saveQRCode()
        }
      }
    })
  },

  /**
   * 查看我的推荐
   */
  viewMyReferrals() {
    wx.navigateTo({
      url: '/pages/referral/my-referrals/index'
    })
  },

  /**
   * 查看推荐奖励
   */
  viewRewards() {
    wx.navigateTo({
      url: '/pages/referral/rewards/index'
    })
  },

  /**
   * 分享给好友
   */
  onShareAppMessage() {
    return {
      title: `我正在使用白垩纪溯源，邀请您一起加入！输入推荐码 ${this.data.referralCode} 可获得新人奖励`,
      path: `/pages/auth/register/index?ref=${this.data.referralCode}`,
      imageUrl: '/public/img/banner_1.jpg'
    }
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: `使用推荐码 ${this.data.referralCode} 注册白垩纪溯源，新人专享优惠！`,
      query: `ref=${this.data.referralCode}`
    }
  }
})
