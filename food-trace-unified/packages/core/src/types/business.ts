// 业务相关类型定义
export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  batchId: string;
  specifications: Record<string, any>;
  images: string[];
  qrCode: string;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Batch {
  id: string;
  batchNumber: string;
  products: Product[];
  status: BatchStatus;
  qrCode: string;
  farmingData?: FarmingData;
  processingData?: ProcessingData;
  logisticsData?: LogisticsData;
  traceabilityData: TraceRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TraceRecord {
  id: string;
  batchId: string;
  stage: TraceStage;
  timestamp: Date;
  location: Location;
  operator: User;
  data: Record<string, any>;
  verified: boolean;
  documents: Document[];
  photos: string[];
}

export interface TraceStep {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  status: 'completed' | 'in-progress' | 'pending';
  documents: Document[];
  photos: string[];
  location?: Location;
  operator?: User;
}

export interface FarmingData {
  farmId: string;
  farmName: string;
  fieldId: string;
  fieldName: string;
  cropType: string;
  seedSource: string;
  plantingDate: Date;
  harvestDate: Date;
  environmentData: EnvironmentData[];
  treatments: Treatment[];
  certifications: Certification[];
}

export interface ProcessingData {
  facilityId: string;
  facilityName: string;
  processType: string;
  batchSize: number;
  temperature?: number;
  humidity?: number;
  duration: number;
  additives: Additive[];
  qualityChecks: QualityCheck[];
  equipment: Equipment[];
}

export interface LogisticsData {
  carrierId: string;
  carrierName: string;
  vehicleId: string;
  vehiclePlate: string;
  driverName: string;
  origin: Location;
  destination: Location;
  departureTime: Date;
  arrivalTime?: Date;
  route: Location[];
  temperatureLog: TemperatureRecord[];
}

export interface EnvironmentData {
  timestamp: Date;
  temperature: number;
  humidity: number;
  rainfall: number;
  soilPH: number;
  soilMoisture: number;
  lightIntensity: number;
}

export interface Treatment {
  id: string;
  type: 'fertilizer' | 'pesticide' | 'medicine' | 'vaccine';
  name: string;
  dosage: string;
  applicationDate: Date;
  operator: string;
  notes?: string;
}

export interface QualityCheck {
  id: string;
  type: string;
  result: 'pass' | 'fail' | 'warning';
  value?: number;
  unit?: string;
  standard?: string;
  inspector: User;
  timestamp: Date;
  notes?: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  name?: string;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  uploadedBy: User;
  uploadedAt: Date;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: Date;
  expiryDate: Date;
  certificateNumber: string;
  documentUrl?: string;
}

export interface Additive {
  id: string;
  name: string;
  type: string;
  amount: number;
  unit: string;
  purpose: string;
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  model: string;
  operator: string;
  operationTime: number;
  maintenanceDate?: Date;
}

export interface TemperatureRecord {
  timestamp: Date;
  temperature: number;
  humidity?: number;
  location?: Location;
}

export type ProductCategory = 'grain' | 'vegetable' | 'fruit' | 'meat' | 'dairy' | 'seafood' | 'processed';
export type ProductStatus = 'growing' | 'harvested' | 'processing' | 'packaged' | 'shipped' | 'delivered' | 'sold';
export type BatchStatus = 'active' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'recalled';
export type TraceStage = 'farming' | 'processing' | 'logistics' | 'retail' | 'consumer';

// 农业管理相关类型
export interface Farm {
  id: string;
  name: string;
  owner: User;
  location: Location;
  area: number;
  fields: Field[];
  certifications: Certification[];
  createdAt: Date;
}

export interface Field {
  id: string;
  name: string;
  farmId: string;
  area: number;
  soilType: string;
  status: 'active' | 'fallow' | 'maintenance';
  currentCrop?: Crop;
  location: Location;
}

export interface Crop {
  id: string;
  name: string;
  variety: string;
  category: ProductCategory;
  growthCycle: number; // days
  expectedYield: number;
  plantingDate?: Date;
  expectedHarvestDate?: Date;
}

// 统计数据类型
export interface DashboardStats {
  totalProducts: number;
  activeBatches: number;
  completedTraces: number;
  qualityScore: number;
  monthlyGrowth: number;
  alerts: AlertItem[];
}

export interface AlertItem {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}