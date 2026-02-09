package com.cretas.aims.service;

import com.cretas.aims.dto.scale.*;
import com.cretas.aims.entity.scale.*;

import java.util.List;

/**
 * 秤协议适配器服务接口
 * 提供协议管理、数据解析、协议识别等核心功能
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
public interface ScaleProtocolAdapterService {

    // ==================== 协议配置管理 ====================

    /**
     * 获取工厂可用的协议列表 (全局协议 + 工厂专属协议)
     *
     * @param factoryId 工厂ID
     * @return 协议列表
     */
    List<ScaleProtocolDTO> getAvailableProtocols(String factoryId);

    /**
     * 获取协议详情
     *
     * @param protocolId 协议ID
     * @return 协议配置
     */
    ScaleProtocolDTO getProtocolById(String protocolId);

    /**
     * 根据协议编码获取协议
     *
     * @param protocolCode 协议编码
     * @return 协议配置
     */
    ScaleProtocolDTO getProtocolByCode(String protocolCode);

    /**
     * 获取所有内置协议
     *
     * @return 内置协议列表
     */
    List<ScaleProtocolDTO> getBuiltinProtocols();

    // ==================== 品牌型号管理 ====================

    /**
     * 获取所有品牌列表
     *
     * @return 品牌列表 [brandCode, brandName, brandNameEn]
     */
    List<ScaleBrandModelDTO> getAllBrandModels();

    /**
     * 获取推荐的品牌型号
     *
     * @return 推荐品牌型号列表
     */
    List<ScaleBrandModelDTO> getRecommendedBrandModels();

    /**
     * 按秤类型查找品牌型号
     *
     * @param scaleType 秤类型 (DESKTOP, PLATFORM, FLOOR)
     * @return 品牌型号列表
     */
    List<ScaleBrandModelDTO> getBrandModelsByType(String scaleType);

    /**
     * 搜索品牌型号
     *
     * @param keyword 关键词
     * @return 匹配的品牌型号列表
     */
    List<ScaleBrandModelDTO> searchBrandModels(String keyword);

    // ==================== 数据解析 ====================

    /**
     * 根据协议配置解析原始数据
     *
     * @param protocolId 协议ID
     * @param rawData    原始字节数据
     * @return 解析结果 (weight, unit, stable, timestamp)
     */
    ScaleDataParseResult parseScaleData(String protocolId, byte[] rawData);

    /**
     * 根据协议编码解析原始数据
     *
     * @param protocolCode 协议编码
     * @param rawData      原始字节数据
     * @return 解析结果
     */
    ScaleDataParseResult parseScaleDataByCode(String protocolCode, byte[] rawData);

    /**
     * 解析16进制字符串数据
     *
     * @param protocolId  协议ID
     * @param hexData     16进制字符串
     * @return 解析结果
     */
    ScaleDataParseResult parseScaleDataHex(String protocolId, String hexData);

    /**
     * 模拟解析 (不保存，仅测试)
     *
     * @param protocolId  协议ID
     * @param testDataHex 测试数据 (16进制)
     * @return 解析结果
     */
    ScaleDataParseResult dryRunParse(String protocolId, String testDataHex);

    // ==================== 协议自动识别 ====================

    /**
     * AI 辅助协议识别：输入样本数据，返回可能的协议匹配
     *
     * @param sampleData 样本数据
     * @return 可能的协议匹配列表 (按置信度排序)
     */
    List<ProtocolMatchResult> autoDetectProtocol(byte[] sampleData);

    /**
     * AI 辅助协议识别 (16进制输入)
     *
     * @param sampleDataHex 样本数据 (16进制)
     * @return 可能的协议匹配列表
     */
    List<ProtocolMatchResult> autoDetectProtocolHex(String sampleDataHex);

    // ==================== 测试验证 ====================

    /**
     * 运行单个测试用例
     *
     * @param testCaseId 测试用例ID
     * @return 测试结果
     */
    TestCaseResult runTestCase(String testCaseId);

    /**
     * 运行协议的所有测试用例
     *
     * @param protocolId 协议ID
     * @return 测试结果列表
     */
    List<TestCaseResult> runAllTestCases(String protocolId);

    /**
     * 获取协议的测试用例列表
     *
     * @param protocolId 协议ID
     * @return 测试用例列表
     */
    List<ScaleProtocolTestCase> getTestCases(String protocolId);

    // ==================== 工具方法 ====================

    /**
     * 字节数组转16进制字符串
     */
    String bytesToHex(byte[] bytes);

    /**
     * 16进制字符串转字节数组
     */
    byte[] hexToBytes(String hex);

    /**
     * 验证协议配置有效性
     *
     * @param protocolId 协议ID
     * @return 是否有效
     */
    boolean validateProtocolConfig(String protocolId);
}
