'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import PageLayout from '@/components/ui/page-layout';
import { Loading } from '@/components/ui/loading';


// 加工拍照数据接口定义
interface ProcessingPhoto {
  id: string;
  batchNumber: string;
  processStage: 'incoming' | 'cleaning' | 'cutting' | 'packaging' | 'storage' | 'quality_check';
  photoUrl: string;
  thumbnailUrl: string;
  description: string;
  timestamp: string;
  operator: string;
  equipment?: string;
  notes?: string;
  fileSize: number;
  resolution: string;
  verified: boolean;
}

interface PhotoStats {
  totalPhotos: number;
  todayPhotos: number;
  batchesWithPhotos: number;
  storageUsed: number; // MB
}

// 工具函数移到组件外部
const getStageDisplayName = (stage: ProcessingPhoto['processStage']) => {
  const stageNames = {
    incoming: '原料入库',
    cleaning: '清洗处理',
    cutting: '切割加工',
    packaging: '包装封装',
    storage: '存储管理',
    quality_check: '质量检测'
  };
  return stageNames[stage];
};

const generateMockPhotos = (): ProcessingPhoto[] => {
  const stages = ['incoming', 'cleaning', 'cutting', 'packaging', 'storage', 'quality_check'] as const;
  const operators = ['张师傅', '李加工', '王包装', '赵质检', '刘操作'];
  const equipments = ['切割机A01', '包装线B02', '清洗设备C03', '质检台D04'];

  return Array.from({ length: 20 }, (_, index) => ({
    id: `PHOTO-${String(index + 1).padStart(3, '0')}`,
    batchNumber: `PC-2025-${String(Math.floor(index / 4) + 1).padStart(3, '0')}`,
    processStage: stages[Math.floor(Math.random() * stages.length)],
    photoUrl: `/images/processing/photo-${index + 1}.jpg`,
    thumbnailUrl: `/images/processing/thumb-${index + 1}.jpg`,
    description: `${getStageDisplayName(stages[Math.floor(Math.random() * stages.length)])}阶段记录`,
    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    operator: operators[Math.floor(Math.random() * operators.length)],
    equipment: Math.random() > 0.3 ? equipments[Math.floor(Math.random() * equipments.length)] : undefined,
    notes: Math.random() > 0.5 ? '正常操作，无异常' : undefined,
    fileSize: Math.floor(Math.random() * 5000) + 1000, // KB
    resolution: ['1920x1080', '1280x720', '2560x1440'][Math.floor(Math.random() * 3)],
    verified: Math.random() > 0.2
  }));
};

