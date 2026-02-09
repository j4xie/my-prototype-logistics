#!/usr/bin/env python3
"""
Mock ISAPI Server - 模拟海康威视摄像头 ISAPI 接口
用于测试智能分析配置功能

启动方式: python3 mock_isapi_server.py
默认端口: 8554
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import re
import json
from urllib.parse import urlparse, parse_qs

# 存储配置数据（内存中）
line_detection_config = {}
field_detection_config = {}
face_detection_config = {}

class MockISAPIHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"[ISAPI] {self.address_string()} - {format % args}")

    def send_xml_response(self, xml_content, status=200):
        """发送 XML 响应"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/xml; charset=utf-8')
        self.send_header('Content-Length', len(xml_content.encode('utf-8')))
        self.end_headers()
        self.wfile.write(xml_content.encode('utf-8'))

    def do_GET(self):
        """处理 GET 请求"""
        path = urlparse(self.path).path
        print(f"[ISAPI] GET {path}")

        # 设备信息
        if path == '/ISAPI/System/deviceInfo':
            self.send_device_info()

        # 智能分析能力
        elif path == '/ISAPI/Smart/capabilities':
            self.send_smart_capabilities()

        # 越界检测配置
        elif re.match(r'/ISAPI/Smart/LineDetection/\d+$', path):
            channel_id = int(path.split('/')[-1])
            self.send_line_detection_config(channel_id)

        # 越界检测能力
        elif re.match(r'/ISAPI/Smart/LineDetection/\d+/capabilities$', path):
            self.send_line_detection_capabilities()

        # 区域入侵配置
        elif re.match(r'/ISAPI/Smart/FieldDetection/\d+$', path):
            channel_id = int(path.split('/')[-1])
            self.send_field_detection_config(channel_id)

        # 区域入侵能力
        elif re.match(r'/ISAPI/Smart/FieldDetection/\d+/capabilities$', path):
            self.send_field_detection_capabilities()

        # 人脸检测配置
        elif re.match(r'/ISAPI/Smart/FaceDetect/\d+$', path):
            channel_id = int(path.split('/')[-1])
            self.send_face_detection_config(channel_id)

        else:
            self.send_error(404, f"Unknown path: {path}")

    def do_PUT(self):
        """处理 PUT 请求"""
        path = urlparse(self.path).path
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else ''

        print(f"[ISAPI] PUT {path}")
        print(f"[ISAPI] Body: {body[:500]}..." if len(body) > 500 else f"[ISAPI] Body: {body}")

        # 保存越界检测配置
        if re.match(r'/ISAPI/Smart/LineDetection/\d+$', path):
            channel_id = int(path.split('/')[-1])
            line_detection_config[channel_id] = body
            self.send_success_response("LineDetection config saved")

        # 保存区域入侵配置
        elif re.match(r'/ISAPI/Smart/FieldDetection/\d+$', path):
            channel_id = int(path.split('/')[-1])
            field_detection_config[channel_id] = body
            self.send_success_response("FieldDetection config saved")

        # 保存人脸检测配置
        elif re.match(r'/ISAPI/Smart/FaceDetect/\d+$', path):
            channel_id = int(path.split('/')[-1])
            face_detection_config[channel_id] = body
            self.send_success_response("FaceDetection config saved")

        else:
            self.send_error(404, f"Unknown path: {path}")

    def send_device_info(self):
        """返回设备信息"""
        xml = '''<?xml version="1.0" encoding="UTF-8"?>
<DeviceInfo version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
    <deviceName>Mock HIK Camera</deviceName>
    <deviceID>mock-device-001</deviceID>
    <model>DS-2CD2T47G2-L</model>
    <serialNumber>MOCK20260105001</serialNumber>
    <macAddress>00:11:22:33:44:55</macAddress>
    <firmwareVersion>V5.7.0 build 220401</firmwareVersion>
    <firmwareReleasedDate>2022-04-01</firmwareReleasedDate>
    <encoderVersion>V5.0 build 220401</encoderVersion>
    <encoderReleasedDate>2022-04-01</encoderReleasedDate>
    <deviceType>IPCamera</deviceType>
    <telecontrolID>88</telecontrolID>
</DeviceInfo>'''
        self.send_xml_response(xml)

    def send_smart_capabilities(self):
        """返回智能分析能力"""
        xml = '''<?xml version="1.0" encoding="UTF-8"?>
<SmartCap version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
    <isSupportLineDetection>true</isSupportLineDetection>
    <isSupportFieldDetection>true</isSupportFieldDetection>
    <isSupportFaceDetection>true</isSupportFaceDetection>
    <isSupportAudioDetection>true</isSupportAudioDetection>
    <isSupportSceneChangeDetection>true</isSupportSceneChangeDetection>
    <LineDetectionMaxNum>4</LineDetectionMaxNum>
    <FieldDetectionMaxNum>4</FieldDetectionMaxNum>
    <FaceDetectionMaxNum>1</FaceDetectionMaxNum>
</SmartCap>'''
        self.send_xml_response(xml)

    def send_line_detection_capabilities(self):
        """返回越界检测能力"""
        xml = '''<?xml version="1.0" encoding="UTF-8"?>
<LineDetectionCap version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
    <maxLineNum>4</maxLineNum>
    <isSupportDirection>true</isSupportDirection>
    <isSupportSensitivity>true</isSupportSensitivity>
    <sensitivityMin>1</sensitivityMin>
    <sensitivityMax>100</sensitivityMax>
    <sensitivityDefault>50</sensitivityDefault>
</LineDetectionCap>'''
        self.send_xml_response(xml)

    def send_line_detection_config(self, channel_id):
        """返回越界检测配置"""
        # 如果有保存的配置，返回保存的
        if channel_id in line_detection_config:
            self.send_xml_response(line_detection_config[channel_id])
            return

        # 返回默认配置
        xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<LineDetection version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
    <id>{channel_id}</id>
    <enabled>true</enabled>
    <normalizedScreenSize>
        <normalizedScreenWidth>10000</normalizedScreenWidth>
        <normalizedScreenHeight>10000</normalizedScreenHeight>
    </normalizedScreenSize>
    <LineItemList>
        <LineItem>
            <id>1</id>
            <enabled>true</enabled>
            <eventType>cross</eventType>
            <direction>both</direction>
            <sensitivity>50</sensitivity>
            <CoordinatesList>
                <Coordinates>
                    <positionX>2000</positionX>
                    <positionY>3000</positionY>
                </Coordinates>
                <Coordinates>
                    <positionX>8000</positionX>
                    <positionY>7000</positionY>
                </Coordinates>
            </CoordinatesList>
        </LineItem>
    </LineItemList>
