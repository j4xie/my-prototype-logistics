/**
 * 物流模块API类型声明
 * @description 涵盖运输管理、仓储管理、配送跟踪、路线规划等业务场景
 * @created 2025-06-03 TASK-P3-019A Day 0
 */

import { BaseEntity, BaseResponse, PaginatedResponse, Location } from './shared/base';

// ============ 运输管理 ============

export interface TransportOrder extends BaseEntity {
  orderNumber: string;
  orderType: 'pickup' | 'delivery' | 'transfer';
  priority: 'low' | 'normal' | 'high' | 'urgent';

  // 货物信息
  cargo: {
    productId: string;
    productName: string;
    quantity: number;
    unit: 'piece' | 'box' | 'pallet' | 'kg' | 'ton';
    weight: number; // 总重量(kg)
    volume: number; // 总体积(m³)
    specialRequirements: string[]; // 特殊要求(冷链、防震等)
  }[];

  // 地址信息
  pickup: {
    location: Location;
    contactPerson: string;
    phone: string;
    scheduledTime: string;
    actualTime?: string;
    notes?: string;
  };

  delivery: {
    location: Location;
    contactPerson: string;
    phone: string;
    scheduledTime: string;
    actualTime?: string;
    notes?: string;
  };

  // 运输信息
  transport: {
    vehicleId?: string;
    driverId?: string;
    route?: string;
    estimatedDistance: number; // 预计距离(km)
    estimatedDuration: number; // 预计时长(分钟)
    actualDistance?: number;
    actualDuration?: number;
  };

  // 费用信息
  cost: {
    baseFee: number;
    fuelSurcharge: number;
    specialHandling: number;
    insurance: number;
    total: number;
    currency: string;
  };

  status: 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled' | 'failed';
  trackingEvents: {
    eventId: string;
    eventType: string;
    timestamp: string;
    location?: Location;
    description: string;
    operator: string;
  }[];

  createdBy: string;
  assignedTo?: string;
  notes?: string;
}

export interface CreateTransportOrderRequest {
  orderType: TransportOrder['orderType'];
  priority: TransportOrder['priority'];
  cargo: TransportOrder['cargo'];
  pickup: TransportOrder['pickup'];
  delivery: TransportOrder['delivery'];
  estimatedDistance: number;
  estimatedDuration: number;
  notes?: string;
}

// ============ 车辆管理 ============

export interface Vehicle extends BaseEntity {
  plateNumber: string;
  brand: string;
  model: string;
  year: number;
  vehicleType: 'truck' | 'van' | 'refrigerated' | 'tanker' | 'flatbed';

  // 规格信息
  specifications: {
    maxWeight: number; // 最大载重(kg)
    maxVolume: number; // 最大容积(m³)
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
    fuelType: 'gasoline' | 'diesel' | 'electric' | 'hybrid';
    fuelCapacity: number;
  };

  // 状态信息
  status: 'available' | 'in_use' | 'maintenance' | 'retired';
  location?: Location;
  currentDriver?: string;
  currentLoad?: {
    orderId: string;
    weight: number;
    volume: number;
  };

  // 维护信息
  maintenance: {
    lastService: string;
    nextService: string;
    mileage: number;
    insuranceExpiry: string;
    inspectionExpiry: string;
  };

  // 费用信息
  costs: {
    purchasePrice: number;
    dailyRate: number;
    fuelConsumption: number; // 百公里油耗
    maintenanceCost: number;
  };

  notes?: string;
}

export interface CreateVehicleRequest {
  plateNumber: string;
  brand: string;
  model: string;
  year: number;
  vehicleType: Vehicle['vehicleType'];
  specifications: Vehicle['specifications'];
  maintenance: Vehicle['maintenance'];
  costs: Vehicle['costs'];
  notes?: string;
}

// ============ 司机管理 ============

export interface Driver extends BaseEntity {
  employeeId: string;
  name: string;
  phone: string;
  email: string;

  // 证件信息
  licenses: {
    licenseNumber: string;
    licenseType: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
    issueDate: string;
    expiryDate: string;
    issuingAuthority: string;
  }[];

  // 资质认证
  certifications: {
    certType: 'hazmat' | 'food_safety' | 'refrigerated' | 'oversized';
    certNumber: string;
    issueDate: string;
    expiryDate: string;
  }[];

  // 工作状态
  status: 'available' | 'on_duty' | 'off_duty' | 'on_leave' | 'suspended';
  currentVehicle?: string;
  currentLocation?: Location;

  // 工作记录
  workRecords: {
    date: string;
    hoursWorked: number;
    ordersCompleted: number;
    milesDriven: number;
    incidents?: string[];
  }[];

  // 绩效评估
  performance: {
    rating: number; // 评分(1-5)
    completedOrders: number;
    onTimeDeliveryRate: number;
    fuelEfficiency: number;
    safetyScore: number;
    customerFeedback: number;
  };

  emergencyContact: {
    name: string;
    relation: string;
    phone: string;
  };

  notes?: string;
}

