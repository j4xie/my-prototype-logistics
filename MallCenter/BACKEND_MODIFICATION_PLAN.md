# 后端改造清单 (MallCenter - Spring Boot)

## 架构概述

```
MallCenter 后端 (端口 8083)
├── 现有模块（保留）
│   ├── 商品管理 (GoodsSpu)
│   ├── 订单管理 (OrderInfo)
│   ├── 分类管理 (GoodsCategory)
│   ├── 购物车 (ShoppingCart)
│   └── 用户地址 (UserAddress)
│
├── 扩展模块（修改）
│   ├── 商品增加阶梯定价
│   └── 订单增加商户关联
│
└── 新增模块
    ├── 商户管理 (Merchant)
    ├── 溯源系统 (Traceability)
    ├── 广告系统 (Advertisement)
    ├── 内容审核 (ContentReview)
    ├── AI问答 (AI Chat)
    └── 推荐系统 (Referral)
```

---

## 一、数据库改造

### 1.1 新增表

```sql
-- =====================================================
-- 商户管理模块
-- =====================================================

-- 商户主表
CREATE TABLE merchant (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '商户ID',
    user_id BIGINT COMMENT '关联用户ID',
    merchant_no VARCHAR(32) UNIQUE COMMENT '商户编号',
    merchant_name VARCHAR(100) NOT NULL COMMENT '商户名称',
    short_name VARCHAR(50) COMMENT '简称',
    logo_url VARCHAR(255) COMMENT 'Logo图片',

    -- 认证信息
    license_no VARCHAR(50) COMMENT '营业执照号',
    license_image VARCHAR(255) COMMENT '营业执照图片',
    legal_person VARCHAR(50) COMMENT '法人姓名',
    legal_id_card VARCHAR(50) COMMENT '法人身份证',
    legal_id_front VARCHAR(255) COMMENT '身份证正面',
    legal_id_back VARCHAR(255) COMMENT '身份证反面',

    -- 银行信息
    bank_account VARCHAR(50) COMMENT '银行账户',
    bank_name VARCHAR(100) COMMENT '开户银行',
    bank_branch VARCHAR(100) COMMENT '支行名称',

    -- 联系信息
    contact_name VARCHAR(50) COMMENT '联系人',
    contact_phone VARCHAR(20) COMMENT '联系电话',
    contact_email VARCHAR(100) COMMENT '联系邮箱',
    address VARCHAR(255) COMMENT '经营地址',

    -- 状态与统计
    status TINYINT DEFAULT 0 COMMENT '状态：0待审核 1已认证 2已封禁 3已注销',
    rating DECIMAL(2,1) DEFAULT 5.0 COMMENT '评分',
    review_rate DECIMAL(5,2) DEFAULT 100.00 COMMENT '好评率%',
    operating_years INT DEFAULT 0 COMMENT '经营年限',
    product_count INT DEFAULT 0 COMMENT '商品数量',
    order_count INT DEFAULT 0 COMMENT '订单数量',
    total_sales DECIMAL(12,2) DEFAULT 0 COMMENT '总销售额',

    -- 审计字段
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',

    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_merchant_no (merchant_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商户表';

-- 商户审核记录
CREATE TABLE merchant_review (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    merchant_id BIGINT NOT NULL COMMENT '商户ID',
    reviewer_id BIGINT COMMENT '审核人ID',
    reviewer_name VARCHAR(50) COMMENT '审核人姓名',
    action TINYINT COMMENT '操作：1通过 2拒绝',
    remark TEXT COMMENT '审核备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_merchant_id (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商户审核记录';

-- 商户员工表
CREATE TABLE merchant_staff (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    merchant_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role VARCHAR(20) DEFAULT 'staff' COMMENT '角色：owner/admin/staff',
    permissions JSON COMMENT '权限列表',
    status TINYINT DEFAULT 1 COMMENT '状态：0禁用 1启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_merchant_user (merchant_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商户员工';

-- =====================================================
-- 溯源系统模块
-- =====================================================

-- 溯源批次
CREATE TABLE traceability_batch (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_no VARCHAR(50) NOT NULL UNIQUE COMMENT '批次号 FAC001-20250105-001',
    product_id BIGINT COMMENT '关联商品SPU',
    merchant_id BIGINT COMMENT '关联商户',
    product_name VARCHAR(100) COMMENT '产品名称（冗余）',

    -- 生产信息
    production_date DATE COMMENT '生产日期',
    expiry_date DATE COMMENT '过期日期',
    quantity DECIMAL(10,2) COMMENT '数量',
    unit VARCHAR(20) COMMENT '单位',
    workshop VARCHAR(50) COMMENT '生产车间',

    -- 状态
    status TINYINT DEFAULT 0 COMMENT '0进行中 1已完成 2待处理',

    -- 审计
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_product_id (product_id),
    INDEX idx_merchant_id (merchant_id),
    INDEX idx_batch_no (batch_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='溯源批次';

-- 溯源时间线
CREATE TABLE traceability_timeline (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_id BIGINT NOT NULL,
    stage VARCHAR(50) COMMENT '阶段代码',
    title VARCHAR(100) COMMENT '标题',
    description TEXT COMMENT '描述',

    -- 操作信息
    operator VARCHAR(50) COMMENT '操作员',
    operator_id BIGINT COMMENT '操作员ID',
    workshop VARCHAR(50) COMMENT '车间',
    equipment VARCHAR(100) COMMENT '设备',

    -- 状态与排序
    status TINYINT DEFAULT 0 COMMENT '0待处理 1进行中 2已完成',
    sort_order INT DEFAULT 0 COMMENT '排序',
    timestamp DATETIME COMMENT '发生时间',

    -- 扩展数据
    extra_data JSON COMMENT '扩展数据',

    INDEX idx_batch_id (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='溯源时间线';

-- 原料信息
CREATE TABLE traceability_raw_material (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_id BIGINT NOT NULL,
    material_name VARCHAR(100) COMMENT '原料名称',
    supplier VARCHAR(100) COMMENT '供应商',
    supplier_id BIGINT COMMENT '供应商ID',
    origin VARCHAR(100) COMMENT '产地',

    -- 批次信息
    material_batch_no VARCHAR(50) COMMENT '原料批次号',
    production_date DATE COMMENT '生产日期',
    expiry_date DATE COMMENT '过期日期',
    quantity DECIMAL(10,2) COMMENT '数量',
    unit VARCHAR(20) COMMENT '单位',

    -- 验证状态
    verified TINYINT DEFAULT 0 COMMENT '是否已验证',
    verify_time DATETIME COMMENT '验证时间',

    INDEX idx_batch_id (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='溯源原料';

-- 质检报告
CREATE TABLE traceability_quality_report (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_id BIGINT NOT NULL,
    stage VARCHAR(50) COMMENT '检验阶段：raw_material/finished',
    result VARCHAR(20) COMMENT '检验结果：pass/fail',

    -- 检验信息
    inspector VARCHAR(50) COMMENT '检验员',
    inspector_id BIGINT COMMENT '检验员ID',
    inspection_time DATETIME COMMENT '检验时间',

    -- 检验项目
    test_items JSON COMMENT '检验项目JSON',

    -- 证书
    certificate_image VARCHAR(255) COMMENT '证书图片',
    report_file VARCHAR(255) COMMENT '报告文件',

    INDEX idx_batch_id (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质检报告';

-- 现场证据
CREATE TABLE traceability_evidence (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_id BIGINT NOT NULL,
    type VARCHAR(20) COMMENT '类型：video/photo',
    title VARCHAR(100) COMMENT '标题',
    description VARCHAR(255) COMMENT '描述',
    url VARCHAR(255) NOT NULL COMMENT '文件URL',
    thumbnail_url VARCHAR(255) COMMENT '缩略图',
    sort_order INT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_batch_id (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='溯源证据';

-- =====================================================
-- 阶梯定价模块
-- =====================================================

CREATE TABLE goods_price_tier (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    spu_id BIGINT NOT NULL COMMENT '商品SPU ID',
    min_quantity INT NOT NULL COMMENT '最小数量',
    max_quantity INT COMMENT '最大数量（NULL表示无上限）',
    price DECIMAL(10,2) NOT NULL COMMENT '单价',
    discount_rate DECIMAL(5,2) COMMENT '折扣率%',
    sort_order INT DEFAULT 0,

    INDEX idx_spu_id (spu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品阶梯定价';

-- =====================================================
-- 广告系统模块
-- =====================================================

CREATE TABLE advertisement (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    type VARCHAR(20) NOT NULL COMMENT '类型：splash_ad/home_banner/detail_bottom',
    title VARCHAR(100) COMMENT '标题',
    description VARCHAR(255) COMMENT '描述',

    -- 素材
    image_url VARCHAR(255) NOT NULL COMMENT '图片URL',
    video_url VARCHAR(255) COMMENT '视频URL',

    -- 链接
    link_type VARCHAR(20) COMMENT '链接类型：product/url/miniprogram/none',
    link_value VARCHAR(255) COMMENT '链接值',

    -- 展示控制
    position INT DEFAULT 0 COMMENT '位置/排序',
    start_time DATETIME COMMENT '开始时间',
    end_time DATETIME COMMENT '结束时间',
    status TINYINT DEFAULT 0 COMMENT '状态：0下线 1上线',

    -- 统计
    view_count INT DEFAULT 0 COMMENT '展示次数',
    click_count INT DEFAULT 0 COMMENT '点击次数',

    -- 审计
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_type_status (type, status),
    INDEX idx_time_range (start_time, end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='广告';

-- =====================================================
-- 内容审核模块
-- =====================================================

CREATE TABLE content_review (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    content_type VARCHAR(20) NOT NULL COMMENT '内容类型：product/banner/text/image',
    content_id BIGINT COMMENT '内容ID',
    merchant_id BIGINT COMMENT '商户ID',

    -- 内容快照
    content_snapshot JSON COMMENT '内容快照',
    content_title VARCHAR(200) COMMENT '内容标题',
    content_preview VARCHAR(500) COMMENT '内容预览',

    -- 审核状态
    status TINYINT DEFAULT 0 COMMENT '0待审核 1通过 2拒绝',

    -- 审核信息
    reviewer_id BIGINT COMMENT '审核人ID',
    reviewer_name VARCHAR(50) COMMENT '审核人',
    review_remark TEXT COMMENT '审核备注',
    review_time DATETIME COMMENT '审核时间',

    -- 时间
    submit_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',

    INDEX idx_status (status),
    INDEX idx_content_type (content_type),
    INDEX idx_merchant_id (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='内容审核';

-- =====================================================
-- AI问答模块
-- =====================================================

-- 知识库分类
CREATE TABLE ai_knowledge_category (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '分类名称',
    parent_id BIGINT DEFAULT 0 COMMENT '父级ID',
    sort_order INT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识库分类';

-- 知识库文档
CREATE TABLE ai_knowledge_document (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    category_id BIGINT COMMENT '分类ID',
    title VARCHAR(200) NOT NULL COMMENT '标题',
    content MEDIUMTEXT COMMENT '内容',

    -- 文件信息
    file_url VARCHAR(255) COMMENT '文件URL',
    file_type VARCHAR(20) COMMENT '文件类型',
    file_size BIGINT COMMENT '文件大小',

    -- 版本
    version VARCHAR(20) DEFAULT '1.0' COMMENT '版本号',

    -- 向量化状态
    vector_status TINYINT DEFAULT 0 COMMENT '0未处理 1处理中 2已完成 3失败',
    vector_id VARCHAR(100) COMMENT '向量ID',

    -- 审计
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_category_id (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识库文档';

-- 问答对
CREATE TABLE ai_qa_pair (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    category_id BIGINT COMMENT '分类ID',
    question TEXT NOT NULL COMMENT '问题',
    answer TEXT NOT NULL COMMENT '答案',
    keywords VARCHAR(500) COMMENT '关键词',

    -- 统计
    hit_count INT DEFAULT 0 COMMENT '命中次数',

    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_category_id (category_id),
    FULLTEXT INDEX ft_question (question)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='问答对';

-- 聊天历史
CREATE TABLE ai_chat_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    session_id VARCHAR(50) NOT NULL COMMENT '会话ID',
    role VARCHAR(10) NOT NULL COMMENT '角色：user/assistant',
    content TEXT NOT NULL COMMENT '内容',

    -- 元数据
    tokens INT COMMENT 'Token数',
    model VARCHAR(50) COMMENT '使用的模型',

    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_session (user_id, session_id),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天历史';

-- =====================================================
-- 推荐系统模块
-- =====================================================

CREATE TABLE referral (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    referrer_id BIGINT NOT NULL COMMENT '推荐人ID',
    referee_id BIGINT NOT NULL COMMENT '被推荐人ID',

    -- 状态追踪
    status TINYINT DEFAULT 0 COMMENT '0已注册 1首单完成 2奖励已发放',

    -- 奖励信息
    reward_type VARCHAR(20) COMMENT '奖励类型：cash/coupon/points',
    reward_amount DECIMAL(10,2) COMMENT '奖励金额',
    reward_time DATETIME COMMENT '发放时间',

    -- 首单信息
    first_order_id BIGINT COMMENT '首单ID',
    first_order_amount DECIMAL(10,2) COMMENT '首单金额',
    first_order_time DATETIME COMMENT '首单时间',

    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_referrer_id (referrer_id),
    INDEX idx_referee_id (referee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推荐记录';

-- 推荐奖励配置
CREATE TABLE referral_reward_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) COMMENT '配置名称',
    reward_type VARCHAR(20) COMMENT '奖励类型',
    reward_amount DECIMAL(10,2) COMMENT '奖励金额',
    min_order_amount DECIMAL(10,2) COMMENT '最低订单金额',
    status TINYINT DEFAULT 1 COMMENT '状态',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推荐奖励配置';
```