</LineDetection>'''
        self.send_xml_response(xml)

    def send_field_detection_capabilities(self):
        """返回区域入侵能力"""
        xml = '''<?xml version="1.0" encoding="UTF-8"?>
<FieldDetectionCap version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
    <maxRegionNum>4</maxRegionNum>
    <maxPointNumOfRegion>10</maxPointNumOfRegion>
    <isSupportSensitivity>true</isSupportSensitivity>
    <sensitivityMin>1</sensitivityMin>
    <sensitivityMax>100</sensitivityMax>
    <sensitivityDefault>50</sensitivityDefault>
    <isSupportTimeThreshold>true</isSupportTimeThreshold>
    <timeThresholdMin>0</timeThresholdMin>
    <timeThresholdMax>10</timeThresholdMax>
</FieldDetectionCap>'''
        self.send_xml_response(xml)

    def send_field_detection_config(self, channel_id):
        """返回区域入侵配置"""
        # 如果有保存的配置，返回保存的
        if channel_id in field_detection_config:
            self.send_xml_response(field_detection_config[channel_id])
            return

        # 返回默认配置
        xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<FieldDetection version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
    <id>{channel_id}</id>
    <enabled>true</enabled>
    <normalizedScreenSize>
        <normalizedScreenWidth>10000</normalizedScreenWidth>
        <normalizedScreenHeight>10000</normalizedScreenHeight>
    </normalizedScreenSize>
    <FieldDetectionRegionList>
        <FieldDetectionRegion>
            <id>1</id>
            <enabled>true</enabled>
            <sensitivity>50</sensitivity>
            <timeThreshold>0</timeThreshold>
            <RegionCoordinatesList>
                <RegionCoordinates>
                    <positionX>1000</positionX>
                    <positionY>1000</positionY>
                </RegionCoordinates>
                <RegionCoordinates>
                    <positionX>4000</positionX>
                    <positionY>1000</positionY>
                </RegionCoordinates>
                <RegionCoordinates>
                    <positionX>4000</positionX>
                    <positionY>4000</positionY>
                </RegionCoordinates>
                <RegionCoordinates>
                    <positionX>1000</positionX>
                    <positionY>4000</positionY>
                </RegionCoordinates>
            </RegionCoordinatesList>
        </FieldDetectionRegion>
    </FieldDetectionRegionList>
</FieldDetection>'''
        self.send_xml_response(xml)

    def send_face_detection_config(self, channel_id):
        """返回人脸检测配置"""
        # 如果有保存的配置，返回保存的
        if channel_id in face_detection_config:
            self.send_xml_response(face_detection_config[channel_id])
            return

        # 返回默认配置
        xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<FaceDetection version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
    <id>{channel_id}</id>
    <enabled>true</enabled>
    <normalizedScreenSize>
        <normalizedScreenWidth>10000</normalizedScreenWidth>
        <normalizedScreenHeight>10000</normalizedScreenHeight>
    </normalizedScreenSize>
    <FaceDetectionRegion>
        <enabled>true</enabled>
        <sensitivity>50</sensitivity>
        <RegionCoordinatesList>
            <RegionCoordinates>
                <positionX>2000</positionX>
                <positionY>2000</positionY>
            </RegionCoordinates>
            <RegionCoordinates>
                <positionX>8000</positionX>
                <positionY>2000</positionY>
            </RegionCoordinates>
            <RegionCoordinates>
                <positionX>8000</positionX>
                <positionY>8000</positionY>
            </RegionCoordinates>
            <RegionCoordinates>
                <positionX>2000</positionX>
                <positionY>8000</positionY>
            </RegionCoordinates>
        </RegionCoordinatesList>
    </FaceDetectionRegion>
