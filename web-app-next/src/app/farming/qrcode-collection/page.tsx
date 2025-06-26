'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Loading } from '@/components/ui';

// 扫码记录接口
interface ScanRecord {
  id: string;
  qrCode: string;
  data: any;
  timestamp: string;
  status: 'success' | 'error' | 'pending';
  note?: string;
}

export default function QRCodeCollectionPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const [currentScan, setCurrentScan] = useState<ScanRecord | null>(null);

  // Mock 二维码数据
  const mockQRData = {
    type: '农产品溯源',
    productId: 'PROD-20250202-001',
    productName: '有机白菜',
    batchNumber: 'BATCH-2025020201',
    harvestDate: '2025-02-01',
    field: 'A区3号田地',
    variety: '津白菜',
    weight: '2.5kg',
    quality: 'A级',
    farmer: '张三',
    contact: '13800138000'
  };

  // 模拟二维码扫描
  const simulateScan = async (qrData: string) => {
    setIsScanning(true);
    try {
      // 模拟扫描延迟
      await new Promise(resolve => setTimeout(resolve, 2000));

      const scanRecord: ScanRecord = {
        id: Date.now().toString(),
        qrCode: qrData,
        data: mockQRData,
        timestamp: new Date().toISOString(),
        status: 'success'
      };

      setCurrentScan(scanRecord);
      setScanHistory(prev => [scanRecord, ...prev]);
    } catch (error) {
      console.error('扫描失败:', error);
      const errorRecord: ScanRecord = {
        id: Date.now().toString(),
        qrCode: qrData,
        data: null,
        timestamp: new Date().toISOString(),
        status: 'error',
        note: '二维码无法识别'
      };
      setScanHistory(prev => [errorRecord, ...prev]);
    } finally {
      setIsScanning(false);
    }
  };

  // 手动输入二维码
  const handleManualInput = () => {
    const qrCode = prompt('请输入二维码内容:');
    if (qrCode) {
      simulateScan(qrCode);
    }
  };

  // 上传图片扫描
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 模拟图片二维码识别
      simulateScan(`IMAGE_QR_${Date.now()}`);
    }
  };

  // 确认数据录入
  const confirmScan = async (record: ScanRecord) => {
    try {
      // 模拟API提交
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 更新记录状态
      setScanHistory(prev =>
        prev.map(item =>
          item.id === record.id
            ? { ...item, status: 'success' as const }
            : item
        )
      );

      alert('数据录入成功！');
      setCurrentScan(null);
    } catch (error) {
      console.error('数据提交失败:', error);
      alert('提交失败，请重试');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50';
      case 'error': return 'text-red-600 bg-red-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success': return '成功';
      case 'error': return '失败';
      case 'pending': return '待处理';
      default: return '未知';
    }
  };

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
              <h1 className="text-lg font-semibold text-gray-900">二维码采集</h1>
            </div>
            <Badge className="text-green-600 bg-green-50">
              已扫描 {scanHistory.length}
            </Badge>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 扫描区域 */}
          <Card className="p-6">
            <div className="text-center space-y-4">
              <div className="w-32 h-32 mx-auto border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                {isScanning ? (
                  <Loading size="lg" />
                ) : (
                  <div className="text-center">
                    <span className="text-4xl">📱</span>
                    <p className="text-sm text-gray-500 mt-2">扫描区域</p>
                  </div>
                )}
              </div>

              {isScanning ? (
                <p className="text-blue-600 font-medium">正在扫描二维码...</p>
              ) : (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">选择扫描方式</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => simulateScan(`DEMO_QR_${Date.now()}`)}
                      className="flex flex-col items-center py-4"
                    >
                      <span className="text-xl mb-1">📷</span>
                      <span className="text-sm">相机扫描</span>
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center py-4"
                    >
                      <span className="text-xl mb-1">🖼️</span>
                      <span className="text-sm">图片识别</span>
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={handleManualInput}
                    className="w-full"
                  >
                    手动输入二维码
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* 当前扫描结果 */}
          {currentScan && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">扫描结果</h3>
                <Badge className={getStatusColor(currentScan.status)}>
                  {getStatusText(currentScan.status)}
                </Badge>
              </div>

              {currentScan.status === 'success' && currentScan.data ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">产品名称</span>
                      <p className="font-medium text-gray-900">{currentScan.data.productName}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">产品ID</span>
                      <p className="font-medium text-gray-900">{currentScan.data.productId}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">批次号</span>
                      <p className="font-medium text-gray-900">{currentScan.data.batchNumber}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">采收日期</span>
                      <p className="font-medium text-gray-900">{currentScan.data.harvestDate}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">种植地点</span>
                      <p className="font-medium text-gray-900">{currentScan.data.field}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">品种</span>
                      <p className="font-medium text-gray-900">{currentScan.data.variety}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">重量</span>
                      <p className="font-medium text-gray-900">{currentScan.data.weight}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">等级</span>
                      <p className="font-medium text-gray-900">{currentScan.data.quality}</p>
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-3 border-t border-gray-200">
                    <Button
                      onClick={() => confirmScan(currentScan)}
                      className="flex-1"
                    >
                      确认录入
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setCurrentScan(null)}
                      className="flex-1"
                    >
                      重新扫描
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-red-600 mb-3">{currentScan.note || '扫描失败'}</p>
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentScan(null)}
                  >
                    重新扫描
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* 扫描历史 */}
          {scanHistory.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3">扫描历史</h3>
              <div className="space-y-3">
                {scanHistory.slice(0, 5).map((record) => (
                  <div key={record.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          {record.data?.productName || record.qrCode.slice(0, 20)}
                        </span>
                        <Badge className={getStatusColor(record.status)}>
                          {getStatusText(record.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(record.timestamp).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => setCurrentScan(record)}
                    >
                      查看
                    </Button>
                  </div>
                ))}
              </div>

              {scanHistory.length > 5 && (
                <Button variant="ghost" className="w-full mt-3">
                  查看全部历史 ({scanHistory.length})
                </Button>
              )}
            </Card>
          )}

          {/* 批量操作 */}
          {scanHistory.filter(r => r.status === 'success').length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3">批量操作</h3>
              <div className="flex space-x-3">
                <Button variant="secondary" className="flex-1">
                  批量导出 ({scanHistory.filter(r => r.status === 'success').length})
                </Button>
                <Button variant="secondary" className="flex-1">
                  清空历史
                </Button>
              </div>
            </Card>
          )}

          {/* 使用说明 */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">使用说明</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• 将二维码放在扫描框内进行识别</p>
              <p>• 支持相机实时扫描和图片上传识别</p>
              <p>• 可手动输入二维码内容进行查询</p>
              <p>• 扫描结果可批量导出和管理</p>
            </div>
          </Card>
        </div>

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}
