# 宝塔面板API使用指南

## 基本配置

### API连接信息
- **面板地址**: `https://139.196.165.140:16435` (使用HTTPS，不是HTTP)
- **API密钥**: `Fw3rqkRqAashK9uNDsFxvst31YSbBmUb`
- **管理的服务器**: 139.196.165.140 (应用服务器)

### 重要注意事项
1. ⚠️ **必须使用HTTPS协议**，不能使用HTTP
2. ⚠️ **必须添加IP白名单**，否则会返回IP校验失败
3. ⚠️ **使用 `-k` 参数**忽略SSL证书验证

## API签名算法

### 签名计算方式
```javascript
// 1. 获取当前时间戳
request_time = Unix时间戳

// 2. 计算签名
md5_api_sk = md5(api_sk)
request_token = md5(request_time + md5_api_sk)
```

### Python实现
```python
import hashlib
import time

api_sk = "Fw3rqkRqAashK9uNDsFxvst31YSbBmUb"
request_time = str(int(time.time()))
md5_api_sk = hashlib.md5(api_sk.encode()).hexdigest()
request_token = hashlib.md5((request_time + md5_api_sk).encode()).hexdigest()
```

### Bash实现
```bash
TIME_TOKEN=$(python3 << 'PYTHON_EOF'
import hashlib
import time
api_sk = "Fw3rqkRqAashK9uNDsFxvst31YSbBmUb"
request_time = str(int(time.time()))
md5_api_sk = hashlib.md5(api_sk.encode()).hexdigest()
request_token = hashlib.md5((request_time + md5_api_sk).encode()).hexdigest()
print(f"{request_time}|{request_token}")
PYTHON_EOF
)

REQUEST_TIME=$(echo $TIME_TOKEN | cut -d'|' -f1)
REQUEST_TOKEN=$(echo $TIME_TOKEN | cut -d'|' -f2)
```

## 常用API接口

### 1. 系统信息接口

#### 获取系统基础统计
```bash
curl -k -X POST "https://139.196.165.140:16435/system?action=GetSystemTotal" \
  -d "request_time=$REQUEST_TIME" \
  -d "request_token=$REQUEST_TOKEN"
```

**返回示例**:
```json
{
    "memTotal": 3563,
    "memFree": 413,
    "cpuNum": 2,
    "cpuRealUsed": 17.0,
    "time": "63天",
    "system": "Alibaba Cloud 3 (OpenAnolis Edition) x86_64",
    "version": "11.0.0"
}
```

#### 获取磁盘分区信息
```bash
curl -k -X POST "https://139.196.165.140:16435/system?action=GetDiskInfo" \
  -d "request_time=$REQUEST_TIME" \
  -d "request_token=$REQUEST_TOKEN"
```

#### 获取实时状态信息(CPU、内存、网络、负载)
```bash
curl -k -X POST "https://139.196.165.140:16435/system?action=GetNetWork" \
  -d "request_time=$REQUEST_TIME" \
  -d "request_token=$REQUEST_TOKEN"
```

### 2. 文件管理接口

#### 获取目录列表
```bash
curl -k -X POST "https://139.196.165.140:16435/files?action=GetDir" \
  -d "request_time=$REQUEST_TIME" \
  -d "request_token=$REQUEST_TOKEN" \
  -d "path=/www/wwwroot"
```

**返回格式**: 目录和文件信息用分号分隔
```
文件名;大小;修改时间;权限;所有者;链接;...
```

**解析示例**:
```python
import json
data = json.loads(response)
# 解析目录
dirs = [d.split(';')[0] for d in data.get('DIR', [])]
# 解析文件
files = [f.split(';')[0] for f in data.get('FILES', [])]
```

#### 读取文件内容
```bash
curl -k -X POST "https://139.196.165.140:16435/files?action=GetFileBody" \
  -d "request_time=$REQUEST_TIME" \
  -d "request_token=$REQUEST_TOKEN" \
  -d "path=/www/wwwroot/project/app.log"
```

#### 保存文件内容（仅限已存在的文件）
```bash
curl -k -X POST "https://139.196.165.140:16435/files?action=SaveFileBody" \
  -d "request_time=$REQUEST_TIME" \
  -d "request_token=$REQUEST_TOKEN" \
  --data-urlencode "path=/path/to/file" \
  --data-urlencode "data=$FILE_CONTENT" \
  -d "encoding=utf-8"
```

**注意**: SaveFileBody只能编辑已存在的文件，不能创建新文件

#### 上传文件（推荐：支持创建新文件）
```bash
# 小文件上传
curl -k -X POST "https://139.196.165.140:16435/files?action=upload" \
  -F "request_time=$REQUEST_TIME" \
  -F "request_token=$REQUEST_TOKEN" \
  -F "f_path=/www/wwwroot/project" \
  -F "f_name=myfile.sh" \
  -F "f_size=$FILE_SIZE" \
  -F "f_start=0" \
  -F "blob=@/local/path/to/file"
```

**大文件分片上传**:
- 设置 `f_start` 为分片起始位置
- 多次调用上传不同分片

#### 设置文件权限
```bash
curl -k -X POST "https://139.196.165.140:16435/files?action=SetFileAccess" \
  -d "request_time=$REQUEST_TIME" \
  -d "request_token=$REQUEST_TOKEN" \
  -d "filename=/www/wwwroot/project/restart.sh" \
  -d "user=root" \
  -d "access=755"
```

### 3. 网站管理接口