export interface CreateDriverRequest {
  employeeId: string;
  name: string;
  phone: string;
  email: string;
  licenses: Driver['licenses'];
  certifications?: Driver['certifications'];
  emergencyContact: Driver['emergencyContact'];
  notes?: string;
}

// ============ 仓库管理 ============

export interface Warehouse extends BaseEntity {
  name: string;
  code: string;
  location: Location;

  // 仓库规格
  specifications: {
    totalArea: number; // 总面积(m²)
    storageArea: number; // 存储面积(m²)
    capacity: number; // 容量(m³)
    zones: {
      zoneId: string;
      zoneName: string;
      zoneType: 'ambient' | 'refrigerated' | 'frozen' | 'hazmat';
      capacity: number;
      currentOccupancy: number;
    }[];
  };

  // 设施设备
  facilities: {
    temperatureControl: boolean;
    humidityControl: boolean;
    securitySystem: boolean;
    fireProtection: boolean;
    loadingDocks: number;
    forklifts: number;
  };

  // 运营信息
  operations: {
    operatingHours: {
      weekdays: string;
      weekends: string;
      holidays: string;
    };
    staff: {
      managerId: string;
      supervisors: string[];
      workers: string[];
    };
  };

  status: 'active' | 'maintenance' | 'closed';
  certifications: string[];
  notes?: string;
}

export interface CreateWarehouseRequest {
  name: string;
  code: string;
  location: Location;
  specifications: Warehouse['specifications'];
  facilities: Warehouse['facilities'];
  operations: Warehouse['operations'];
  certifications?: string[];
  notes?: string;
}

// ============ 库存管理 ============

export interface InventoryItem extends BaseEntity {
  warehouseId: string;
  productId: string;
  productName: string;
  batchNumber: string;

  // 位置信息
  location: {
    zone: string;
    aisle: string;
    shelf: string;
    position: string;
  };

  // 数量信息
  quantity: {
    total: number;
    available: number;
    reserved: number;
    damaged: number;
    unit: string;
  };

  // 质量信息
  quality: {
    grade: 'A' | 'B' | 'C';
    condition: 'excellent' | 'good' | 'fair' | 'poor';
    expiryDate?: string;
    storageConditions: {
      temperature: number;
      humidity: number;
    };
  };

  // 成本信息
  cost: {
    unitCost: number;
    totalValue: number;
    storageRate: number; // 仓储费率
    currency: string;
  };

  // 移动记录
  movements: {
    movementId: string;
    type: 'inbound' | 'outbound' | 'transfer' | 'adjustment';
    quantity: number;
    timestamp: string;
    operator: string;
    reference: string; // 关联单据号
    notes?: string;
  }[];

  status: 'active' | 'on_hold' | 'expired' | 'damaged';
  notes?: string;
}

export interface CreateInventoryItemRequest {
  warehouseId: string;
  productId: string;
  productName: string;
  batchNumber: string;
  location: InventoryItem['location'];
  quantity: InventoryItem['quantity'];
  quality: InventoryItem['quality'];
  cost: InventoryItem['cost'];
  notes?: string;
}

// ============ API响应类型 ============

// 运输管理API
export type GetTransportOrdersResponse = PaginatedResponse<TransportOrder>;
export type GetTransportOrderResponse = BaseResponse<TransportOrder>;
export type CreateTransportOrderResponse = BaseResponse<TransportOrder>;
export type UpdateTransportOrderResponse = BaseResponse<TransportOrder>;

// 车辆管理API
export type GetVehiclesResponse = PaginatedResponse<Vehicle>;
export type GetVehicleResponse = BaseResponse<Vehicle>;
export type CreateVehicleResponse = BaseResponse<Vehicle>;
export type UpdateVehicleResponse = BaseResponse<Vehicle>;

// 司机管理API
export type GetDriversResponse = PaginatedResponse<Driver>;
export type GetDriverResponse = BaseResponse<Driver>;
export type CreateDriverResponse = BaseResponse<Driver>;
export type UpdateDriverResponse = BaseResponse<Driver>;

// 仓库管理API
export type GetWarehousesResponse = PaginatedResponse<Warehouse>;
export type GetWarehouseResponse = BaseResponse<Warehouse>;
export type CreateWarehouseResponse = BaseResponse<Warehouse>;

// 库存管理API
export type GetInventoryItemsResponse = PaginatedResponse<InventoryItem>;
export type GetInventoryItemResponse = BaseResponse<InventoryItem>;
export type CreateInventoryItemResponse = BaseResponse<InventoryItem>;
export type UpdateInventoryItemResponse = BaseResponse<InventoryItem>;

// 统计数据
export interface LogisticsDashboard {
  activeOrders: number;
  availableVehicles: number;
  availableDrivers: number;
  totalWarehouses: number;
  totalInventoryValue: number;
  averageDeliveryTime: number;
  onTimeDeliveryRate: number;
  fuelConsumption: number;
}

export type GetLogisticsDashboardResponse = BaseResponse<LogisticsDashboard>;
