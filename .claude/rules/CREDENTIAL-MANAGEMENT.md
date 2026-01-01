# 凭证配置

## 环境变量

```bash
ALIBABA_ACCESSKEY_ID=your-access-key-id
ALIBABA_SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret
AI_API_KEY=sk-xxx
```

## Spring Boot

```properties
jwt.secret=${JWT_SECRET}
alibaba.accessKeyId=${ALIBABA_ACCESSKEY_ID}
```

## 宝塔面板

启动参数: `-DJWT_SECRET=xxx -DALIBABA_ACCESSKEY_ID=xxx`
