'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Loading } from '@/components/ui';

// 摄像头数据接口
interface Camera {
  id: string;
  name: string;
  location: string;
  type: 'fixed' | 'ptz' | 'thermal';
  status: 'online' | 'offline' | 'maintenance';
  resolution: string;
  viewAngle: string;
  lastUpdate: string;
  coverage: {
    area: string;
    description: string;
  };
  features: string[];
  liveUrl?: string;
}

// 录像记录接口
interface Recording {
  id: string;
  cameraId: string;
  cameraName: string;
  startTime: string;
  duration: number;
  fileSize: string;
  events: string[];
  thumbnail?: string;
}

// Mock 摄像头数据
const mockCameras: Camera[] = [
  {
    id: '1',
    name: 'A区种植监控',
    location: 'A区大棚',
    type: 'fixed',
    status: 'online',
    resolution: '1920x1080',
    viewAngle: '90°',
    lastUpdate: '2025-02-02 16:30:45',
    coverage: {
      area: '有机白菜种植区',
      description: '覆盖面积约500平方米，监控作物生长状态'
    },
    features: ['夜视', '运动检测', '自动录像'],
    liveUrl: 'rtmp://live.example.com/camera1'
  },
  {
    id: '2',
    name: '环境监测PTZ',
    location: 'B区温室',
    type: 'ptz',
    status: 'online',
    resolution: '2560x1440',
    viewAngle: '360°',
    lastUpdate: '2025-02-02 16:29:12',
    coverage: {
      area: '温室环境监控',
      description: 'PTZ云台摄像头，可远程控制视角和焦距'
    },
    features: ['云台控制', '变焦', '预设位', '音频录制'],
    liveUrl: 'rtmp://live.example.com/camera2'
  },
  {
    id: '3',
    name: '病害检测热成像',
    location: 'C区试验田',
    type: 'thermal',
    status: 'offline',
    resolution: '640x480',
    viewAngle: '45°',
    lastUpdate: '2025-02-02 14:15:33',
    coverage: {
      area: '病害早期检测区',
      description: '热成像监控，用于早期病害识别'
    },
    features: ['热成像', 'AI病害识别', '温度检测'],
    liveUrl: undefined
  },
  {
    id: '4',
    name: '出入口安防',
    location: '农场入口',
    type: 'fixed',
    status: 'online',
    resolution: '1920x1080',
    viewAngle: '120°',
    lastUpdate: '2025-02-02 16:32:01',
    coverage: {
      area: '农场主要出入口',
      description: '监控人员、车辆进出情况'
    },
    features: ['人脸识别', '车牌识别', '报警联动'],
    liveUrl: 'rtmp://live.example.com/camera4'
  }
];

// Mock 录像数据
const mockRecordings: Recording[] = [
  {
    id: '1',
    cameraId: '1',
    cameraName: 'A区种植监控',
    startTime: '2025-02-02 08:00:00',
    duration: 480,
    fileSize: '2.3 GB',
    events: ['运动检测', '人员进入'],
    thumbnail: '/placeholder-video.jpg'
  },
  {
    id: '2',
    cameraId: '2',
    cameraName: '环境监测PTZ',
    startTime: '2025-02-02 06:30:00',
    duration: 720,
    fileSize: '4.1 GB',
    events: ['定时录像'],
    thumbnail: '/placeholder-video.jpg'
  },
  {
    id: '3',
    cameraId: '1',
    cameraName: 'A区种植监控',
    startTime: '2025-02-01 18:45:00',
    duration: 180,
    fileSize: '890 MB',
    events: ['异常检测', '温度异常'],
    thumbnail: '/placeholder-video.jpg'
  }
];

