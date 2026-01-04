/**
 * 秤配置表单 Schema 定义
 *
 * 用于动态渲染电子秤硬件配置表单
 * 包含字段联动：
 * - 品牌型号选择后联动协议列表
 * - 连接类型决定显示串口/API/MQTT配置
 * - 串口配置仅RS232/RS485时显示
 * - API配置仅HTTP_API时显示
 * - MQTT配置仅MQTT时显示
 *
 * @author Cretas Team
 * @since 2026-01-04
 */

import type { FormSchema } from '../core';

/**
 * 连接类型枚举
 */
export type ConnectionType = 'RS232' | 'RS485' | 'HTTP_API' | 'MQTT' | 'MODBUS_RTU' | 'MODBUS_TCP' | 'TCP_SOCKET';

/**
 * 秤配置表单数据类型
 */
export interface ScaleConfigurationFormData {
  // ===== 基本信息 =====
  scaleName: string;              // 秤名称/标识
  description?: string;           // 描述

  // ===== 品牌型号 =====
  brandModelId?: string;          // 品牌型号ID (可选，可手动配置)
  brandCode?: string;             // 品牌代码
  modelCode?: string;             // 型号代码

  // ===== 协议配置 =====
  protocolId?: string;            // 协议配置ID (选择已有协议)
  customProtocol: boolean;        // 是否自定义协议
  connectionType: ConnectionType; // 连接类型

  // ===== 串口配置 (RS232/RS485/MODBUS_RTU) =====
  serialConfig?: {
    comPort: string;              // COM端口
    baudRate: number;             // 波特率
    dataBits: number;             // 数据位
    stopBits: number;             // 停止位
    parity: 'NONE' | 'ODD' | 'EVEN';  // 校验位
  };

  // ===== API配置 (HTTP_API) =====
  apiConfig?: {
    baseUrl: string;              // API基础URL
    authType: 'NONE' | 'BASIC' | 'BEARER' | 'API_KEY';
    apiKey?: string;
    username?: string;
    password?: string;
    headers?: Record<string, string>;
  };

  // ===== MQTT配置 =====
  mqttConfig?: {
    brokerUrl: string;            // Broker地址
    topic: string;                // 订阅主题
    clientId?: string;
    username?: string;
    password?: string;
    qos: 0 | 1 | 2;
  };

  // ===== Modbus配置 (MODBUS_RTU/MODBUS_TCP) =====
  modbusConfig?: {
    slaveId: number;              // 从机地址
    registerAddress: number;      // 寄存器起始地址
    registerCount: number;        // 寄存器数量
    registerType: 'HOLDING' | 'INPUT';
    host?: string;                // TCP模式的主机地址
    port?: number;                // TCP模式的端口
  };

  // ===== 秤参数 =====
  scaleParams: {
    minWeight: number;            // 最小量程 (kg)
    maxWeight: number;            // 最大量程 (kg)
    division: number;             // 分度值 (kg)
    unit: string;                 // 单位
    stableThresholdMs?: number;   // 稳定阈值 (ms)
  };

  // ===== 高级选项 =====
  advancedOptions?: {
    retryCount: number;           // 重试次数
    timeoutMs: number;            // 超时时间 (ms)
    autoReconnect: boolean;       // 自动重连
    reconnectIntervalMs: number;  // 重连间隔 (ms)
  };

  // ===== 关联设备 =====
  equipmentId?: number;           // 关联的工厂设备ID
}

/**
 * 秤配置表单 Schema
 */