#### 获取网站列表
```bash
curl -k -X POST "https://139.196.165.140:16435/data?action=getData&table=sites" \
  -d "request_time=$REQUEST_TIME" \
  -d "request_token=$REQUEST_TOKEN" \
  -d "limit=20" \
  -d "p=1"
```

#### 停用/启用网站
```bash
# 停用
curl -k -X POST "https://139.196.165.140:16435/site?action=SiteStop" \
  -d "request_time=$REQUEST_TIME" \
  -d "request_token=$REQUEST_TOKEN" \
  -d "id=66" \
  -d "name=example.com"

# 启用
curl -k -X POST "https://139.196.165.140:16435/site?action=SiteStart" \
  -d "request_time=$REQUEST_TIME" \
  -d "request_token=$REQUEST_TOKEN" \
  -d "id=66" \
  -d "name=example.com"
```

## API局限性

### ❌ 不支持的功能
1. **不能直接执行Shell命令** - 宝塔API没有提供执行任意shell命令的接口
2. **不能查看进程列表** - 无法直接通过API查看运行中的进程
3. **不能直接重启服务** - 需要通过上传脚本然后手动执行

### ✅ 替代方案
1. **执行Shell命令**:
   - 上传shell脚本到服务器
   - 在宝塔终端中手动执行
   - 或通过SSH直接连接服务器

2. **管理Java应用**:
   - 上传重启脚本
   - 使用宝塔的"计划任务"功能定时执行
   - 或配置为宝塔的"守护进程"

## 实战案例：重启Java应用

### 完整流程

#### 1. 创建重启脚本
```bash
cat > /tmp/restart.sh << 'EOF'
#!/bin/bash
cd /www/wwwroot/project
ps aux | grep cretas-backend-system | grep -v grep | awk '{print $2}' | xargs -r kill -9
sleep 2
nohup java -jar cretas-backend-system-1.0.0.jar --server.port=10010 > app.log 2>&1 &
echo "Started with PID: $!"
EOF
```

#### 2. 上传脚本
```bash
TIME_TOKEN=$(python3 << 'PYTHON_EOF'
import hashlib, time
api_sk = "Fw3rqkRqAashK9uNDsFxvst31YSbBmUb"
request_time = str(int(time.time()))
request_token = hashlib.md5((request_time + hashlib.md5(api_sk.encode()).hexdigest()).encode()).hexdigest()
print(f"{request_time}|{request_token}")
PYTHON_EOF
)

REQUEST_TIME=$(echo $TIME_TOKEN | cut -d'|' -f1)
REQUEST_TOKEN=$(echo $TIME_TOKEN | cut -d'|' -f2)
FILE_SIZE=$(stat -f%z /tmp/restart.sh)

curl -k -X POST "https://139.196.165.140:16435/files?action=upload" \
  -F "request_time=$REQUEST_TIME" \
  -F "request_token=$REQUEST_TOKEN" \
  -F "f_path=/www/wwwroot/project" \
  -F "f_name=restart.sh" \
  -F "f_size=$FILE_SIZE" \
  -F "f_start=0" \
  -F "blob=@/tmp/restart.sh"
```

#### 3. 设置执行权限
```bash
curl -k -X POST "https://139.196.165.140:16435/files?action=SetFileAccess" \
  -d "request_time=$REQUEST_TIME" \
  -d "request_token=$REQUEST_TOKEN" \
  -d "filename=/www/wwwroot/project/restart.sh" \
  -d "user=root" \
  -d "access=755"
```

#### 4. 在宝塔终端执行
```bash
bash /www/wwwroot/project/restart.sh
```

## 故障排查

### 常见错误

#### 1. IP校验失败
```json
{"status": false, "msg": "IP校验失败,您的访问IP为[x.x.x.x]"}
```
**解决方案**: 在宝塔面板"设置" -> "API接口"中添加该IP到白名单

#### 2. 连接被拒绝
```
curl: (7) Failed to connect to 106.14.165.234 port 8888
```
**可能原因**:
- 使用了HTTP而不是HTTPS
- 端口8888未开放
- 宝塔面板未运行

#### 3. 文件不存在
```json
{"status": false, "msg": "指定文件不存在!"}
```
**可能原因**:
- SaveFileBody只能编辑已存在的文件
- 路径错误
**解决方案**: 使用upload接口创建新文件

## 项目路径信息

### Cretas后端部署目录
- **JAR文件**: `/www/wwwroot/project/cretas-backend-system-1.0.0.jar`
- **日志文件**: `/www/wwwroot/project/cretas-backend.log`
- **应用端口**: 10010
- **访问地址**: http://139.196.165.140:10010

### 其他常用目录
- 网站根目录: `/www/wwwroot/`
- 项目目录: `/www/wwwroot/project/`
- 备份目录: `/www/backup/`
- 日志目录: `/www/wwwlogs/`

## 参考资源

- **官方文档**: https://www.bt.cn/data/api-doc.pdf
- **Demo下载**: https://www.bt.cn/api_demo_php.zip
- **宝塔论坛**: https://www.bt.cn/bbs/thread-20376-1-1.html

## 安全建议

1. ✅ **限制IP白名单** - 只添加必要的IP地址
2. ✅ **定期更换API密钥** - 避免密钥泄露
3. ✅ **使用HTTPS** - 确保传输安全
4. ⚠️ **不要在生产环境开启** - API接口可能增加安全风险
5. ⚠️ **审计API调用** - 定期检查API访问日志
