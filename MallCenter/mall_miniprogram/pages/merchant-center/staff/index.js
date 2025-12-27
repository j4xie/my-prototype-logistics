/**
 * 员工管理页面
 */
const app = getApp()

Page({
  data: {
    loading: false,
    merchantId: '',
    staffList: [],
    roles: ['管理员', '店员', '配送员', '客服']
  },

  onShow() {
    // 检查登录状态 - 员工管理页需要登录才能访问
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

  onLoad() {
    const merchantId = app.globalData.merchantId || wx.getStorageSync('merchantId')
    if (merchantId) {
      this.setData({ merchantId })
      this.loadStaffList()
    } else {
      wx.showToast({
        title: '未找到商户信息',
        icon: 'none'
      })
    }
  },

  onPullDownRefresh() {
    this.loadStaffList().then(() => wx.stopPullDownRefresh())
  },

  // 加载员工列表
  async loadStaffList() {
    if (!this.data.merchantId) return
    
    this.setData({ loading: true })
    try {
      const res = await app.api.getMerchantStaffList(this.data.merchantId)
      if (res.code === 200) {
        this.setData({ staffList: res.data })
      } else {
        wx.showToast({ title: res.msg || '加载失败', icon: 'none' })
      }
    } catch (error) {
      console.error('加载员工列表失败:', error)
      wx.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 添加员工
  addStaff() {
    wx.showModal({
      title: '添加员工',
      editable: true,
      placeholderText: '请输入员工用户ID',
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            const saveRes = await app.api.addMerchantStaff(this.data.merchantId, {
              userId: res.content,
              role: 'staff'
            })
            if (saveRes.code === 200) {
              wx.showToast({ title: '添加成功', icon: 'success' })
              this.loadStaffList()
            } else {
              wx.showToast({ title: saveRes.msg || '添加失败', icon: 'none' })
            }
          } catch (error) {
            wx.showToast({ title: '添加失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 编辑员工
  editStaff(e) {
    const staff = e.currentTarget.dataset.staff
    wx.showActionSheet({
      itemList: ['修改角色', staff.status === 1 ? '禁用账号' : '启用账号', '移除员工'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.changeRole(staff)
        } else if (res.tapIndex === 1) {
          this.toggleStatus(staff)
        } else if (res.tapIndex === 2) {
          this.removeStaff(staff)
        }
      }
    })
  },

  // 修改角色
  changeRole(staff) {
    wx.showActionSheet({
      itemList: this.data.roles,
      success: async (res) => {
        const roleMap = { '管理员': 'admin', '店员': 'staff', '配送员': 'delivery', '客服': 'service' }
        const roleLabel = this.data.roles[res.tapIndex]
        const newRole = roleMap[roleLabel] || 'staff'
        
        try {
          const updateRes = await app.api.updateMerchantStaff(this.data.merchantId, staff.id, {
            role: newRole
          })
          if (updateRes.code === 200) {
            wx.showToast({ title: `已设为${roleLabel}`, icon: 'success' })
            this.loadStaffList()
          } else {
            wx.showToast({ title: updateRes.msg || '修改失败', icon: 'none' })
          }
        } catch (error) {
          wx.showToast({ title: '网络错误', icon: 'none' })
        }
      }
    })
  },

  // 切换状态
  toggleStatus(staff) {
    const newStatus = staff.status === 1 ? 0 : 1
    const action = newStatus === 1 ? '启用' : '禁用'
    wx.showModal({
      title: '确认操作',
      content: `确定要${action}该员工账号吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const updateRes = await app.api.updateMerchantStaff(this.data.merchantId, staff.id, {
              status: newStatus
            })
            if (updateRes.code === 200) {
              wx.showToast({ title: `已${action}`, icon: 'success' })
              this.loadStaffList()
            } else {
              wx.showToast({ title: updateRes.msg || '操作失败', icon: 'none' })
            }
          } catch (error) {
            wx.showToast({ title: '网络错误', icon: 'none' })
          }
        }
      }
    })
  },

  // 移除员工
  removeStaff(staff) {
    wx.showModal({
      title: '确认移除',
      content: '移除后该员工将无法访问店铺，确定要移除吗？',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          try {
            const delRes = await app.api.removeMerchantStaff(this.data.merchantId, staff.id)
            if (delRes.code === 200) {
              wx.showToast({ title: '已移除', icon: 'success' })
              this.loadStaffList()
            } else {
              wx.showToast({ title: delRes.msg || '移除失败', icon: 'none' })
            }
          } catch (error) {
            wx.showToast({ title: '网络错误', icon: 'none' })
          }
        }
      }
    })
  },

  // 拨打电话
  callStaff(e) {
    const phone = e.currentTarget.dataset.phone
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone.replace(/\*/g, '0') })
    }
  }
})

