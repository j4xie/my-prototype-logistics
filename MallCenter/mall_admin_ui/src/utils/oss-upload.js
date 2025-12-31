/**
 * OSS 直传上传工具
 * 用于管理后台直传图片到阿里云OSS
 */
import { getOssSignature } from '@/api/oss'

/**
 * 上传文件到OSS
 * @param {File} file 文件对象
 * @param {string} type 文件类型 (product/avatar/feedback/merchant)
 * @param {Function} onProgress 进度回调 (percent)
 * @returns {Promise<string>} 上传成功后的URL
 */
export async function uploadToOss(file, type = 'product', onProgress = null) {
  try {
    // 1. 获取上传签名
    const res = await getOssSignature(type, file.name)
    if (res.code !== 200 || !res.data) {
      throw new Error(res.msg || '获取上传签名失败')
    }

    const signature = res.data

    // 2. 构建FormData
    const formData = new FormData()
    formData.append('key', signature.key)
    formData.append('policy', signature.policy)
    formData.append('OSSAccessKeyId', signature.accessKeyId)
    formData.append('signature', signature.signature)
    formData.append('success_action_status', '200')
    formData.append('file', file)

    // 3. 使用XMLHttpRequest上传 (支持进度)
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.open('POST', signature.host, true)

      // 进度回调
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100)
            onProgress(percent)
          }
        }
      }

      xhr.onload = () => {
        if (xhr.status === 200) {
          // 构建完整URL
          const imageUrl = signature.host + '/' + signature.key
          console.log('OSS上传成功:', imageUrl)
          resolve(imageUrl)
        } else {
          console.error('OSS上传失败:', xhr.status, xhr.responseText)
          reject(new Error('上传失败: ' + xhr.status))
        }
      }

      xhr.onerror = () => {
        console.error('OSS上传网络错误')
        reject(new Error('网络错误'))
      }

      xhr.send(formData)
    })

  } catch (error) {
    console.error('uploadToOss失败:', error)
    throw error
  }
}

/**
 * 获取文件扩展名
 * @param {string} filename 文件名
 * @returns {string} 扩展名 (如 .jpg)
 */
export function getFileExtension(filename) {
  if (!filename) return '.jpg'
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return '.jpg'
  return filename.substring(lastDot).toLowerCase()
}

export default {
  uploadToOss,
  getFileExtension
}
