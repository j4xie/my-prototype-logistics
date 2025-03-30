// Figma API工具函数
// 这个文件提供了基本的Figma API调用功能

require('dotenv').config(); // 加载.env文件中的环境变量

const axios = require('axios');
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;

// 基本API请求函数
async function fetchFromFigma(endpoint, params = {}) {
  try {
    const response = await axios({
      method: 'GET',
      url: `https://api.figma.com/v1/${endpoint}`,
      headers: {
        'X-Figma-Token': FIGMA_TOKEN
      },
      params
    });
    return response.data;
  } catch (error) {
    console.error('Figma API请求失败:', error.response?.data || error.message);
    throw error;
  }
}

// 获取文件信息
async function getFile(fileId) {
  return fetchFromFigma(`files/${fileId}`);
}

// 获取文件的节点信息
async function getFileNodes(fileId, nodeIds) {
  const idsParam = Array.isArray(nodeIds) ? nodeIds.join(',') : nodeIds;
  return fetchFromFigma(`files/${fileId}/nodes`, { ids: idsParam });
}

// 获取文件中的组件
async function getFileComponents(fileId) {
  return fetchFromFigma(`files/${fileId}/components`);
}

// 获取图像URL
async function getImageFills(fileId, format = 'png', scale = 1) {
  return fetchFromFigma(`files/${fileId}/images`, { format, scale });
}

// 获取评论
async function getComments(fileId) {
  return fetchFromFigma(`files/${fileId}/comments`);
}

// 发布评论
async function postComment(fileId, message, clientMeta = {}, parentId = null) {
  try {
    const response = await axios({
      method: 'POST',
      url: `https://api.figma.com/v1/files/${fileId}/comments`,
      headers: {
        'X-Figma-Token': FIGMA_TOKEN,
        'Content-Type': 'application/json'
      },
      data: {
        message,
        client_meta: clientMeta,
        ...(parentId && { parent_id: parentId })
      }
    });
    return response.data;
  } catch (error) {
    console.error('发布评论失败:', error.response?.data || error.message);
    throw error;
  }
}

// 使用示例
async function exampleUsage() {
  // 这里需要替换为你实际的Figma文件ID
  const fileId = '你的文件ID';
  
  try {
    // 获取文件信息
    const fileInfo = await getFile(fileId);
    console.log('文件信息:', fileInfo.name);
    
    // 获取画布信息
    const canvas = fileInfo.document.children[0];
    console.log('画布信息:', canvas.name);
    
    // 获取画布中的所有元素
    const elements = canvas.children;
    console.log(`画布包含 ${elements.length} 个元素`);
    
    // 提取元素ID
    const elementIds = elements.map(el => el.id);
    
    // 获取特定元素的详细信息
    if (elementIds.length > 0) {
      const nodeInfo = await getFileNodes(fileId, elementIds[0]);
      console.log('节点详情:', nodeInfo);
    }
    
    // 获取组件
    const components = await getFileComponents(fileId);
    console.log('组件信息:', components);
    
  } catch (error) {
    console.error('示例运行失败:', error);
  }
}

module.exports = {
  getFile,
  getFileNodes,
  getFileComponents,
  getImageFills,
  getComments,
  postComment,
  exampleUsage
};

// 如果直接运行此文件，则执行示例
if (require.main === module) {
  exampleUsage().catch(console.error);
} 