'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button, Loading, Card, Badge } from '@/components/ui';

interface CertificateData {
  id: string;
  productName: string;
  certificateNo: string;
  grade: string;
  batch: string;
  origin: string;
  productionDate: string;
  shelfLife: string;
  vendor: string;
  inspection: {
    agency: string;
    date: string;
    result: 'qualified' | 'unqualified';
    details: string[];
  };
  qrCodeUrl: string;
  logoUrl: string;
}

export default function TraceCertificatePage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCertificate = async () => {
      try {
        setLoading(true);

        // Mock API call to get certificate data
        const response = await fetch(`/api/trace/${params.id}/certificate`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('证书数据获取失败');
        }

        const data = await response.json();

        // If API doesn't exist, use mock data based on ID
        const mockCertificate: CertificateData = {
          id: params.id as string,
          productName: '有机黑猪肉',
          certificateNo: `${params.id?.toString().toUpperCase()}-CERT`,
          grade: 'A+级',
          batch: `BT-${params.id?.toString().slice(-4)}`,
          origin: '四川省成都市有机农场',
          productionDate: '2025-02-01',
          shelfLife: '90天',
          vendor: '成都有机食材直营店',
          inspection: {
            agency: '四川省食品安全检测中心',
            date: '2025-01-30',
            result: 'qualified',
            details: [
              '蛋白质含量: 21.2g/100g (标准≥18g)',
              '脂肪含量: 3.1g/100g (标准≤5g)',
              '细菌总数: <10³CFU/g (标准≤10⁴CFU/g)',
              '重金属检测: 全部合格',
              '农药残留: 未检出',
              '抗生素检测: 未检出'
            ]
          },
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://trace.example.com/certificate/${params.id}`,
          logoUrl: '/images/logo.png'
        };

        setCertificate(data.success ? data.data : mockCertificate);
      } catch (err) {
        console.error('获取证书数据失败:', err);
        setError(err instanceof Error ? err.message : '证书数据获取失败');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchCertificate();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
        <div className="flex items-center justify-center flex-1">
          <Loading size="lg" />
        </div>
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
        <div className="flex items-center justify-center flex-1 p-4">
          <Card className="w-full text-center p-6">
            <div className="text-red-500 text-lg mb-4">⚠️</div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">证书加载失败</h2>
            <p className="text-sm text-gray-600 mb-4">{error || '证书数据不存在'}</p>
            <Button onClick={() => router.back()} variant="primary">
              返回
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#1890FF] text-white shadow-sm">
        <div className="max-w-[390px] mx-auto flex items-center justify-between p-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="返回上页"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-medium">溯源证书</h1>
          <div className="w-10"></div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 pt-[80px] pb-6">
        {/* Logo Section */}
        <div className="bg-white p-4 text-center mb-4">
          <div className="h-8 mx-auto mb-2 flex items-center justify-center">
            <span className="text-xl font-bold text-[#1890FF]">食品溯源系统</span>
          </div>
          <div className="text-xs text-gray-500">扫码查询产品真伪 · 全程可追溯食品安全</div>
        </div>

        <div className="px-4">
          {/* Certificate Main Card */}
          <Card className="bg-white rounded-xl overflow-hidden shadow-md mb-6">
            {/* Certificate Header */}
            <div className="bg-gradient-to-r from-blue-900 via-blue-700 to-blue-900 text-center text-white p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
              <h1 className="text-xl font-bold mb-1 relative z-10">食品安全溯源证书</h1>
              <p className="text-sm text-white/90 relative z-10">Food Safety Traceability Certificate</p>
            </div>

            {/* Product Information */}
            <div className="p-6">
              {/* Product Header with QR Code */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-[#00467F] mb-1">
                    {certificate.productName} {certificate.grade}
                  </h2>
                  <p className="text-sm text-gray-500">证书编号: {certificate.certificateNo}</p>
                </div>
                <div className="bg-white p-2 rounded-lg shadow-sm">
                  <Image
                    src={certificate.qrCodeUrl}
                    alt="溯源二维码"
                    width={80}
                    height={80}
                    className="w-20 h-20"
                  />
                </div>
              </div>

              {/* Product Details Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-gray-500 text-sm">产品名称</div>
                  <div className="font-medium">{certificate.productName}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-sm">产品批次</div>
                  <div className="font-medium">{certificate.batch}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-sm">产地</div>
                  <div className="font-medium">{certificate.origin}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-sm">生产日期</div>
                  <div className="font-medium">{certificate.productionDate}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-sm">保质期</div>
                  <div className="font-medium">{certificate.shelfLife}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-sm">销售商</div>
                  <div className="font-medium">{certificate.vendor}</div>
                </div>
              </div>

              {/* Inspection Information */}
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[#00467F] font-medium">检验信息</h3>
                                    <Badge
                    variant={certificate.inspection.result === 'qualified' ? 'success' : 'error'}
                  >
                    {certificate.inspection.result === 'qualified' ? '合格' : '不合格'}
                  </Badge>
                </div>

                <div className="text-sm text-gray-700 mb-3">
                  <p className="mb-1">
                    <span className="text-gray-500">检验机构:</span> {certificate.inspection.agency}
                  </p>
                  <p className="mb-1">
                    <span className="text-gray-500">检验日期:</span> {certificate.inspection.date}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">检验项目详情</h4>
                  <div className="space-y-1">
                    {certificate.inspection.details.map((item, index) => (
                      <div key={index} className="text-xs text-gray-600 flex items-center">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Certificate Seal */}
              <div className="flex justify-center mb-4">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 border-2 border-orange-400 rounded-full flex items-center justify-center">
                    <div className="w-20 h-20 bg-orange-400 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-xs text-center leading-tight">
                        官方<br/>认证
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Authority Information */}
              <div className="text-center text-xs text-gray-500 border-t pt-4">
                <p>本证书由四川省食品安全检测中心权威认证</p>
                <p>证书真伪可通过扫描二维码验证</p>
                <p className="mt-2">颁发时间: {certificate.inspection.date}</p>
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => window.print()}
              variant="primary"
              className="w-full"
            >
              打印证书
            </Button>
            <Button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: '食品安全溯源证书',
                    text: `${certificate.productName}的溯源证书`,
                    url: window.location.href,
                  });
                } else {
                  // Fallback for browsers that don't support Web Share API
                  navigator.clipboard.writeText(window.location.href);
                  alert('证书链接已复制到剪贴板');
                }
              }}
              variant="ghost"
              className="w-full"
            >
              分享证书
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