### 1.2 修改现有表

```sql
-- 商品表增加字段
ALTER TABLE goods_spu
ADD COLUMN merchant_id BIGINT COMMENT '商户ID' AFTER id,
ADD COLUMN has_traceability TINYINT DEFAULT 0 COMMENT '是否支持溯源',
ADD COLUMN latest_batch_no VARCHAR(50) COMMENT '最新批次号',
ADD COLUMN tags JSON COMMENT '标签列表',
ADD COLUMN min_price DECIMAL(10,2) COMMENT '最低价格（阶梯定价）',
ADD INDEX idx_merchant_id (merchant_id);

-- 订单表增加字段
ALTER TABLE order_info
ADD COLUMN merchant_id BIGINT COMMENT '商户ID' AFTER user_id,
ADD COLUMN batch_no VARCHAR(50) COMMENT '溯源批次号',
ADD INDEX idx_merchant_id (merchant_id);
```

---

## 二、Entity 改造

### 2.1 新增 Entity (logistics-mall/src/main/java/com/joolun/entity/)

| Entity | 文件名 | 状态 |
|--------|-------|------|
| Merchant | Merchant.java | ⬜ |
| MerchantReview | MerchantReview.java | ⬜ |
| MerchantStaff | MerchantStaff.java | ⬜ |
| TraceabilityBatch | TraceabilityBatch.java | ⬜ |
| TraceabilityTimeline | TraceabilityTimeline.java | ⬜ |
| TraceabilityRawMaterial | TraceabilityRawMaterial.java | ⬜ |
| TraceabilityQualityReport | TraceabilityQualityReport.java | ⬜ |
| TraceabilityEvidence | TraceabilityEvidence.java | ⬜ |
| GoodsPriceTier | GoodsPriceTier.java | ⬜ |
| Advertisement | Advertisement.java | ⬜ |
| ContentReview | ContentReview.java | ⬜ |
| AiKnowledgeCategory | AiKnowledgeCategory.java | ⬜ |
| AiKnowledgeDocument | AiKnowledgeDocument.java | ⬜ |
| AiQaPair | AiQaPair.java | ⬜ |
| AiChatHistory | AiChatHistory.java | ⬜ |
| Referral | Referral.java | ⬜ |