</FaceDetection>'''
        self.send_xml_response(xml)

    def send_success_response(self, message="OK"):
        """返回成功响应"""
        xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<ResponseStatus version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
    <requestURL>{self.path}</requestURL>
    <statusCode>1</statusCode>
    <statusString>OK</statusString>
    <subStatusCode>ok</subStatusCode>
</ResponseStatus>'''
        self.send_xml_response(xml)


def main():
    port = 8554
    server = HTTPServer(('0.0.0.0', port), MockISAPIHandler)
    print(f"=" * 60)
    print(f"Mock ISAPI Server 启动成功")
    print(f"监听端口: {port}")
    print(f"模拟设备: DS-2CD2T47G2-L (海康威视)")
    print(f"=" * 60)
    print(f"支持的接口:")
    print(f"  GET  /ISAPI/System/deviceInfo")
    print(f"  GET  /ISAPI/Smart/capabilities")
    print(f"  GET  /ISAPI/Smart/LineDetection/{{channelId}}")
    print(f"  PUT  /ISAPI/Smart/LineDetection/{{channelId}}")
    print(f"  GET  /ISAPI/Smart/FieldDetection/{{channelId}}")
    print(f"  PUT  /ISAPI/Smart/FieldDetection/{{channelId}}")
    print(f"  GET  /ISAPI/Smart/FaceDetect/{{channelId}}")
    print(f"  PUT  /ISAPI/Smart/FaceDetect/{{channelId}}")
    print(f"=" * 60)
    print(f"按 Ctrl+C 停止服务器")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
        server.shutdown()


if __name__ == '__main__':
    main()
