import React, { useState, useEffect } from 'react';
import { 
  Badge, 
  Table,
  Loading 
} from '@/components/ui';

/**
 * 加工记录视图组件 - React现代化版本
 * 严格遵循Neo Minimal iOS-Style Admin UI设计规范
 */
const ProcessingRecordView = ({ 
  records = [], 
  loading = false, 
  viewMode = 'list', // 'list', 'detail', 'timeline'
  selectedRecord = null,
  onRecordSelect,
  onRecordClick,
  showTimeline = true,
  showLocation = true,
  showStatus = true,
  emptyMessage = '暂无加工记录'
}) => {
  const [expandedCards, setExpandedCards] = useState(new Set());

  // 状态配置
  const statusConfig = {
    processing: { variant: 'warning', text: '加工中', color: '#FA8C16' },
    completed: { variant: 'success', text: '已完成', color: '#52C41A' },
    quality_check: { variant: 'info', text: '质检中', color: '#1890FF' },
    passed: { variant: 'success', text: '质检通过', color: '#52C41A' },
    failed: { variant: 'error', text: '质检失败', color: '#FF4D4F' },
    packaging: { variant: 'warning', text: '包装中', color: '#FA8C16' },
    ready: { variant: 'success', text: '待出库', color: '#52C41A' },
    pending: { variant: 'default', text: '待处理', color: '#9CA3AF' }
  };

  // 加工类型图标配置
  const processingIcons = {
    slaughter: 'fas fa-cut',
    cleaning: 'fas fa-shower',
    cutting: 'fas fa-knife',
    packaging: 'fas fa-box',
    freezing: 'fas fa-snowflake',
    cooking: 'fas fa-fire',
    mixing: 'fas fa-blender',
    grinding: 'fas fa-cog',
    default: 'fas fa-industry'
  };

  const getProcessingIcon = (processType) => {
    return processingIcons[processType] || processingIcons.default;
  };

  const getStatusInfo = (status) => {
    return statusConfig[status] || statusConfig.pending;
  };

  const formatRecordTime = (timestamp) => {
    if (!timestamp) return '-';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return '今天 ' + date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffDays === 1) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const handleCardExpand = (recordId) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(recordId)) {
      newExpanded.delete(recordId);
    } else {
      newExpanded.add(recordId);
    }
    setExpandedCards(newExpanded);
  };

  const handleRecordClick = (record) => {
    if (onRecordClick) {
      onRecordClick(record);
    } else if (onRecordSelect) {
      onRecordSelect(record);
    }
  };

  // 列表视图渲染
  const renderListView = () => {
    if (loading) {
      return <Loading />;
    }

    if (!records || records.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <div className="text-gray-500">
            <i className="fas fa-search text-4xl mb-4 block"></i>
            <p className="text-sm text-gray-600">{emptyMessage}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {records.map((record) => (
          <ProcessingRecordCard
            key={record.id}
            record={record}
            expanded={expandedCards.has(record.id)}
            onExpand={() => handleCardExpand(record.id)}
            onClick={() => handleRecordClick(record)}
            showStatus={showStatus}
            showLocation={showLocation}
            getProcessingIcon={getProcessingIcon}
            getStatusInfo={getStatusInfo}
            formatRecordTime={formatRecordTime}
          />
        ))}
      </div>
    );
  };

  // 表格视图渲染（桌面端）
  const renderTableView = () => {
    const columns = [
      {
        key: 'batchNumber',
        title: '批次号',
        render: (value, record) => (
          <div className="flex items-center">
            <div className="w-8 h-8 bg-[#E6F7FF] rounded-full flex items-center justify-center mr-3">
              <i className={`${getProcessingIcon(record.processType)} text-[#1890FF] text-sm`}></i>
            </div>
            <div>
              <div className="font-medium">{value || '未知批次'}</div>
              <div className="text-xs text-gray-500">ID: {record.id}</div>
            </div>
          </div>
        )
      },
      {
        key: 'processType',
        title: '加工类型',
        render: (value) => value || '-'
      },
      {
        key: 'productName',
        title: '产品名称',
        render: (value) => value || '-'
      },
      {
        key: 'status',
        title: '状态',
        render: (value) => {
          const statusInfo = getStatusInfo(value);
          return <Badge variant={statusInfo.variant}>{statusInfo.text}</Badge>;
        }
      },
      {
        key: 'timestamp',
        title: '时间',
        render: (value) => formatRecordTime(value),
        align: 'right'
      }
    ];

    if (showLocation) {
      columns.splice(3, 0, {
        key: 'location',
        title: '位置',
        render: (value) => value || '-'
      });
    }

    return (
      <Table
        columns={columns}
        data={records}
        loading={loading}
        emptyText={emptyMessage}
        onRowClick={handleRecordClick}
        responsive={true}
      />
    );
  };

  // 详情视图渲染
  const renderDetailView = () => {
    if (!selectedRecord) {
      return (
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <div className="text-gray-500">
            <i className="fas fa-info-circle text-4xl mb-4 block"></i>
            <p className="text-sm text-gray-600">请选择一条记录查看详情</p>
          </div>
        </div>
      );
    }

    return (
      <ProcessingRecordDetail
        record={selectedRecord}
        showTimeline={showTimeline}
        getProcessingIcon={getProcessingIcon}
        getStatusInfo={getStatusInfo}
        formatRecordTime={formatRecordTime}
      />
    );
  };

  // 根据视图模式渲染不同内容
  const renderContent = () => {
    switch (viewMode) {
      case 'detail':
        return renderDetailView();
      case 'table':
        return renderTableView();
      case 'list':
      default:
        return renderListView();
    }
  };

  return (
    <div className="max-w-[390px] mx-auto">
      {renderContent()}
    </div>
  );
};

