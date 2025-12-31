package com.joolun.mall.service.impl;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.common.utils.BinaryUtil;
import com.aliyun.oss.model.MatchMode;
import com.aliyun.oss.model.PolicyConditions;
import com.aliyuncs.DefaultAcsClient;
import com.aliyuncs.auth.sts.AssumeRoleRequest;
import com.aliyuncs.auth.sts.AssumeRoleResponse;
import com.aliyuncs.http.MethodType;
import com.aliyuncs.profile.DefaultProfile;
import com.aliyuncs.profile.IClientProfile;
import com.joolun.mall.config.OssConfigProperties;
import com.joolun.mall.service.OssService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * OSS服务实现类
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OssServiceImpl implements OssService {

    private final OssConfigProperties ossConfig;

    // STS角色ARN (需要在阿里云RAM中配置)
    private static final String ROLE_ARN = "acs:ram::your-account-id:role/oss-upload-role";
    private static final String ROLE_SESSION_NAME = "mall-miniprogram-upload";

    @Override
    public Map<String, Object> generateStsToken() {
        Map<String, Object> result = new HashMap<>();

        try {
            // 创建STS客户端
            String stsEndpoint = "sts." + ossConfig.getRegion() + ".aliyuncs.com";
            IClientProfile profile = DefaultProfile.getProfile(
                ossConfig.getRegion(),
                ossConfig.getAccessKeyId(),
                ossConfig.getAccessKeySecret()
            );
            DefaultAcsClient client = new DefaultAcsClient(profile);

            // 创建AssumeRole请求
            AssumeRoleRequest request = new AssumeRoleRequest();
            request.setSysMethod(MethodType.POST);
            request.setRoleArn(ROLE_ARN);
            request.setRoleSessionName(ROLE_SESSION_NAME);
            request.setDurationSeconds(ossConfig.getStsExpireSeconds());

            // 调用STS服务
            AssumeRoleResponse response = client.getAcsResponse(request);
            AssumeRoleResponse.Credentials credentials = response.getCredentials();

            // 返回临时凭证
            result.put("accessKeyId", credentials.getAccessKeyId());
            result.put("accessKeySecret", credentials.getAccessKeySecret());
            result.put("securityToken", credentials.getSecurityToken());
            result.put("expiration", credentials.getExpiration());
            result.put("bucket", ossConfig.getBucket());
            result.put("endpoint", ossConfig.getEndpoint());
            result.put("region", ossConfig.getRegion());

            log.info("STS临时凭证生成成功, 过期时间: {}", credentials.getExpiration());

        } catch (Exception e) {
            log.error("生成STS临时凭证失败", e);
            throw new RuntimeException("生成上传凭证失败: " + e.getMessage());
        }

        return result;
    }

    @Override
    public Map<String, Object> generateUploadSignature(String objectKey) {
        Map<String, Object> result = new HashMap<>();

        OSS ossClient = null;
        try {
            // 创建OSS客户端
            ossClient = new OSSClientBuilder().build(
                "https://" + ossConfig.getEndpoint(),
                ossConfig.getAccessKeyId(),
                ossConfig.getAccessKeySecret()
            );

            // 设置过期时间 (30分钟)
            long expireTime = System.currentTimeMillis() + ossConfig.getStsExpireSeconds() * 1000;
            Date expiration = new Date(expireTime);

            // 创建Policy条件
            PolicyConditions policyConditions = new PolicyConditions();
            // 限制文件大小 (最大10MB)
            policyConditions.addConditionItem(PolicyConditions.COND_CONTENT_LENGTH_RANGE, 0, 10 * 1024 * 1024);
            // 限制文件路径前缀
            policyConditions.addConditionItem(MatchMode.StartWith, PolicyConditions.COND_KEY, objectKey);

            // 生成Policy
            String postPolicy = ossClient.generatePostPolicy(expiration, policyConditions);
            byte[] binaryData = postPolicy.getBytes(StandardCharsets.UTF_8);
            String encodedPolicy = BinaryUtil.toBase64String(binaryData);

            // 生成签名
            String signature = ossClient.calculatePostSignature(postPolicy);

            // 构建结果
            String host = "https://" + ossConfig.getBucket() + "." + ossConfig.getEndpoint();

            result.put("policy", encodedPolicy);
            result.put("signature", signature);
            result.put("accessKeyId", ossConfig.getAccessKeyId());
            result.put("host", host);
            result.put("key", objectKey);
            result.put("expire", expireTime / 1000);
            result.put("dir", getObjectKeyDir(objectKey));

            log.info("上传签名生成成功, key: {}", objectKey);

        } catch (Exception e) {
            log.error("生成上传签名失败", e);
            throw new RuntimeException("生成上传签名失败: " + e.getMessage());
        } finally {
            if (ossClient != null) {
                ossClient.shutdown();
            }
        }

        return result;
    }

    @Override
    public Map<String, Object> getOssConfig() {
        Map<String, Object> config = new HashMap<>();
        config.put("bucket", ossConfig.getBucket());
        config.put("endpoint", ossConfig.getEndpoint());
        config.put("region", ossConfig.getRegion());
        config.put("urlPrefix", ossConfig.getOssUrlPrefix());
        return config;
    }

    /**
     * 从完整objectKey中提取目录路径
     */
    private String getObjectKeyDir(String objectKey) {
        if (objectKey == null || !objectKey.contains("/")) {
            return "";
        }
        return objectKey.substring(0, objectKey.lastIndexOf("/") + 1);
    }

    /**
     * 生成带日期目录的objectKey
     * @param prefix 前缀 (如: products)
     * @param filename 文件名
     * @return 完整路径 (如: products/2025/01/xxx.jpg)
     */
    public String generateObjectKey(String prefix, String filename) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy/MM");
        String datePath = formatter.format(Instant.now().atZone(ZoneId.of("Asia/Shanghai")));
        return prefix + "/" + datePath + "/" + filename;
    }
}