### 2.2 修改现有 Entity

```java
// GoodsSpu.java 增加字段
private Long merchantId;
private Boolean hasTraceability;
private String latestBatchNo;
private String tags;  // JSON字符串
private BigDecimal minPrice;

// 关联
@TableField(exist = false)
private List<GoodsPriceTier> priceTiers;

@TableField(exist = false)
private Merchant merchant;

// OrderInfo.java 增加字段
private Long merchantId;
private String batchNo;

@TableField(exist = false)
private Merchant merchant;
```

---

## 三、Mapper 改造

### 3.1 新增 Mapper

| Mapper | 文件名 | 状态 |
|--------|-------|------|
| MerchantMapper | MerchantMapper.java + .xml | ⬜ |
| MerchantReviewMapper | MerchantReviewMapper.java | ⬜ |
| TraceabilityBatchMapper | TraceabilityBatchMapper.java + .xml | ⬜ |
| TraceabilityTimelineMapper | TraceabilityTimelineMapper.java | ⬜ |
| TraceabilityQualityReportMapper | TraceabilityQualityReportMapper.java | ⬜ |
| GoodsPriceTierMapper | GoodsPriceTierMapper.java | ⬜ |
| AdvertisementMapper | AdvertisementMapper.java | ⬜ |
| ContentReviewMapper | ContentReviewMapper.java | ⬜ |
| AiKnowledgeDocumentMapper | AiKnowledgeDocumentMapper.java | ⬜ |
| AiChatHistoryMapper | AiChatHistoryMapper.java | ⬜ |
| ReferralMapper | ReferralMapper.java | ⬜ |

