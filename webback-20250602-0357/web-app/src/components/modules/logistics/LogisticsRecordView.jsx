import React, { useState, useEffect } from 'react';
import { 
  Badge, 
  Table,
  Loading 
} from '@/components/ui';

/**
 * 物流记录视图组件 - React现代化版本
 * 严格遵循Neo Minimal iOS-Style Admin UI设计规范
 */
const LogisticsRecordView = ({ 
  records = [], 
  loading = false, 
  viewMode = 'list', // 'list', 'detail', 'timeline'
  selectedRecord = null,
  onRecordSelect,
  onRecordClick,
  showTimeline = true,
  showLocation = true,
  showStatus = true,
  emptyMessage = '暂无物流记录'
}) => {
  const [expandedCards, setExpandedCards] = useState(new Set());

  // 状态配置
  const statusConfig = {
    pending: { variant: 'default', text: '待发货', color: '#9CA3AF' },
    picked_up: { variant: 'warning', text: '已取件', color: '#FA8C16' },
    in_transit: { variant: 'info', text: '运输中', color: '#1890FF' },
    out_for_delivery: { variant: 'warning', text: '派送中', color: '#FA8C16' },
    delivered: { variant: 'success', text: '已送达', color: '#52C41A' },
    failed: { variant: 'error', text: '派送失败', color: '#FF4D4F' },
    returned: { variant: 'error', text: '已退回', color: '#FF4D4F' },
    exception: { variant: 'error', text: '异常', color: '#FF4D4F' }
  };

  // 物流类型图标配置
  const logisticsIcons = {
    road: 'fas fa-truck',
    rail: 'fas fa-train',
    air: 'fas fa-plane',
    sea: 'fas fa-ship',
    express: 'fas fa-shipping-fast',
    cold_chain: 'fas fa-snowflake',
    bulk: 'fas fa-boxes',
    container: 'fas fa-container-storage',
    default: 'fas fa-truck'
  };

  const getLogisticsIcon = (transportType) => {
    return logisticsIcons[transportType] || logisticsIcons.default;
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
          <LogisticsRecordCard
            key={record.id}
            record={record}
            expanded={expandedCards.has(record.id)}
            onExpand={() => handleCardExpand(record.id)}
            onClick={() => handleRecordClick(record)}
            showStatus={showStatus}
            showLocation={showLocation}
            getLogisticsIcon={getLogisticsIcon}
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
        key: 'trackingNumber',
        title: '运单号',
        render: (value, record) => (
          <div className="flex items-center">
            <div className="w-8 h-8 bg-[#E6F7FF] rounded-full flex items-center justify-center mr-3">
              <i className={`${getLogisticsIcon(record.transportType)} text-[#1890FF] text-sm`}></i>
            </div>
            <div>
              <div className="font-medium">{value || '未知运单'}</div>
              <div className="text-xs text-gray-500">ID: {record.id}</div>
            </div>
          </div>
        )
      },
      {
        key: 'transportType',
        title: '运输方式',
        render: (value) => value || '-'
      },
      {
        key: 'destination',
        title: '目的地',
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
        key: 'currentLocation',
        title: '当前位置',
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
      <LogisticsRecordDetail
        record={selectedRecord}
        showTimeline={showTimeline}
        getLogisticsIcon={getLogisticsIcon}
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

// 物流记录卡片组件 - 严格遵循UI设计系统规则
const LogisticsRecordCard = ({ 
  record, 
  expanded, 
  onExpand, 
  onClick, 
  showStatus, 
  showLocation,
  getLogisticsIcon,
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
            <i className={`${getLogisticsIcon(record.transportType)} text-[#1890FF]`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {record.trackingNumber || '未知运单'}
            </h3>
            <p className="text-sm text-gray-600 truncate">
              {record.transportType || '未知方式'} • ID: {record.id}
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
          <span className="text-gray-600">起点:</span>
          <span className="ml-1 font-medium">{record.origin || '-'}</span>
        </div>
        <div>
          <span className="text-gray-600">终点:</span>
          <span className="ml-1 font-medium">{record.destination || '-'}</span>
        </div>
        {showLocation && (
          <div>
            <span className="text-gray-600">当前位置:</span>
            <span className="ml-1 font-medium">{record.currentLocation || '-'}</span>
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
            {record.driver && (
              <div>
                <span className="text-gray-600">司机:</span>
                <span className="ml-1">{record.driver.name || record.driverName}</span>
              </div>
            )}
            {record.vehicle && (
              <div>
                <span className="text-gray-600">车辆:</span>
                <span className="ml-1">{record.vehicle.plateNumber || record.vehicleNumber}</span>
              </div>
            )}
            {record.estimatedDelivery && (
              <div>
                <span className="text-gray-600">预计送达:</span>
                <span className="ml-1">{formatRecordTime(record.estimatedDelivery)}</span>
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

// 物流记录详情组件 - 严格遵循UI设计系统规则
const LogisticsRecordDetail = ({ 
  record, 
  showTimeline, 
  getLogisticsIcon, 
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
              <i className={`${getLogisticsIcon(record.transportType)} text-[#1890FF] text-xl`}></i>
            </div>
            <div>
              <h1 className="text-lg font-medium text-gray-900">
                {record.trackingNumber || '未知运单'}
              </h1>
              <p className="text-sm text-gray-600">{record.transportType || '未知方式'} • ID: {record.id}</p>
            </div>
          </div>
          <Badge variant={statusInfo.variant}>
            {statusInfo.text}
          </Badge>
        </div>

        {/* 基本信息网格 - 使用grid-cols-2 gap-4 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">起点</div>
            <div className="font-medium">{record.origin || '-'}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">终点</div>
            <div className="font-medium">{record.destination || '-'}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">当前位置</div>
            <div className="font-medium">{record.currentLocation || '-'}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">运输方式</div>
            <div className="font-medium">{record.transportType || '-'}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">发货时间</div>
            <div className="font-medium">{formatRecordTime(record.timestamp)}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">状态</div>
            <div className="font-medium">{statusInfo.text}</div>
          </div>
        </div>
      </div>

      {/* 运输信息 */}
      {(record.driver || record.vehicle || record.estimatedDelivery) && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">运输信息</h3>
          <div className="grid grid-cols-2 gap-4">
            {record.driver && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">司机</div>
                <div className="font-medium">{record.driver.name || record.driverName}</div>
                {record.driver.phone && (
                  <div className="text-xs text-gray-500">{record.driver.phone}</div>
                )}
              </div>
            )}
            {record.vehicle && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">车辆</div>
                <div className="font-medium">{record.vehicle.plateNumber || record.vehicleNumber}</div>
                {record.vehicle.type && (
                  <div className="text-xs text-gray-500">{record.vehicle.type}</div>
                )}
              </div>
            )}
            {record.estimatedDelivery && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">预计送达</div>
                <div className="font-medium">{formatRecordTime(record.estimatedDelivery)}</div>
              </div>
            )}
            {record.distance && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">运输距离</div>
                <div className="font-medium">{record.distance}km</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 货物信息 */}
      {(record.cargo || record.weight || record.volume) && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">货物信息</h3>
          <div className="grid grid-cols-2 gap-4">
            {record.cargo && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">货物名称</div>
                <div className="font-medium">{record.cargo.name || record.cargoName}</div>
              </div>
            )}
            {record.weight && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">重量</div>
                <div className="font-medium">{record.weight}kg</div>
              </div>
            )}
            {record.volume && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">体积</div>
                <div className="font-medium">{record.volume}m³</div>
              </div>
            )}
            {record.temperature && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">运输温度</div>
                <div className="font-medium">{record.temperature}°C</div>
              </div>
            )}
          </div>
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
          <h3 className="text-lg font-medium text-gray-900 mb-4">物流时间线</h3>
          <div className="space-y-4">
            {record.timeline.map((item, index) => (
              <div key={index} className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-[#1890FF] rounded-full flex items-center justify-center mr-4">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">
                      {item.operation || item.status}
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

export default LogisticsRecordView; 