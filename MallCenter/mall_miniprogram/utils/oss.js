/**
 * 阿里云OSS直传工具
 *
 * 使用方式:
 * 1. 单图上传: const url = await ossUpload.uploadImage(tempFilePath, 'product')
 * 2. 多图上传: const urls = await ossUpload.uploadImages(tempFilePaths, 'product')
 */

import api from './api'

/**
 * 获取上传签名
 * @param {string} type 文件类型 (product/avatar/feedback/merchant)
 * @param {string} filename 原始文件名 (可选)
 * @returns {Promise<Object>} 签名信息
 */
async function getUploadSignature(type = 'product', filename = '') {
  try {
    const res = await api.getOssSignature(type, filename)
    if (res.code === 200 && res.data) {
      return res.data
    }
    throw new Error(res.msg || '获取上传签名失败')
  } catch (error) {
    console.error('获取OSS签名失败:', error)
    throw error
  }
}

/**
 * 上传单张图片到OSS
 * @param {string} filePath 临时文件路径
 * @param {string} type 文件类型 (product/avatar/feedback/merchant)
 * @returns {Promise<string>} 图片URL
 */
async function uploadImage(filePath, type = 'product') {
  try {
    // 1. 获取文件扩展名
    const ext = getFileExtension(filePath)

    // 2. 获取上传签名
    const signature = await getUploadSignature(type, `upload${ext}`)

    // 3. 上传到OSS
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: signature.host,
        filePath: filePath,
        name: 'file',
        formData: {
          'key': signature.key,
          'policy': signature.policy,
          'OSSAccessKeyId': signature.accessKeyId,
          'signature': signature.signature,
          'success_action_status': '200'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            // 返回完整的图片URL
            const imageUrl = signature.host + '/' + signature.key
            console.log('OSS上传成功:', imageUrl)
            resolve(imageUrl)
          } else {
            console.error('OSS上传失败:', res)
            reject(new Error('上传失败: ' + res.statusCode))
          }
        },
        fail: (error) => {
          console.error('OSS上传失败:', error)
          reject(error)
        }
      })
    })
  } catch (error) {
    console.error('uploadImage失败:', error)
    throw error
  }
}

/**
 * 批量上传图片到OSS
 * @param {string[]} filePaths 临时文件路径数组
 * @param {string} type 文件类型
 * @param {Function} onProgress 进度回调 (current, total)
 * @returns {Promise<string[]>} 图片URL数组
 */
async function uploadImages(filePaths, type = 'product', onProgress = null) {
  const urls = []
  const total = filePaths.length

  for (let i = 0; i < total; i++) {
    try {
      const url = await uploadImage(filePaths[i], type)
      urls.push(url)

      if (onProgress) {
        onProgress(i + 1, total)
      }
    } catch (error) {
      console.error(`第${i + 1}张图片上传失败:`, error)
      // 继续上传其他图片，失败的返回null
      urls.push(null)
    }
  }

  return urls
}

/**
 * 选择并上传图片 (一键完成)
 * @param {Object} options 选项
 * @param {number} options.count 最多选择几张 (默认9)
 * @param {string} options.type 文件类型 (默认product)
 * @param {Function} options.onProgress 进度回调
 * @returns {Promise<string[]>} 上传成功的URL数组
 */
async function chooseAndUpload(options = {}) {
  const {
    count = 9,
    type = 'product',
    onProgress = null
  } = options

  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: count,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        try {
          const filePaths = res.tempFiles.map(f => f.tempFilePath)

          wx.showLoading({ title: '上传中...' })

          const urls = await uploadImages(filePaths, type, (current, total) => {
            wx.showLoading({ title: `上传中 ${current}/${total}` })
            if (onProgress) onProgress(current, total)
          })

          wx.hideLoading()

          // 过滤掉上传失败的
          const successUrls = urls.filter(url => url !== null)

          if (successUrls.length === 0) {
            reject(new Error('所有图片上传失败'))
          } else if (successUrls.length < urls.length) {
            wx.showToast({
              title: `${successUrls.length}张上传成功`,
              icon: 'none'
            })
            resolve(successUrls)
          } else {
            resolve(successUrls)
          }
        } catch (error) {
          wx.hideLoading()
          reject(error)
        }
      },
      fail: (error) => {
        if (error.errMsg.includes('cancel')) {
          reject(new Error('用户取消选择'))
        } else {
          reject(error)
        }
      }
    })
  })
}

/**
 * 获取文件扩展名
 * @param {string} filePath 文件路径
 * @returns {string} 扩展名 (如 .jpg)
 */
function getFileExtension(filePath) {
  if (!filePath) return '.jpg'
  const lastDot = filePath.lastIndexOf('.')
  if (lastDot === -1) return '.jpg'
  return filePath.substring(lastDot).toLowerCase()
}

/**
 * 获取OSS配置
 * @returns {Promise<Object>} OSS配置信息
 */
async function getOssConfig() {
  try {
    const res = await api.getOssConfig()
    if (res.code === 200 && res.data) {
      return res.data
    }
    throw new Error(res.msg || '获取OSS配置失败')
  } catch (error) {
    console.error('获取OSS配置失败:', error)
    throw error
  }
}

// 导出模块
module.exports = {
  uploadImage,
  uploadImages,
  chooseAndUpload,
  getUploadSignature,
  getOssConfig,
  getFileExtension
}
