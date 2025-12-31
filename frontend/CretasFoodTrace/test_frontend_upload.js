/**
 * 前端上传组件测试脚本
 * 模拟 React Native 前端通过 mobileUploadAPI 上传文件到 OSS
 */

const https = require('http');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://139.196.165.140:10010';

// 测试登录获取 Token
async function login() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      username: 'factory_admin1',
      password: '123456'
    });

    const options = {
      hostname: '139.196.165.140',
      port: 10010,
      path: '/api/mobile/auth/unified-login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.success && result.data?.token) {
            console.log('✅ 登录成功');
            resolve(result.data.token);
          } else {
            reject(new Error('登录失败: ' + JSON.stringify(result)));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 模拟前端上传函数 (类似 mobileUploadAPI.uploadFile)
async function uploadFile(token, filePath, category = 'products') {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    
    // 创建文件流
    const fileStream = fs.createReadStream(filePath);
    const fileName = path.basename(filePath);
    
    // 模拟 React Native 的 FormData 格式
    form.append('file', fileStream, {
      filename: fileName,
      contentType: getContentType(fileName)
    });
    form.append('category', category);
    form.append('metadata', JSON.stringify({ factoryId: 'F001' }));

    const options = {
      hostname: '139.196.165.140',
      port: 10010,
      path: '/api/mobile/upload',
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`  响应状态: ${res.statusCode}`);
        try {
          const result = JSON.parse(data);
          resolve({ statusCode: res.statusCode, result });
        } catch (e) {
          resolve({ statusCode: res.statusCode, rawData: data });
        }
      });
    });

    req.on('error', reject);
    form.pipe(req);
  });
}

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg'
  };
  return types[ext] || 'application/octet-stream';
}

// 创建测试文件
function createTestFiles() {
  const testDir = '/tmp/frontend_upload_test';
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }
  
  // 创建简单的测试图片 (1x1 PNG)
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
    0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
    0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59, 0xE7, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  fs.writeFileSync(`${testDir}/test_image.png`, pngData);
  
  return testDir;
}

async function main() {
  console.log('========================================');
  console.log('前端上传组件 OSS 集成测试');
  console.log('========================================\n');
  
  try {
    // 1. 登录获取 Token
    console.log('1. 登录获取 Token...');
    const token = await login();
    console.log(`   Token: ${token.substring(0, 50)}...\n`);
    
    // 2. 创建测试文件
    console.log('2. 创建测试文件...');
    const testDir = createTestFiles();
    console.log(`   测试目录: ${testDir}\n`);
    
    // 3. 测试图片上传
    console.log('3. 测试图片上传 (模拟 mobileUploadAPI.uploadFile)...');
    const imageResult = await uploadFile(token, `${testDir}/test_image.png`, 'products');
    console.log('   上传结果:', JSON.stringify(imageResult.result, null, 2));
    
    if (imageResult.result?.success && imageResult.result?.data) {
      console.log('\n   ✅ 图片上传成功!');
      console.log(`   OSS URL: ${imageResult.result.data}`);
      
      // 验证 URL 可访问
      console.log('\n4. 验证 OSS URL 可访问...');
      const ossUrl = imageResult.result.data;
      
      return new Promise((resolve) => {
        const urlObj = new URL(ossUrl.replace('http:', 'https:'));
        require('https').get(ossUrl.startsWith('https') ? ossUrl : ossUrl.replace('http:', 'https:'), (res) => {
          console.log(`   HTTP 状态: ${res.statusCode}`);
          if (res.statusCode === 200) {
            console.log('   ✅ OSS 文件可公开访问\n');
          } else {
            console.log('   ⚠️ 文件可能需要签名访问\n');
          }
          resolve();
        }).on('error', (e) => {
          console.log('   验证失败:', e.message);
          resolve();
        });
      });
    } else {
      console.log('   ❌ 上传失败');
    }
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
  
  console.log('========================================');
  console.log('测试完成');
  console.log('========================================');
}

main();