---

## 四、Service 改造

### 4.1 新增 Service

| Service | 主要方法 | 状态 |
|---------|---------|------|
| **MerchantService** | | ⬜ |
| | `page(query)` - 分页查询 | |
| | `getById(id)` - 详情 | |
| | `apply(dto)` - 商户入驻申请 | |
| | `review(id, action, remark)` - 审核 | |
| | `updateStatus(id, status)` - 状态变更 | |
| | `getStats(id)` - 统计数据 | |
| **TraceabilityService** | | ⬜ |
| | `page(query)` - 批次列表 | |
| | `getByBatchNo(batchNo)` - 按批次号查询 | |
| | `getDetail(id)` - 完整详情（含时间线、原料、质检） | |
| | `create(dto)` - 创建批次 | |
| | `addTimelineNode(batchId, dto)` - 添加时间线节点 | |
| | `addQualityReport(batchId, dto)` - 添加质检报告 | |
| | `addEvidence(batchId, file)` - 上传证据 | |
| **GoodsPriceTierService** | | ⬜ |
| | `listBySpuId(spuId)` - 获取阶梯定价 | |
| | `saveTiers(spuId, tiers)` - 保存阶梯定价 | |
| | `calculatePrice(spuId, quantity)` - 计算价格 | |
| **AdvertisementService** | | ⬜ |
| | `listByType(type)` - 按类型查询 | |
| | `getSplashAd()` - 获取启动广告 | |
| | `recordClick(id)` - 记录点击 | |
| | `updateStatus(id, status)` - 上下线 | |
| **ContentReviewService** | | ⬜ |
| | `getQueue(type)` - 审核队列 | |
| | `review(id, action, remark)` - 审核 | |
| | `batchReview(ids, action)` - 批量审核 | |
| **AiService** | | ⬜ |
| | `chat(userId, sessionId, message)` - 发送消息 | |
| | `getHistory(userId, sessionId)` - 获取历史 | |
| | `getSessions(userId)` - 会话列表 | |
| **ReferralService** | | ⬜ |
| | `getShareInfo(userId)` - 分享信息 | |
| | `list(referrerId)` - 推荐列表 | |
| | `getRewards(userId)` - 奖励记录 | |
| | `processFirstOrder(orderId)` - 处理首单奖励 | |