export default function ProcessingPhotosPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<ProcessingPhoto[]>([]);
  const [stats, setStats] = useState<PhotoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // 筛选和搜索状态
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');

  const fetchPhotos = useCallback(async () => {
    try {
      const response = await fetch('/api/processing/photos');
      if (response.ok) {
        const data = await response.json();
        setPhotos(data.photos || []);
      } else {
        setPhotos(generateMockPhotos());
      }
    } catch (error) {
      console.error('获取加工照片失败:', error);
      setPhotos(generateMockPhotos());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
    fetchStats();
  }, [fetchPhotos]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/processing/photos?type=stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        setStats({
          totalPhotos: 1248,
          todayPhotos: 24,
          batchesWithPhotos: 156,
          storageUsed: 2840
        });
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
      setStats({
        totalPhotos: 1248,
        todayPhotos: 24,
        batchesWithPhotos: 156,
        storageUsed: 2840
      });
    }
  };

  const getStageColor = (stage: ProcessingPhoto['processStage']) => {
    const stageColors = {
      incoming: 'bg-blue-100 text-blue-800',
      cleaning: 'bg-cyan-100 text-cyan-800',
      cutting: 'bg-orange-100 text-orange-800',
      packaging: 'bg-green-100 text-green-800',
      storage: 'bg-purple-100 text-purple-800',
      quality_check: 'bg-red-100 text-red-800'
    };
    return stageColors[stage];
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        // 模拟上传过程
        await new Promise(resolve => setTimeout(resolve, 1000));

        const newPhoto: ProcessingPhoto = {
          id: `PHOTO-${Date.now()}`,
          batchNumber: 'PC-2025-新建',
          processStage: 'incoming',
          photoUrl: URL.createObjectURL(file),
          thumbnailUrl: URL.createObjectURL(file),
          description: '新上传的照片',
          timestamp: new Date().toISOString(),
          operator: '当前用户',
          fileSize: Math.floor(file.size / 1024),
          resolution: '待检测',
          verified: false
        };

        setPhotos(prev => [newPhoto, ...prev]);
      }
    } catch (error) {
      console.error('上传失败:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredPhotos = photos.filter(photo => {
    const matchesSearch = !searchTerm ||
      photo.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      photo.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      photo.operator.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStage = stageFilter === 'all' || photo.processStage === stageFilter;

    return matchesSearch && matchesStage;
  });

  const formatFileSize = (sizeInKB: number) => {
    if (sizeInKB < 1024) {
      return `${sizeInKB} KB`;
    }
    return `${(sizeInKB / 1024).toFixed(1)} MB`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return '刚刚';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}小时前`;
    } else if (diffInHours < 24 * 7) {
      return `${Math.floor(diffInHours / 24)}天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  if (loading) {
    return (
      <PageLayout
        title="加工拍照"
        showBack={true}
        onBack={() => router.push('/processing')}
        className="flex items-center justify-center min-h-screen"
      >
        <Loading text="加载照片数据中..." />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="加工拍照"
      showBack={true}
      onBack={() => router.push('/processing')}
      className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
    >
      <main className="flex-1 pt-[80px] pb-[20px] px-4">
        {/* 统计概览 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="bg-white p-3">
            <div className="text-2xl font-bold text-blue-600">{stats?.totalPhotos || 0}</div>
            <div className="text-sm text-gray-600">总照片数</div>
          </Card>
          <Card className="bg-white p-3">
            <div className="text-2xl font-bold text-green-600">+{stats?.todayPhotos || 0}</div>
            <div className="text-sm text-gray-600">今日新增</div>
          </Card>
          <Card className="bg-white p-3">
            <div className="text-2xl font-bold text-purple-600">{stats?.batchesWithPhotos || 0}</div>
            <div className="text-sm text-gray-600">批次记录</div>
          </Card>
          <Card className="bg-white p-3">
            <div className="text-2xl font-bold text-orange-600">{((stats?.storageUsed || 0) / 1024).toFixed(1)}G</div>
            <div className="text-sm text-gray-600">存储使用</div>
          </Card>
        </div>

        {/* 拍照上传 */}
        <Card className="bg-white p-4 mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">上传照片</h3>
          <div className="flex space-x-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 bg-[#1677FF] hover:bg-[#4096FF] text-white"
            >
              {uploading ? '上传中...' : '📷 选择照片'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => {/* 实现相机拍照功能 */}}
              className="bg-[#52C41A] hover:bg-[#73D13D] text-white px-4"
            >
              📸
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            支持 JPG、PNG 格式，单个文件不超过 10MB
          </p>
        </Card>

        {/* 搜索和筛选 */}
        <Card className="bg-white p-4 mb-4">
          <div className="space-y-3">
            <Input
              placeholder="搜索批次号、描述或操作员..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <Select
              value={stageFilter}
              onChange={setStageFilter}
              options={[
                { value: 'all', label: '全部阶段' },
                { value: 'incoming', label: '原料入库' },
                { value: 'cleaning', label: '清洗处理' },
                { value: 'cutting', label: '切割加工' },
                { value: 'packaging', label: '包装封装' },
                { value: 'storage', label: '存储管理' },
                { value: 'quality_check', label: '质量检测' }
              ]}
              className="w-full"
            />
          </div>
        </Card>

        {/* 照片网格 */}
        <div className="grid grid-cols-2 gap-3">
          {filteredPhotos.map((photo) => (
            <Card
              key={photo.id}
              className="bg-white overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="aspect-square bg-gray-200 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl">📷</span>
                </div>
                <div className="absolute top-2 left-2">
                  <Badge className={getStageColor(photo.processStage)}>
                    {getStageDisplayName(photo.processStage)}
                  </Badge>
                </div>
                {photo.verified && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-green-100 text-green-800">✓</Badge>
                  </div>
                )}
              </div>

              <div className="p-3">
                <div className="font-medium text-sm text-gray-900 mb-1">
                  {photo.batchNumber}
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  {photo.description}
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{photo.operator}</span>
                  <span>{formatTimestamp(photo.timestamp)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-400 mt-1">
                  <span>{formatFileSize(photo.fileSize)}</span>
                  <span>{photo.resolution}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredPhotos.length === 0 && (
          <Card className="bg-white p-8 text-center">
            <span className="text-4xl mb-3 block">📷</span>
            <p className="text-gray-600 mb-2">暂无照片记录</p>
            <p className="text-sm text-gray-500">点击上方按钮开始拍照记录</p>
          </Card>
        )}
      </main>
    </PageLayout>
  );
}