export const scaleConfigurationSchema: FormSchema = {
  type: 'object',
  properties: {
    // ========== 基本信息 ==========
    scaleName: {
      type: 'string',
      title: '秤名称',
      required: true,
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: '例如：包装车间1号秤',
      },
      'x-validator': [
        { required: true, message: '请输入秤名称' },
        { maxLength: 100, message: '名称不能超过100个字符' },
      ],
    },

    description: {
      type: 'string',
      title: '描述',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        multiline: true,
        numberOfLines: 2,
        placeholder: '秤的用途说明 (选填)',
      },
    },

    // ========== 品牌型号选择 ==========
    brandModelId: {
      type: 'string',
      title: '品牌型号',
      description: '选择已知的秤品牌型号，将自动填充协议配置',
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '请选择品牌型号 (可选)',
        allowClear: true,
      },
      enum: [], // 运行时动态填充
    },

    // ========== 协议选择 ==========
    protocolId: {
      type: 'string',
      title: '通信协议',
      description: '选择已配置的协议或自定义',
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '请选择通信协议',
      },
      enum: [], // 运行时动态填充
      // 联动：根据品牌型号过滤可用协议
      'x-reactions': [
        {
          dependencies: ['brandModelId'],
          fulfill: {
            state: {
              // 选择品牌型号后，协议列表将被过滤 (由前端逻辑处理)
              dataSource: '{{$deps[0] ? filterProtocolsByBrandModel($deps[0]) : getAllProtocols()}}',
            },
          },
        },
      ],
    },

    customProtocol: {
      type: 'boolean',
      title: '自定义协议',
      default: false,
      'x-decorator': 'FormItem',
      'x-component': 'Switch',
      'x-component-props': {
        label: '使用自定义协议配置',
      },
    },

    // ========== 连接类型 ==========
    connectionType: {
      type: 'string',
      title: '连接类型',
      required: true,
      default: 'RS232',
      enum: [
        { label: 'RS232 串口', value: 'RS232' },
        { label: 'RS485 总线', value: 'RS485' },
        { label: 'HTTP API', value: 'HTTP_API' },
        { label: 'MQTT', value: 'MQTT' },
        { label: 'Modbus RTU', value: 'MODBUS_RTU' },
        { label: 'Modbus TCP', value: 'MODBUS_TCP' },
        { label: 'TCP Socket', value: 'TCP_SOCKET' },
      ],
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '请选择连接类型',
      },
      'x-validator': [
        { required: true, message: '请选择连接类型' },
      ],
      // 联动：仅自定义协议时可修改
      'x-reactions': {
        dependencies: ['customProtocol', 'protocolId'],
        fulfill: {
          state: {
            disabled: '{{!$deps[0] && $deps[1]}}',
          },
        },
      },
    },

    // ========== 串口配置 ==========
    serialConfig: {
      type: 'object',
      title: '串口配置',
      'x-decorator': 'FormItem',
      // 联动：仅串口类型时显示
      'x-reactions': {
        dependencies: ['connectionType'],
        fulfill: {
          state: {
            visible: '{{["RS232", "RS485", "MODBUS_RTU"].includes($deps[0])}}',
          },
        },
      },
      properties: {
        comPort: {
          type: 'string',
          title: 'COM端口',
          required: true,
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-component-props': {
            placeholder: '例如：COM3 或 /dev/ttyUSB0',
          },
          'x-validator': [
            { required: true, message: '请输入COM端口' },
          ],
        },
        baudRate: {
          type: 'number',
          title: '波特率',
          required: true,
          default: 9600,
          enum: [
            { label: '1200', value: 1200 },
            { label: '2400', value: 2400 },
            { label: '4800', value: 4800 },
            { label: '9600', value: 9600 },
            { label: '19200', value: 19200 },
            { label: '38400', value: 38400 },
            { label: '57600', value: 57600 },
            { label: '115200', value: 115200 },
          ],
          'x-decorator': 'FormItem',
          'x-component': 'Select',
          'x-component-props': {
            placeholder: '选择波特率',
          },
        },
        dataBits: {
          type: 'number',
          title: '数据位',
          default: 8,
          enum: [
            { label: '7', value: 7 },
            { label: '8', value: 8 },
          ],
          'x-decorator': 'FormItem',
          'x-component': 'Select',
        },
        stopBits: {
          type: 'number',
          title: '停止位',
          default: 1,
          enum: [
            { label: '1', value: 1 },
            { label: '2', value: 2 },
          ],
          'x-decorator': 'FormItem',
          'x-component': 'Select',
        },
        parity: {
          type: 'string',
          title: '校验位',
          default: 'NONE',
          enum: [
            { label: '无校验', value: 'NONE' },
            { label: '奇校验', value: 'ODD' },
            { label: '偶校验', value: 'EVEN' },
          ],
          'x-decorator': 'FormItem',
          'x-component': 'Select',
        },
      },
    },

    // ========== API配置 ==========
    apiConfig: {
      type: 'object',
      title: 'API配置',
      'x-decorator': 'FormItem',
      // 联动：仅HTTP_API时显示
      'x-reactions': {
        dependencies: ['connectionType'],
        fulfill: {
          state: {
            visible: '{{$deps[0] === "HTTP_API"}}',
          },
        },
      },
      properties: {
        baseUrl: {
          type: 'string',
          title: 'API地址',
          required: true,
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-component-props': {
            placeholder: '例如：https://api.scale.example.com',
          },
          'x-validator': [
            { required: true, message: '请输入API地址' },
            { format: 'url', message: '请输入有效的URL' },
          ],
        },
        authType: {
          type: 'string',
          title: '认证方式',
          default: 'NONE',
          enum: [
            { label: '无认证', value: 'NONE' },
            { label: 'Basic Auth', value: 'BASIC' },
            { label: 'Bearer Token', value: 'BEARER' },
            { label: 'API Key', value: 'API_KEY' },
          ],
          'x-decorator': 'FormItem',
          'x-component': 'Select',
        },
        apiKey: {
          type: 'string',
          title: 'API Key',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-component-props': {
            placeholder: '输入API Key',
            secureTextEntry: true,
          },
          'x-reactions': {
            dependencies: ['apiConfig.authType'],
            fulfill: {
              state: {
                visible: '{{$deps[0] === "API_KEY" || $deps[0] === "BEARER"}}',
              },
            },
          },
        },
        username: {
          type: 'string',
          title: '用户名',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-reactions': {
            dependencies: ['apiConfig.authType'],
            fulfill: {
              state: {
                visible: '{{$deps[0] === "BASIC"}}',
              },
            },
          },
        },
        password: {
          type: 'string',
          title: '密码',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-component-props': {
            secureTextEntry: true,
          },
          'x-reactions': {
            dependencies: ['apiConfig.authType'],
            fulfill: {
              state: {
                visible: '{{$deps[0] === "BASIC"}}',
              },
            },
          },
        },
      },
    },

    // ========== MQTT配置 ==========
    mqttConfig: {
      type: 'object',
      title: 'MQTT配置',
      'x-decorator': 'FormItem',
      // 联动：仅MQTT时显示
      'x-reactions': {
        dependencies: ['connectionType'],
        fulfill: {
          state: {
            visible: '{{$deps[0] === "MQTT"}}',
          },
        },
      },
      properties: {
        brokerUrl: {
          type: 'string',
          title: 'Broker地址',
          required: true,
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-component-props': {
            placeholder: '例如：tcp://mqtt.example.com:1883',
          },
          'x-validator': [
            { required: true, message: '请输入Broker地址' },
          ],
        },
        topic: {
          type: 'string',
          title: '订阅主题',
          required: true,
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-component-props': {
            placeholder: '例如：cretas/factory/scale/+',
          },
          'x-validator': [
            { required: true, message: '请输入订阅主题' },
          ],
        },
        clientId: {
          type: 'string',
          title: '客户端ID',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-component-props': {
            placeholder: '留空自动生成',
          },
        },
        username: {
          type: 'string',
          title: '用户名',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
        },
        password: {
          type: 'string',
          title: '密码',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-component-props': {
            secureTextEntry: true,
          },
        },
        qos: {
          type: 'number',
          title: 'QoS级别',
          default: 1,
          enum: [
            { label: 'QoS 0 (最多一次)', value: 0 },
            { label: 'QoS 1 (至少一次)', value: 1 },
            { label: 'QoS 2 (恰好一次)', value: 2 },
          ],
          'x-decorator': 'FormItem',
          'x-component': 'Select',
        },
      },
    },

    // ========== Modbus配置 ==========
    modbusConfig: {
      type: 'object',
      title: 'Modbus配置',
      'x-decorator': 'FormItem',
      // 联动：仅Modbus时显示
      'x-reactions': {
        dependencies: ['connectionType'],
        fulfill: {
          state: {
            visible: '{{["MODBUS_RTU", "MODBUS_TCP"].includes($deps[0])}}',
          },
        },
      },
      properties: {
        slaveId: {
          type: 'number',
          title: '从机地址',
          default: 1,
          minimum: 1,
          maximum: 247,
          'x-decorator': 'FormItem',
          'x-component': 'NumberInput',
          'x-component-props': {
            placeholder: '1-247',
          },
          'x-validator': [
            { required: true, message: '请输入从机地址' },
            { minimum: 1, message: '从机地址最小为1' },
            { maximum: 247, message: '从机地址最大为247' },
          ],
        },
        registerAddress: {
          type: 'number',
          title: '寄存器地址',
          default: 0,
          'x-decorator': 'FormItem',
          'x-component': 'NumberInput',
          'x-component-props': {
            placeholder: '起始寄存器地址',
          },
        },
        registerCount: {
          type: 'number',
          title: '寄存器数量',
          default: 2,
          minimum: 1,
          'x-decorator': 'FormItem',
          'x-component': 'NumberInput',
        },
        registerType: {
          type: 'string',
          title: '寄存器类型',
          default: 'HOLDING',
          enum: [
            { label: '保持寄存器 (03H)', value: 'HOLDING' },
            { label: '输入寄存器 (04H)', value: 'INPUT' },
          ],
          'x-decorator': 'FormItem',
          'x-component': 'Select',
        },
        host: {
          type: 'string',
          title: '主机地址',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-component-props': {
            placeholder: 'TCP模式主机IP',
          },
          'x-reactions': {
            dependencies: ['connectionType'],
            fulfill: {
              state: {
                visible: '{{$deps[0] === "MODBUS_TCP"}}',
                required: '{{$deps[0] === "MODBUS_TCP"}}',
              },
            },
          },
        },
        port: {
          type: 'number',
          title: '端口',
          default: 502,
          'x-decorator': 'FormItem',
          'x-component': 'NumberInput',
          'x-reactions': {
            dependencies: ['connectionType'],
            fulfill: {
              state: {
                visible: '{{$deps[0] === "MODBUS_TCP"}}',
              },
            },
          },
        },
      },
    },

    // ========== 秤参数 ==========
    scaleParams: {
      type: 'object',
      title: '秤参数',
      'x-decorator': 'FormItem',
      properties: {
        minWeight: {
          type: 'number',
          title: '最小量程 (kg)',
          default: 0,
          minimum: 0,
          'x-decorator': 'FormItem',
          'x-component': 'NumberInput',
          'x-component-props': {
            step: 0.1,
            precision: 2,
          },
        },
        maxWeight: {
          type: 'number',
          title: '最大量程 (kg)',
          required: true,
          default: 150,
          minimum: 0.1,
          'x-decorator': 'FormItem',
          'x-component': 'NumberInput',
          'x-component-props': {
            step: 1,
            precision: 1,
            placeholder: '例如：150',
          },
          'x-validator': [
            { required: true, message: '请输入最大量程' },
            { minimum: 0.1, message: '最大量程必须大于0' },
          ],
        },
        division: {
          type: 'number',
          title: '分度值 (kg)',
          required: true,
          default: 0.01,
          'x-decorator': 'FormItem',
          'x-component': 'NumberInput',
          'x-component-props': {
            step: 0.001,
            precision: 3,
            placeholder: '例如：0.01',
          },
          'x-validator': [
            { required: true, message: '请输入分度值' },
          ],
        },
        unit: {
          type: 'string',
          title: '单位',
          default: 'kg',
          enum: [
            { label: '千克 (kg)', value: 'kg' },
            { label: '克 (g)', value: 'g' },
            { label: '磅 (lb)', value: 'lb' },
          ],
          'x-decorator': 'FormItem',
          'x-component': 'Select',
        },
        stableThresholdMs: {
          type: 'number',
          title: '稳定阈值 (ms)',
          default: 1000,
          minimum: 100,
          'x-decorator': 'FormItem',
          'x-component': 'NumberInput',
          'x-component-props': {
            step: 100,
            placeholder: '稳定判定时间',
          },
        },
      },
    },

    // ========== 高级选项 ==========
    advancedOptions: {
      type: 'object',
      title: '高级选项',
      'x-decorator': 'FormItem',
      properties: {
        retryCount: {
          type: 'number',
          title: '重试次数',
          default: 3,
          minimum: 0,
          maximum: 10,
          'x-decorator': 'FormItem',
          'x-component': 'NumberInput',
        },
        timeoutMs: {
          type: 'number',
          title: '超时时间 (ms)',
          default: 5000,
          minimum: 1000,
          'x-decorator': 'FormItem',
          'x-component': 'NumberInput',
          'x-component-props': {
            step: 1000,
          },
        },
        autoReconnect: {
          type: 'boolean',
          title: '自动重连',
          default: true,
          'x-decorator': 'FormItem',
          'x-component': 'Switch',
        },
        reconnectIntervalMs: {
          type: 'number',
          title: '重连间隔 (ms)',
          default: 5000,
          minimum: 1000,
          'x-decorator': 'FormItem',
          'x-component': 'NumberInput',
          'x-component-props': {
            step: 1000,
          },
          'x-reactions': {
            dependencies: ['advancedOptions.autoReconnect'],
            fulfill: {
              state: {
                visible: '{{$deps[0] === true}}',
              },
            },
          },
        },
      },
    },

    // ========== 关联设备 ==========
    equipmentId: {
      type: 'number',
      title: '关联设备',
      description: '选择关联的工厂设备记录',
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '选择关联设备 (可选)',
        allowClear: true,
      },
      enum: [], // 运行时动态填充
    },
  },
};