// 加工记录卡片组件 - 严格遵循UI设计系统规则
const ProcessingRecordCard = ({ 
  record, 
  expanded, 
  onExpand, 
  onClick, 
  showStatus, 
  showLocation,
  getProcessingIcon,
  getStatusInfo,
  formatRecordTime 
}) => {
  const statusInfo = getStatusInfo(record.status);

  return (
    <div 
      className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      {/* 卡片头部 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center flex-1">
          <div className="w-10 h-10 bg-[#E6F7FF] rounded-full flex items-center justify-center mr-3">
            <i className={`${getProcessingIcon(record.processType)} text-[#1890FF]`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {record.batchNumber || '未知批次'}
            </h3>
            <p className="text-sm text-gray-600 truncate">
              {record.productName || '未知产品'} • ID: {record.id}
            </p>
          </div>
        </div>
        
        {showStatus && (
          <Badge variant={statusInfo.variant} size="small">
            {statusInfo.text}
          </Badge>
        )}
      </div>

      {/* 卡片内容 - 使用grid-cols-2 gap-4布局 */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600">加工类型:</span>
          <span className="ml-1 font-medium">{record.processType || '-'}</span>
        </div>
        <div>
          <span className="text-gray-600">数量:</span>
          <span className="ml-1 font-medium">{record.quantity || '-'}</span>
        </div>
        {showLocation && (
          <div>
            <span className="text-gray-600">位置:</span>
            <span className="ml-1 font-medium">{record.location || '-'}</span>
          </div>
        )}
        <div>
          <span className="text-gray-600">时间:</span>
          <span className="ml-1 font-medium">{formatRecordTime(record.timestamp)}</span>
        </div>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="space-y-2 text-sm">
            {record.description && (
              <div>
                <span className="text-gray-600">描述:</span>
                <p className="mt-1 text-gray-700">{record.description}</p>
              </div>
            )}
            {record.handler && (
              <div>
                <span className="text-gray-600">操作人:</span>
                <span className="ml-1">{record.handler.name || record.handlerName}</span>
              </div>
            )}
            {record.temperature && (
              <div>
                <span className="text-gray-600">温度:</span>
                <span className="ml-1">{record.temperature}°C</span>
              </div>
            )}
            {record.duration && (
              <div>
                <span className="text-gray-600">加工时长:</span>
                <span className="ml-1">{record.duration}分钟</span>
              </div>
            )}
            {record.qualityScore && (
              <div>
                <span className="text-gray-600">质量评分:</span>
                <span className="ml-1">{record.qualityScore}/100</span>
              </div>
            )}
            {record.attachments && record.attachments.length > 0 && (
              <div>
                <span className="text-gray-600">附件:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {record.attachments.map((attachment, index) => (
                    <Badge key={index} variant="default" size="small">
                      <i className="fas fa-paperclip mr-1"></i>
                      {attachment.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 展开/收起按钮 */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className="text-sm text-[#1890FF] hover:text-[#4096FF] flex items-center"
          aria-label={expanded ? '收起详情' : '展开详情'}
        >
          <span>{expanded ? '收起' : '展开详情'}</span>
          <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} ml-1 text-xs`}></i>
        </button>
      </div>
    </div>
  );
};

// 加工记录详情组件 - 严格遵循UI设计系统规则
const ProcessingRecordDetail = ({ 
  record, 
  showTimeline, 
  getProcessingIcon, 
  getStatusInfo, 
  formatRecordTime 
}) => {
  const statusInfo = getStatusInfo(record.status);

  return (
    <div className="space-y-6">
      {/* 详情头部 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-[#E6F7FF] rounded-full flex items-center justify-center mr-4">
              <i className={`${getProcessingIcon(record.processType)} text-[#1890FF] text-xl`}></i>
            </div>
            <div>
              <h1 className="text-lg font-medium text-gray-900">
                {record.batchNumber || '未知批次'}
              </h1>
              <p className="text-sm text-gray-600">{record.productName || '未知产品'} • ID: {record.id}</p>
            </div>
          </div>
          <Badge variant={statusInfo.variant}>
            {statusInfo.text}
          </Badge>
        </div>

        {/* 基本信息网格 - 使用grid-cols-2 gap-4 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">加工类型</div>
            <div className="font-medium">{record.processType || '-'}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">数量</div>
            <div className="font-medium">{record.quantity || '-'}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">位置</div>
            <div className="font-medium">{record.location || '-'}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">操作人</div>
            <div className="font-medium">
              {record.handler?.name || record.handlerName || '-'}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">开始时间</div>
            <div className="font-medium">{formatRecordTime(record.timestamp)}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">状态</div>
            <div className="font-medium">{statusInfo.text}</div>
          </div>
        </div>
      </div>

      {/* 加工参数 */}
      {(record.temperature || record.duration || record.pressure) && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">加工参数</h3>
          <div className="grid grid-cols-2 gap-4">
            {record.temperature && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">温度</div>
                <div className="font-medium">{record.temperature}°C</div>
              </div>
            )}
            {record.duration && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">加工时长</div>
                <div className="font-medium">{record.duration}分钟</div>
              </div>
            )}
            {record.pressure && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">压力</div>
                <div className="font-medium">{record.pressure}Pa</div>
              </div>
            )}
            {record.humidity && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">湿度</div>
                <div className="font-medium">{record.humidity}%</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 质量检测 */}
      {(record.qualityScore || record.qualityNotes) && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">质量检测</h3>
          <div className="grid grid-cols-2 gap-4">
            {record.qualityScore && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">质量评分</div>
                <div className="font-medium">{record.qualityScore}/100</div>
              </div>
            )}
            {record.qualityLevel && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">质量等级</div>
                <div className="font-medium">{record.qualityLevel}</div>
              </div>
            )}
          </div>
          {record.qualityNotes && (
            <div className="mt-3">
              <div className="text-sm text-gray-600 mb-1">质检备注</div>
              <p className="text-gray-700 leading-relaxed">{record.qualityNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* 详细描述 */}
      {record.description && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">详细描述</h3>
          <p className="text-gray-700 leading-relaxed">{record.description}</p>
        </div>
      )}

      {/* 附件 */}
      {record.attachments && record.attachments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">相关附件</h3>
          <div className="grid grid-cols-2 gap-4">
            {record.attachments.map((attachment, index) => (
              <div 
                key={index}
                className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <i className="fas fa-paperclip text-[#1890FF] mr-3"></i>
                <span className="text-sm font-medium truncate">{attachment.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 时间线 */}
      {showTimeline && record.timeline && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">加工时间线</h3>
          <div className="space-y-4">
            {record.timeline.map((item, index) => (
              <div key={index} className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-[#1890FF] rounded-full flex items-center justify-center mr-4">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">
                      {item.operation}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {formatRecordTime(item.timestamp)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                  )}
                  {item.location && (
                    <p className="text-xs text-gray-500 mt-1">
                      <i className="fas fa-map-marker-alt mr-1"></i>
                      {item.location}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingRecordView; 