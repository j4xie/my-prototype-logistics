package com.joolun.mall.service;

import java.util.Map;

/**
 * OSS服务接口
 */
public interface OssService {

    /**
     * 生成STS临时凭证 (用于小程序直传OSS)
     *
     * @return 包含临时凭证的Map
     *         - accessKeyId: 临时AccessKey ID
     *         - accessKeySecret: 临时AccessKey Secret
     *         - securityToken: 安全令牌
     *         - expiration: 过期时间
     *         - bucket: Bucket名称
     *         - endpoint: OSS Endpoint
     *         - region: 区域
     */
    Map<String, Object> generateStsToken();

    /**
     * 生成用于小程序直传的签名 (PostObject方式)
     *
     * @param objectKey 目标文件路径 (如: products/2025/01/xxx.jpg)
     * @return 包含签名信息的Map
     *         - policy: Base64编码的Policy
     *         - signature: 签名
     *         - accessKeyId: AccessKey ID
     *         - host: 上传地址
     *         - key: 文件路径
     *         - expire: 过期时间
     */
    Map<String, Object> generateUploadSignature(String objectKey);

    /**
     * 获取OSS配置信息 (用于前端初始化)
     *
     * @return OSS配置信息
     */
    Map<String, Object> getOssConfig();
}