### 4.2 修改现有 Service

```java
// GoodsSpuServiceImpl.java 修改
@Override
public GoodsSpu getById(Long id) {
    GoodsSpu spu = super.getById(id);
    if (spu != null) {
        // 加载阶梯定价
        spu.setPriceTiers(goodsPriceTierService.listBySpuId(id));
        // 加载商户信息
        if (spu.getMerchantId() != null) {
            spu.setMerchant(merchantService.getById(spu.getMerchantId()));
        }
    }
    return spu;
}

// OrderInfoServiceImpl.java 修改
// 创建订单时关联商户和溯源批次
```

---

## 五、Controller 改造

### 5.1 新增 Controller

| Controller | 路径前缀 | 端点数 | 状态 |
|------------|---------|--------|------|
| **MerchantController** | `/merchant` | 10 | ⬜ |
| | `GET /page` - 分页查询 | | |
| | `GET /{id}` - 详情 | | |
| | `POST /apply` - 入驻申请 | | |
| | `PUT /{id}/review` - 审核 | | |
| | `PUT /{id}/status` - 状态变更 | | |
| | `GET /{id}/stats` - 统计 | | |
| | `GET /{id}/products` - 商户商品 | | |
| | `GET /{id}/orders` - 商户订单 | | |
| | `POST /{id}/staff` - 添加员工 | | |
| | `DELETE /{id}/staff/{staffId}` - 移除员工 | | |
| **TraceabilityController** | `/traceability` | 12 | ⬜ |
| | `GET /batch/page` - 批次列表 | | |
| | `GET /batch/{batchNo}` - 按批次号查询 | | |
| | `GET /batch/{id}/detail` - 完整详情 | | |
| | `POST /batch` - 创建批次 | | |
| | `PUT /batch/{id}` - 更新批次 | | |
| | `POST /batch/{id}/timeline` - 添加时间线节点 | | |
| | `PUT /timeline/{id}` - 更新时间线节点 | | |
| | `DELETE /timeline/{id}` - 删除时间线节点 | | |
| | `POST /batch/{id}/quality-report` - 添加质检报告 | | |
| | `POST /batch/{id}/evidence` - 上传证据 | | |
| | `GET /batch/{id}/raw-materials` - 原料列表 | | |
| | `POST /batch/{id}/raw-material` - 添加原料 | | |
| **GoodsPriceTierController** | `/goods/{spuId}/price-tiers` | 3 | ⬜ |
| | `GET /` - 获取阶梯定价 | | |
| | `POST /` - 保存阶梯定价 | | |
| | `GET /calculate?qty=N` - 计算价格 | | |
| **AdvertisementController** | `/advertisement` | 8 | ⬜ |
| | `GET /page` - 分页查询 | | |
| | `GET /splash` - 启动广告 | | |
| | `GET /banners` - Banner列表 | | |
| | `POST /` - 创建广告 | | |
| | `PUT /{id}` - 更新广告 | | |
| | `PUT /{id}/status` - 上下线 | | |
| | `POST /{id}/click` - 记录点击 | | |
| | `GET /{id}/stats` - 统计数据 | | |
| **ContentReviewController** | `/content-review` | 5 | ⬜ |
| | `GET /queue` - 审核队列 | | |
| | `GET /{id}` - 审核详情 | | |
| | `PUT /{id}/review` - 审核 | | |
| | `POST /batch-review` - 批量审核 | | |
| | `GET /stats` - 审核统计 | | |
| **AiController** | `/ai` | 6 | ⬜ |
| | `POST /chat` - 发送消息 | | |
| | `GET /history/{sessionId}` - 会话历史 | | |
| | `GET /sessions` - 会话列表 | | |
| | `DELETE /session/{sessionId}` - 删除会话 | | |
| | `GET /knowledge/categories` - 知识库分类 | | |
| | `POST /knowledge/document` - 上传文档 | | |
| **ReferralController** | `/referral` | 5 | ⬜ |
| | `GET /share-info` - 分享信息 | | |
| | `GET /list` - 推荐列表 | | |
| | `GET /rewards` - 奖励记录 | | |
| | `GET /stats` - 推荐统计 | | |
| | `POST /bind` - 绑定推荐关系 | | |