export default function VideoMonitoringPage() {
  const router = useRouter();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'recordings' | 'settings'>('live');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setCameras(mockCameras);
        setRecordings(mockRecordings);
        setSelectedCamera(mockCameras.find(c => c.status === 'online') || mockCameras[0]);
      } catch (error) {
        console.error('获取监控数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const connectToCamera = async (cameraId: string) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const camera = cameras.find(c => c.id === cameraId);
      if (camera) {
        setSelectedCamera(camera);
        alert(`已连接到 ${camera.name}`);
      }
    } catch (error) {
      console.error('连接失败:', error);
      alert('连接失败，请重试');
    }
  };

  const controlPTZ = async (direction: string) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      alert(`PTZ控制: ${direction}`);
    } catch (error) {
      console.error('PTZ控制失败:', error);
    }
  };

  const startRecording = async (cameraId: string) => {
    try {
      setCameras(prev => prev.map(camera =>
        camera.id === cameraId
          ? { ...camera, features: [...camera.features, '正在录像'] }
          : camera
      ));
      alert('开始录像');
    } catch (error) {
      console.error('录像失败:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-50';
      case 'offline': return 'text-red-600 bg-red-50';
      case 'maintenance': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'fixed': return '📹';
      case 'ptz': return '🎥';
      case 'thermal': return '🌡️';
      default: return '📷';
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}时${minutes}分`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading text="加载视频监控..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[390px] mx-auto bg-white min-h-screen">
        {/* 头部 */}
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="small"
                onClick={() => router.back()}
                className="p-1"
              >
                ←
              </Button>
              <h1 className="text-lg font-semibold text-gray-900">视频监控</h1>
            </div>
            <Button variant="secondary" size="small">
              🔄
            </Button>
          </div>
        </div>

        {/* 标签栏 */}
        <div className="bg-white border-b border-gray-100 px-4">
          <div className="flex space-x-6">
            {[
              { key: 'live', label: '实时监控' },
              { key: 'recordings', label: '录像回放' },
              { key: 'settings', label: '摄像头设置' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 实时监控 */}
          {activeTab === 'live' && (
            <>
              {/* 摄像头选择 */}
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">选择摄像头</h3>
                <div className="grid grid-cols-2 gap-3">
                  {cameras.map((camera) => (
                    <div
                      key={camera.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedCamera?.id === camera.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => camera.status === 'online' && connectToCamera(camera.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg">{getTypeIcon(camera.type)}</span>
                        <Badge className={getStatusColor(camera.status)}>
                          {camera.status === 'online' ? '在线' :
                           camera.status === 'offline' ? '离线' : '维护'}
                        </Badge>
                      </div>
                      <h4 className="font-medium text-gray-900 text-sm">{camera.name}</h4>
                      <p className="text-xs text-gray-500">{camera.location}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 实时画面 */}
              {selectedCamera && (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">{selectedCamera.name}</h3>
                    <Badge className={getStatusColor(selectedCamera.status)}>
                      {selectedCamera.status === 'online' ? '直播中' : '离线'}
                    </Badge>
                  </div>

                  {/* 视频播放区域 */}
                  <div className="bg-black rounded-lg aspect-video flex items-center justify-center mb-3">
                    {selectedCamera.status === 'online' ? (
                      <div className="text-center text-white">
                        <div className="text-4xl mb-2">📹</div>
                        <p className="text-sm">实时监控画面</p>
                        <p className="text-xs text-gray-300">{selectedCamera.resolution}</p>
                      </div>
                    ) : (
                      <div className="text-center text-gray-400">
                        <div className="text-4xl mb-2">📵</div>
                        <p className="text-sm">摄像头离线</p>
                      </div>
                    )}
                  </div>

                  {/* 控制按钮 */}
                  <div className="space-y-3">
                    <div className="flex space-x-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => startRecording(selectedCamera.id)}
                        disabled={selectedCamera.status !== 'online'}
                      >
                        🔴 录像
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1"
                        disabled={selectedCamera.status !== 'online'}
                      >
                        📸 截图
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1"
                        disabled={selectedCamera.status !== 'online'}
                      >
                        🔊 音频
                      </Button>
                    </div>

                    {/* PTZ控制 */}
                    {selectedCamera.type === 'ptz' && selectedCamera.status === 'online' && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">云台控制</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => controlPTZ('左上')}
                          >
                            ↖️
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => controlPTZ('上')}
                          >
                            ⬆️
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => controlPTZ('右上')}
                          >
                            ↗️
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => controlPTZ('左')}
                          >
                            ⬅️
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => controlPTZ('复位')}
                          >
                            🎯
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => controlPTZ('右')}
                          >
                            ➡️
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => controlPTZ('左下')}
                          >
                            ↙️
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => controlPTZ('下')}
                          >
                            ⬇️
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => controlPTZ('右下')}
                          >
                            ↘️
                          </Button>
                        </div>

                        <div className="flex space-x-2 mt-2">
                          <Button
                            variant="secondary"
                            size="small"
                            className="flex-1"
                            onClick={() => controlPTZ('放大')}
                          >
                            🔍+
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            className="flex-1"
                            onClick={() => controlPTZ('缩小')}
                          >
                            🔍-
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* 录像回放 */}
          {activeTab === 'recordings' && (
            <>
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">录像记录</h3>
                <div className="space-y-3">
                  {recordings.map((recording) => (
                    <div key={recording.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{recording.cameraName}</h4>
                        <span className="text-sm text-gray-600">{recording.fileSize}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span>{recording.startTime}</span>
                        <span>{formatDuration(recording.duration)}</span>
                      </div>

                      {recording.events.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {recording.events.map((event, index) => (
                            <Badge key={index} className="text-xs text-orange-600 bg-orange-50">
                              {event}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex space-x-2">
                        <Button variant="secondary" size="small" className="flex-1">
                          ▶️ 播放
                        </Button>
                        <Button variant="secondary" size="small" className="flex-1">
                          📥 下载
                        </Button>
                        <Button variant="secondary" size="small" className="flex-1">
                          🗑️ 删除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {/* 摄像头设置 */}
          {activeTab === 'settings' && (
            <>
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">摄像头管理</h3>
                <div className="space-y-4">
                  {cameras.map((camera) => (
                    <div key={camera.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getTypeIcon(camera.type)}</span>
                          <h4 className="font-medium text-gray-900">{camera.name}</h4>
                        </div>
                        <Badge className={getStatusColor(camera.status)}>
                          {camera.status === 'online' ? '在线' :
                           camera.status === 'offline' ? '离线' : '维护'}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">位置</span>
                          <span className="text-gray-900">{camera.location}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">分辨率</span>
                          <span className="text-gray-900">{camera.resolution}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">视角</span>
                          <span className="text-gray-900">{camera.viewAngle}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">最后更新</span>
                          <span className="text-gray-900">{camera.lastUpdate}</span>
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-sm text-gray-600 mb-2">覆盖范围</p>
                        <p className="text-sm text-gray-900">{camera.coverage.description}</p>
                      </div>

                      <div className="mt-3">
                        <p className="text-sm text-gray-600 mb-2">功能特性</p>
                        <div className="flex flex-wrap gap-1">
                          {camera.features.map((feature, index) => (
                            <Badge key={index} className="text-xs text-blue-600 bg-blue-50">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex space-x-2 mt-3">
                        <Button variant="secondary" size="small" className="flex-1">
                          ⚙️ 配置
                        </Button>
                        <Button variant="secondary" size="small" className="flex-1">
                          🔧 维护
                        </Button>
                        <Button variant="secondary" size="small" className="flex-1">
                          📊 统计
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {/* 使用提示 */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">监控说明</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• 实时监控需要摄像头在线状态</p>
              <p>• PTZ摄像头支持远程云台控制</p>
              <p>• 录像文件会自动保存7天后删除</p>
              <p>• 异常事件会自动触发录像和通知</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
