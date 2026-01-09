#!/usr/bin/env python3
"""
Cretas 边缘网关 (Edge Gateway)
运行在本地网络，从摄像头获取数据并上传到云端后端

使用方法:
    python edge_gateway.py --config config.json
    或
    python edge_gateway.py --device-id <设备ID> --camera-ip 192.168.3.227 --username admin --password xxx

功能:
    - 定时抓拍图片并上传
    - 订阅告警事件并转发
    - 心跳保活
"""

import argparse
import base64
import hashlib
import json
import logging
import os
import re
import sys
import threading
import time
import uuid
from datetime import datetime
from typing import Optional, Dict, Any

import requests
from requests.auth import HTTPDigestAuth

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class IsapiCamera:
    """海康威视摄像头 ISAPI 客户端"""

    def __init__(self, ip: str, port: int, username: str, password: str, protocol: str = 'http'):
        self.ip = ip
        self.port = port
        self.username = username
        self.password = password
        self.protocol = protocol
        self.base_url = f"{protocol}://{ip}:{port}"
        self.auth = HTTPDigestAuth(username, password)
        self.session = requests.Session()
        self.session.auth = self.auth
        self.session.verify = False  # 忽略 SSL 证书验证

    def test_connection(self) -> bool:
        """测试连接"""
        try:
            response = self.session.get(
                f"{self.base_url}/ISAPI/System/deviceInfo",
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"连接测试失败: {e}")
            return False

    def get_device_info(self) -> Optional[Dict]:
        """获取设备信息"""
        try:
            response = self.session.get(
                f"{self.base_url}/ISAPI/System/deviceInfo",
                timeout=10
            )
            if response.status_code == 200:
                # 简单解析 XML
                text = response.text
                info = {}
                for tag in ['deviceName', 'deviceID', 'model', 'serialNumber', 'firmwareVersion', 'macAddress']:
                    match = re.search(f'<{tag}>(.*?)</{tag}>', text)
                    if match:
                        info[tag] = match.group(1)
                return info
            return None
        except Exception as e:
            logger.error(f"获取设备信息失败: {e}")
            return None

    def capture_picture(self, channel_id: int = 1) -> Optional[bytes]:
        """抓拍图片"""
        try:
            # 海康 ISAPI 抓拍接口
            url = f"{self.base_url}/ISAPI/Streaming/channels/{channel_id}01/picture"
            response = self.session.get(url, timeout=15)

            if response.status_code == 200 and 'image' in response.headers.get('Content-Type', ''):
                logger.info(f"抓拍成功: {len(response.content)} bytes")
                return response.content
            else:
                logger.warning(f"抓拍失败: status={response.status_code}")
                return None
        except Exception as e:
            logger.error(f"抓拍异常: {e}")
            return None

    def get_rtsp_url(self, channel_id: int = 1, stream_type: str = 'main') -> str:
        """获取 RTSP 地址"""
        stream_id = '01' if stream_type == 'main' else '02'
        return f"rtsp://{self.username}:{self.password}@{self.ip}:554/Streaming/Channels/{channel_id}{stream_id}"