### 5.2 修改现有 Controller

```java
// GoodsSpuController.java 增加端点
@GetMapping("/{id}/price-tiers")
public AjaxResult getPriceTiers(@PathVariable Long id) {
    return AjaxResult.success(goodsPriceTierService.listBySpuId(id));
}

@PostMapping("/{id}/price-tiers")
@PreAuthorize("@ss.hasPermi('mall:goodsspu:edit')")
public AjaxResult savePriceTiers(@PathVariable Long id, @RequestBody List<GoodsPriceTier> tiers) {
    goodsPriceTierService.saveTiers(id, tiers);
    return AjaxResult.success();
}
```

---

## 六、DTO 改造

### 6.1 新增 DTO

```java
// MerchantDTO.java
public class MerchantDTO {
    private Long id;
    private String merchantNo;
    private String merchantName;
    private String logoUrl;
    private Integer status;
    private BigDecimal rating;
    private Integer productCount;
    // ...
}

// MerchantApplyDTO.java
public class MerchantApplyDTO {
    @NotBlank
    private String merchantName;
    @NotBlank
    private String licenseNo;
    private String licenseImage;
    private String legalPerson;
    // ...
}

// MerchantReviewDTO.java
public class MerchantReviewDTO {
    @NotNull
    private Integer action;  // 1通过 2拒绝
    private String remark;
}

// TraceabilityBatchDTO.java
public class TraceabilityBatchDTO {
    private Long id;
    private String batchNo;
    private String productName;
    private String productionDate;
    private Integer status;
    private List<TraceabilityTimelineDTO> timeline;
    private List<TraceabilityRawMaterialDTO> rawMaterials;
    private List<TraceabilityQualityReportDTO> qualityReports;
    private List<TraceabilityEvidenceDTO> evidences;
}

// GoodsPriceTierDTO.java
public class GoodsPriceTierDTO {
    private Long id;
    private Long spuId;
    private Integer minQuantity;
    private Integer maxQuantity;
    private BigDecimal price;
    private BigDecimal discountRate;
}

// AiChatMessageDTO.java
public class AiChatMessageDTO {
    private String sessionId;
    @NotBlank
    private String message;
}

// AiChatResponseDTO.java
public class AiChatResponseDTO {
    private String sessionId;
    private String reply;
    private Long timestamp;
}
```