/**
 * 秤配置表单默认值
 */
export const scaleConfigurationDefaultValues: Partial<ScaleConfigurationFormData> = {
  customProtocol: false,
  connectionType: 'RS232',
  serialConfig: {
    comPort: '',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'NONE',
  },
  scaleParams: {
    minWeight: 0,
    maxWeight: 150,
    division: 0.01,
    unit: 'kg',
    stableThresholdMs: 1000,
  },
  advancedOptions: {
    retryCount: 3,
    timeoutMs: 5000,
    autoReconnect: true,
    reconnectIntervalMs: 5000,
  },
};

/**
 * 常用秤预设配置
 */
export const scalePresets: Record<string, Partial<ScaleConfigurationFormData>> = {
  /**
   * 柯力 D2008 预设
   */
  KELI_D2008: {
    scaleName: '柯力D2008',
    connectionType: 'RS232',
    serialConfig: {
      comPort: 'COM3',
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'NONE',
    },
    scaleParams: {
      minWeight: 0,
      maxWeight: 150,
      division: 0.02,
      unit: 'kg',
      stableThresholdMs: 1000,
    },
  },

  /**
   * 耀华 XK3190 预设
   */
  YAOHUA_XK3190: {
    scaleName: '耀华XK3190',
    connectionType: 'RS232',
    serialConfig: {
      comPort: 'COM3',
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'NONE',
    },
    scaleParams: {
      minWeight: 0,
      maxWeight: 150,
      division: 0.02,
      unit: 'kg',
      stableThresholdMs: 1000,
    },
  },

  /**
   * 矽策 XC709S WiFi秤 预设
   */
  XICE_XC709S: {
    scaleName: '矽策XC709S',
    connectionType: 'HTTP_API',
    apiConfig: {
      baseUrl: 'http://192.168.1.100',
      authType: 'NONE',
    },
    scaleParams: {
      minWeight: 0,
      maxWeight: 30,
      division: 0.001,
      unit: 'kg',
      stableThresholdMs: 500,
    },
  },

  /**
   * 微型桌面秤 预设
   */
  MICRO_SCALE: {
    scaleName: '微型桌面秤',
    connectionType: 'RS232',
    serialConfig: {
      comPort: 'COM3',
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'NONE',
    },
    scaleParams: {
      minWeight: 0,
      maxWeight: 30,
      division: 0.001,
      unit: 'kg',
      stableThresholdMs: 500,
    },
  },

  /**
   * 地磅 预设
   */
  FLOOR_SCALE: {
    scaleName: '地磅',
    connectionType: 'RS232',
    serialConfig: {
      comPort: 'COM3',
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'NONE',
    },
    scaleParams: {
      minWeight: 0,
      maxWeight: 1000,
      division: 0.5,
      unit: 'kg',
      stableThresholdMs: 2000,
    },
  },
};

export default scaleConfigurationSchema;