class EdgeGateway:
    """边缘网关主类"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.gateway_id = config.get('gateway_id', f"edge-{uuid.uuid4().hex[:8]}")
        self.backend_url = config.get('backend_url', 'http://139.196.165.140:10010')
        self.device_id = config['device_id']

        # 摄像头配置
        camera_config = config.get('camera', {})
        self.camera = IsapiCamera(
            ip=camera_config.get('ip', '192.168.3.227'),
            port=camera_config.get('port', 80),
            username=camera_config.get('username', 'admin'),
            password=camera_config.get('password', ''),
            protocol=camera_config.get('protocol', 'http')
        )

        # 上传配置
        self.capture_interval = config.get('capture_interval', 60)  # 秒
        self.heartbeat_interval = config.get('heartbeat_interval', 30)  # 秒
        self.enable_capture = config.get('enable_capture', True)
        self.enable_events = config.get('enable_events', True)

        # 运行状态
        self.running = False
        self.threads = []

    def upload_to_backend(self, data: Dict) -> bool:
        """上传数据到后端"""
        try:
            url = f"{self.backend_url}/api/mobile/edge/upload"
            response = requests.post(
                url,
                json=data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    logger.info(f"上传成功: {result.get('message')}")
                    return True
                else:
                    logger.warning(f"上传失败: {result.get('message')}")
                    return False
            else:
                logger.error(f"上传HTTP错误: {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"上传异常: {e}")
            return False

    def send_heartbeat(self):
        """发送心跳"""
        data = {
            'gatewayId': self.gateway_id,
            'deviceId': self.device_id,
            'uploadType': 'HEARTBEAT',
            'captureTime': datetime.now().isoformat()
        }
        return self.upload_to_backend(data)

    def capture_and_upload(self):
        """抓拍并上传"""
        picture = self.camera.capture_picture(channel_id=1)
        if picture:
            data = {
                'gatewayId': self.gateway_id,
                'deviceId': self.device_id,
                'uploadType': 'CAPTURE',
                'channelId': 1,
                'pictureBase64': base64.b64encode(picture).decode('utf-8'),
                'pictureFormat': 'JPEG',
                'captureTime': datetime.now().isoformat(),
                'metadata': json.dumps({
                    'cameraIp': self.camera.ip,
                    'captureSource': 'edge_gateway'
                })
            }
            return self.upload_to_backend(data)
        return False

    def heartbeat_loop(self):
        """心跳循环"""
        while self.running:
            self.send_heartbeat()
            time.sleep(self.heartbeat_interval)

    def capture_loop(self):
        """抓拍循环"""
        while self.running:
            if self.enable_capture:
                self.capture_and_upload()
            time.sleep(self.capture_interval)

    def start(self):
        """启动网关"""
        logger.info("=" * 60)
        logger.info("Cretas 边缘网关启动")
        logger.info("=" * 60)
        logger.info(f"网关ID: {self.gateway_id}")
        logger.info(f"设备ID: {self.device_id}")
        logger.info(f"摄像头: {self.camera.ip}:{self.camera.port}")
        logger.info(f"后端地址: {self.backend_url}")
        logger.info(f"抓拍间隔: {self.capture_interval}秒")
        logger.info(f"心跳间隔: {self.heartbeat_interval}秒")
        logger.info("-" * 60)

        # 测试摄像头连接
        logger.info("测试摄像头连接...")
        if self.camera.test_connection():
            logger.info("✓ 摄像头连接成功")
            device_info = self.camera.get_device_info()
            if device_info:
                logger.info(f"  型号: {device_info.get('model', 'N/A')}")
                logger.info(f"  序列号: {device_info.get('serialNumber', 'N/A')}")
        else:
            logger.error("✗ 摄像头连接失败，请检查IP/用户名/密码")
            return False

        # 测试后端连接
        logger.info("测试后端连接...")
        try:
            response = requests.get(f"{self.backend_url}/api/mobile/edge/health", timeout=10)
            if response.status_code == 200:
                logger.info("✓ 后端连接成功")
            else:
                logger.warning(f"后端健康检查返回: {response.status_code}")
        except Exception as e:
            logger.error(f"✗ 后端连接失败: {e}")
            logger.warning("将继续运行，等待后端恢复...")

        logger.info("-" * 60)
        logger.info("启动工作线程...")

        self.running = True

        # 启动心跳线程
        heartbeat_thread = threading.Thread(target=self.heartbeat_loop, name='heartbeat')
        heartbeat_thread.daemon = True
        heartbeat_thread.start()
        self.threads.append(heartbeat_thread)
        logger.info("✓ 心跳线程已启动")

        # 启动抓拍线程
        if self.enable_capture:
            capture_thread = threading.Thread(target=self.capture_loop, name='capture')
            capture_thread.daemon = True
            capture_thread.start()
            self.threads.append(capture_thread)
            logger.info("✓ 抓拍线程已启动")

        logger.info("=" * 60)
        logger.info("边缘网关运行中，按 Ctrl+C 停止")
        logger.info("=" * 60)

        # 主线程等待
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("\n收到停止信号...")
            self.stop()

        return True

    def stop(self):
        """停止网关"""
        logger.info("停止边缘网关...")
        self.running = False
        for t in self.threads:
            t.join(timeout=5)
        logger.info("边缘网关已停止")


def load_config(config_file: str) -> Dict:
    """加载配置文件"""
    with open(config_file, 'r', encoding='utf-8') as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description='Cretas 边缘网关')
    parser.add_argument('--config', type=str, help='配置文件路径')
    parser.add_argument('--device-id', type=str, help='设备ID（后端数据库中的ID）')
    parser.add_argument('--camera-ip', type=str, default='192.168.3.227', help='摄像头IP')
    parser.add_argument('--camera-port', type=int, default=80, help='摄像头端口')
    parser.add_argument('--username', type=str, default='admin', help='摄像头用户名')
    parser.add_argument('--password', type=str, help='摄像头密码')
    parser.add_argument('--backend-url', type=str, default='http://139.196.165.140:10010', help='后端地址')
    parser.add_argument('--capture-interval', type=int, default=60, help='抓拍间隔（秒）')
    parser.add_argument('--heartbeat-interval', type=int, default=30, help='心跳间隔（秒）')

    args = parser.parse_args()

    # 加载配置
    if args.config:
        config = load_config(args.config)
    else:
        if not args.device_id:
            print("错误: 必须提供 --device-id 或 --config")
            print("示例: python edge_gateway.py --device-id xxx --camera-ip 192.168.3.227 --password yourpassword")
            sys.exit(1)

        config = {
            'device_id': args.device_id,
            'backend_url': args.backend_url,
            'capture_interval': args.capture_interval,
            'heartbeat_interval': args.heartbeat_interval,
            'camera': {
                'ip': args.camera_ip,
                'port': args.camera_port,
                'username': args.username,
                'password': args.password
            }
        }

    # 启动网关
    gateway = EdgeGateway(config)
    gateway.start()


if __name__ == '__main__':
    main()