---

## 七、与 backend-java 集成

### 7.1 AI 服务集成

MallCenter 需要调用 backend-java 的 Qwen AI 服务：

```java
// AiServiceImpl.java
@Service
public class AiServiceImpl implements AiService {

    @Value("${backend.java.url:http://localhost:10010}")
    private String backendUrl;

    @Autowired
    private RestTemplate restTemplate;

    @Override
    public AiChatResponseDTO chat(Long userId, String sessionId, String message) {
        // 1. 保存用户消息到本地
        saveChatHistory(userId, sessionId, "user", message);

        // 2. 调用 backend-java 的 AI 服务
        String url = backendUrl + "/api/mobile/ai/chat";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> request = new HashMap<>();
        request.put("message", message);
        request.put("sessionId", sessionId);
        request.put("context", buildContext(sessionId));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);

        String reply = (String) response.getBody().get("reply");

        // 3. 保存 AI 回复到本地
        saveChatHistory(userId, sessionId, "assistant", reply);

        return new AiChatResponseDTO(sessionId, reply, System.currentTimeMillis());
    }
}
```

### 7.2 共享数据库配置

```yaml
# application.yml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/cretas_mall?useUnicode=true&characterEncoding=utf8
    username: root
    password: your_password

# 数据库可以是:
# 1. 同一个数据库，不同表前缀
# 2. 不同数据库，通过视图或跨库查询访问
```

---

## 八、配置更新

### 8.1 application.yml 新增配置

```yaml
# AI服务配置
ai:
  backend-url: http://localhost:10010
  timeout: 30000

# 文件上传配置
upload:
  path: /data/mall/uploads
  max-size: 10MB
  allowed-types: jpg,jpeg,png,gif,pdf,doc,docx

# 商户配置
merchant:
  auto-approve: false  # 是否自动通过审核

# 推荐配置
referral:
  reward-amount: 10.00
  min-order-amount: 100.00
```

---

## 九、开发顺序

### Phase 1 (Week 1-2): 核心模块
1. ⬜ 数据库表创建和迁移
2. ⬜ Entity/Mapper/基础 Service
3. ⬜ 商户管理 API
4. ⬜ 溯源系统 API
5. ⬜ 阶梯定价 API

### Phase 2 (Week 3-4): 扩展模块
6. ⬜ 广告系统 API
7. ⬜ 内容审核 API
8. ⬜ AI 问答集成

### Phase 3 (Week 5-6): 完善
9. ⬜ 推荐系统 API
10. ⬜ 统计分析 API
11. ⬜ 性能优化
12. ⬜ 安全加固

---

## 十、测试检查清单

### API 测试
- [ ] 商户入驻申请 → 审核 → 通过/拒绝流程
- [ ] 溯源批次创建 → 添加时间线 → 添加质检
- [ ] 阶梯定价保存和计算准确性
- [ ] 广告上下线和点击统计
- [ ] 内容审核队列和批量操作
- [ ] AI 对话请求和响应

### 集成测试
- [ ] 小程序扫码查询溯源信息
- [ ] 小程序阶梯定价计算
- [ ] 管理后台商户审核
- [ ] AI 服务调用 backend-java
