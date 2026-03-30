# DingTalk (钉钉) Integration Technical Plan

**Version**: 1.0
**Date**: 2026-03-18
**Target Client**: 六扇门食品 (Food Manufacturing Company)
**System**: Cretas Food Traceability System (白垩纪食品溯源系统)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [DingTalk Robot (机器人) API](#2-dingtalk-robot-api)
3. [DingTalk Data APIs](#3-dingtalk-data-apis)
4. [Natural Language Integration Architecture](#4-natural-language-integration-architecture)
5. [Cost & Limitations](#5-cost--limitations)
6. [Implementation Architecture](#6-implementation-architecture)
7. [Development Roadmap & Effort Estimates](#7-development-roadmap--effort-estimates)
8. [Security Considerations](#8-security-considerations)
9. [Appendix: Key References](#9-appendix-key-references)

---

## 1. Executive Summary

六扇门食品 wants to interact with Cretas via DingTalk -- typing natural language commands like "GPS牛腩入库42件" in a DingTalk chat to trigger inventory operations, and pulling expense/approval/purchase data from DingTalk's OA system.

The integration connects DingTalk's Robot platform to our existing AI Intent system (310 registered tools, IntentExecutorService) through a lightweight adapter layer. No changes to the core intent engine are required.

**Key Design Decisions**:
- **Stream Mode** (WebSocket) over HTTP callback -- no public IP/domain needed for the robot
- **Enterprise Internal Application** (企业内部应用) -- full access to org data with admin consent
- **Adapter pattern** -- a `DingTalkAdapter` service translates between DingTalk message format and our `IntentExecuteRequest`/`IntentExecuteResponse`

---

## 2. DingTalk Robot (机器人) API

### 2.1 Application Type: Enterprise Internal Robot

Create an **enterprise internal application** (企业内部应用) on the DingTalk Open Platform (https://open-dev.dingtalk.com/).

**Creation Steps**:
1. Log in to DingTalk Open Platform with admin account
2. Navigate to "应用开发" > "企业内部开发" > "创建应用"
3. Fill in application name (e.g., "白垩纪食品溯源助手"), icon, description
4. Under "应用功能" enable "机器人" capability
5. Configure robot: name, description, message receiving mode
6. After creation, obtain **AppKey** and **AppSecret** from application details page

**Credentials Obtained**:
| Credential | Purpose |
|-----------|---------|
| AppKey (Client ID) | Application identification |
| AppSecret (Client Secret) | Authentication signing |
| Robot webhook URL | Outgoing messages (custom robot mode) |

### 2.2 Message Receiving: Stream Mode vs HTTP Mode

DingTalk supports two modes for receiving messages sent to the robot:

| Feature | HTTP Mode | Stream Mode (Recommended) |
|---------|-----------|--------------------------|
| Requires public IP | Yes | **No** |
| Requires domain/SSL | Yes | **No** |
| Protocol | HTTP POST callbacks | **WebSocket long connection** |
| Latency | Higher (HTTP round-trip) | Lower (persistent connection) |
| Firewall friendly | Needs inbound port open | **Outbound only** |
| SDK support | Manual HTTP handling | **Official Java SDK** |
| Event types | Robot messages only | Robot + Events + Card callbacks |

**Recommendation**: Use **Stream Mode**. Our backend server (47.100.235.168) does not need to expose additional inbound ports. The DingTalk Stream SDK establishes an outbound WebSocket connection to DingTalk's servers.

### 2.3 Stream Mode Implementation

**Official Java SDK**: `dingtalk-stream-sdk-java`
Repository: https://github.com/open-dingtalk/dingtalk-stream-sdk-java

**Maven Dependency**:
```xml
<!-- DingTalk Stream SDK -->
<dependency>
    <groupId>com.dingtalk.open</groupId>
    <artifactId>dingtalk-stream</artifactId>
    <version>1.4.0</version>
</dependency>

<!-- DingTalk Server SDK (for calling DingTalk APIs) -->
<dependency>
    <groupId>com.aliyun</groupId>
    <artifactId>dingtalk</artifactId>
    <version>2.1.30</version>
</dependency>
```

**Stream Client Initialization**:
```java
@Configuration
public class DingTalkStreamConfig {

    @Value("${dingtalk.app-key}")
    private String appKey;

    @Value("${dingtalk.app-secret}")
    private String appSecret;

    @Bean
    public OpenDingTalkClient dingTalkStreamClient(
            DingTalkRobotCallbackHandler robotHandler) {

        OpenDingTalkStreamClientBuilder builder =
            OpenDingTalkStreamClientBuilder.custom()
                .credential(new AuthCredential(appKey, appSecret))
                .registerCallbackListener("/v1.0/im/bot/messages/get", robotHandler)
                .build();

        builder.start();  // Establish WebSocket connection
        return builder;
    }
}
```

### 2.4 Message Receiving Format

When a user @mentions the robot or sends a direct message, the callback delivers:

**Incoming Message JSON** (robot callback payload):
```json
{
    "conversationId": "cidXXXXXXXX",
    "chatbotCorpId": "dingXXXXXXXX",
    "chatbotUserId": "$:LWCP_v1:$XXXXX",
    "msgId": "msgXXXXXXXX",
    "senderNick": "张三",
    "isAdmin": false,
    "senderStaffId": "user123",
    "sessionWebhookExpiredTime": 1711234567890,
    "createAt": 1711234500000,
    "senderCorpId": "dingXXXXXXXX",
    "conversationType": "2",
    "senderId": "$:LWCP_v1:$XXXXX",
    "sessionWebhook": "https://oapi.dingtalk.com/robot/sendBySession?session=xxx",
    "text": {
        "content": "GPS牛腩入库42件"
    },
    "msgtype": "text",
    "robotCode": "dingXXXXXXXX"
}
```

**Key Fields**:
| Field | Description |
|-------|-------------|
| `text.content` | The user's natural language input (core input to our intent system) |
| `senderStaffId` | DingTalk user ID within the organization (for user mapping) |
| `senderNick` | Display name of the sender |
| `conversationType` | "1" = single chat, "2" = group chat |
| `sessionWebhook` | Temporary webhook URL to reply in context (valid ~2hrs) |
| `conversationId` | Conversation identifier (for multi-turn dialog tracking) |

### 2.5 Message Reply Formats

The robot can reply using multiple message types via the session webhook or DingTalk Server API:

#### 2.5.1 Text Message
```json
{
    "msgtype": "text",
    "text": {
        "content": "入库成功：GPS牛腩 42件已入库，批次号 MB-20260318-001"
    }
}
```

#### 2.5.2 Markdown Message
```json
{
    "msgtype": "markdown",
    "markdown": {
        "title": "入库结果",
        "text": "### 入库成功\n\n| 项目 | 详情 |\n|------|------|\n| 品名 | GPS牛腩 |\n| 数量 | 42件 |\n| 批次号 | MB-20260318-001 |\n| 入库时间 | 2026-03-18 14:30 |\n\n> 操作人：张三"
    }
}
```

#### 2.5.3 ActionCard (Single-Action)
```json
{
    "msgtype": "actionCard",
    "actionCard": {
        "title": "确认入库操作",
        "text": "### GPS牛腩入库确认\n\n品名：GPS牛腩\n数量：42件\n\n请确认是否执行入库操作？",
        "btnOrientation": "0",
        "btns": [
            {
                "title": "确认入库",
                "actionURL": "dingtalk://dingtalkclient/action/openapp?..."
            },
            {
                "title": "取消",
                "actionURL": "dingtalk://dingtalkclient/action/openapp?..."
            }
        ]
    }
}
```

#### 2.5.4 Interactive Card (互动卡片 -- Advanced)

Interactive cards support in-card button clicks with server-side callbacks, ideal for:
- Confirm/Cancel operations (preview mode)
- Multi-step wizards
- Data drill-down

```json
{
    "msgtype": "interactive",
    "interactive": {
        "cardTemplateId": "cretas_inventory_confirm",
        "cardData": {
            "cardParamMap": {
                "materialName": "GPS牛腩",
                "quantity": "42",
                "batchNo": "MB-20260318-001"
            }
        }
    }
}
```

Card button callbacks are received via the same Stream connection, routed to a card callback handler.

### 2.6 Rate Limits

| Limit Type | Value |
|-----------|-------|
| Robot sends to group | 20 messages/minute per group |
| Robot sends to individual | 20 messages/minute per user |
| Session webhook validity | ~2 hours after last message |
| Message size | 20KB max per message |
| Markdown length | 5000 characters max |

---

## 3. DingTalk Data APIs

### 3.1 Authentication: Access Token

All server-side API calls require an `access_token`:

**Endpoint**: `POST https://api.dingtalk.com/v1.0/oauth2/accessToken`

```json
{
    "appKey": "dingXXXXXXXX",
    "appSecret": "XXXXXXXXXXXXXXX"
}
```

**Response**:
```json
{
    "accessToken": "xxxx",
    "expireIn": 7200
}
```

**Caching Strategy**: Cache the token for ~110 minutes (7200s - 120s buffer), refresh before expiry. Our system should implement a `DingTalkTokenManager` with Caffeine cache.

### 3.2 OA Approval/Workflow APIs (审批流)

DingTalk's approval system provides APIs for both reading and initiating approval workflows.

#### 3.2.1 List Approval Instances

**Endpoint**: `POST https://api.dingtalk.com/v1.0/workflow/processes/{processCode}/instances`

Or legacy: `POST https://oapi.dingtalk.com/topapi/processinstance/listids`

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| process_code | String | Approval template code (obtained from admin console) |
| start_time | Long | Start timestamp (ms) |
| end_time | Long | End timestamp (ms) |
| userid_list | String | Filter by initiator user IDs |
| size | Integer | Page size (max 20) |
| cursor | Long | Pagination cursor |

#### 3.2.2 Get Approval Instance Detail

**Endpoint**: `POST https://oapi.dingtalk.com/topapi/processinstance/get`

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| process_instance_id | String | Instance ID from list API |

**Response includes**:
- `title`: Approval title
- `status`: RUNNING / COMPLETED / TERMINATED
- `result`: agree / refuse
- `form_component_values`: Array of form field values (name, value pairs)
- `operation_records`: Approval action history
- `create_time`, `finish_time`: Timestamps

#### 3.2.3 Initiate Approval Instance

**Endpoint**: `POST https://oapi.dingtalk.com/topapi/processinstance/create`

```json
{
    "process_code": "PROC-XXXXX",
    "originator_user_id": "user123",
    "dept_id": 12345,
    "form_component_values": [
        { "name": "报销金额", "value": "2500.00" },
        { "name": "报销事由", "value": "原材料采购运费" },
        { "name": "报销类型", "value": "采购报销" }
    ],
    "approvers_v2": [
        {
            "action_type": "NONE",
            "user_ids": ["manager001"]
        }
    ]
}
```

### 3.3 Expense/Reimbursement Data (报销)

DingTalk does not have a dedicated "expense" API separate from the approval workflow. Expense reports are implemented as **approval templates** (审批模板) within the OA system.

**Approach**:
1. Identify the `process_code` for the company's expense/reimbursement approval template
2. Use the approval instance list/detail APIs above to query expense data
3. Parse `form_component_values` to extract expense-specific fields (amount, category, receipts, etc.)

**Common expense template fields**:
- 报销类型 (expense type)
- 报销金额 (amount)
- 报销事由 (reason)
- 发票/收据附件 (receipt attachments)
- 费用明细 (expense line items)

### 3.4 Purchase Order Data (采购单据)

Similar to expenses, purchase orders are typically managed through:

**Option A: OA Approval Workflow** -- If the company uses DingTalk's built-in approval for purchasing:
- Query approval instances by the purchase order `process_code`
- Parse form fields: supplier, items, quantities, amounts

**Option B: Smart Finance (智能财务) API** -- If using DingTalk's finance module:
- `POST /v1.0/finance/receipts/query` -- Query financial receipts
- Requires "智能财务" module activation (paid feature)

**Option C: Our System is Source of Truth** -- Since Cretas already has 310 tools including purchase management (`purchase_*` tools), the more likely scenario is:
- DingTalk user sends "查看本月采购订单"
- Route to Cretas intent system
- Return data from our own database
- DingTalk approval data supplements rather than replaces our data

### 3.5 Required Permissions (权限范围)

Permissions must be applied for in the DingTalk Open Platform developer console:

| Permission Scope | API Category | Required For |
|-----------------|-------------|-------------|
| `Contact.User.Read` | 通讯录-用户信息读权限 | User identity, mapping |
| `Contact.Department.Read` | 通讯录-部门信息读权限 | Org structure |
| `Workflow.Instance.Read` | 审批-实例读权限 | Query approvals |
| `Workflow.Instance.Write` | 审批-实例写权限 | Create approvals |
| `Robot.Message.Send` | 机器人-消息发送 | Send messages |
| `Robot.Message.Read` | 机器人-消息接收 | Receive messages |
| `Chat.Group.Read` | 群会话-读权限 | Group context |

**Admin consent required**: The company's DingTalk admin must authorize the application and approve these permissions.

---

## 4. Natural Language Integration Architecture

### 4.1 Architecture Diagram

```
                        DingTalk Cloud
                    ┌──────────────────────┐
                    │  DingTalk IM Server   │
                    │                      │
User: "GPS牛腩     │  ┌─────────────────┐  │
  入库42件"   ──────┤  │  Robot Service   │  │
  (@bot in group)   │  └────────┬────────┘  │
                    │           │            │
                    │    WebSocket Stream    │
                    └───────────┬────────────┘
                                │
                    ════════════╪════════════
                                │
                    ┌───────────▼────────────┐
                    │   Cretas Backend       │
                    │   (47.100.235.168:10010)│
                    │                        │
                    │  ┌──────────────────┐  │
                    │  │ DingTalk Stream  │  │
                    │  │ Client (WS)     │  │
                    │  └────────┬─────────┘  │
                    │           │             │
                    │  ┌────────▼─────────┐  │
                    │  │ DingTalkAdapter  │  │
                    │  │ Service          │  │
                    │  │                  │  │
                    │  │ 1. Extract text  │  │
                    │  │ 2. Map user      │  │
                    │  │ 3. Build request │  │
                    │  │ 4. Format reply  │  │
                    │  └────────┬─────────┘  │
                    │           │             │
                    │  ┌────────▼─────────┐  │
                    │  │IntentExecutor    │  │
                    │  │ServiceImpl       │  │
                    │  │                  │  │
                    │  │ 310 Tools        │  │
                    │  │ 13 Skills        │  │
                    │  │ Intent Engine    │  │
                    │  └────────┬─────────┘  │
                    │           │             │
                    │  ┌────────▼─────────┐  │
                    │  │ Business         │  │
                    │  │ Services         │  │
                    │  │ + PostgreSQL     │  │
                    │  └──────────────────┘  │
                    └────────────────────────┘
```

### 4.2 Message Flow (Detailed)

```
Step 1: User sends "@白垩纪助手 GPS牛腩入库42件" in DingTalk group
    │
Step 2: DingTalk server delivers message via WebSocket Stream
    │
Step 3: DingTalkRobotCallbackHandler receives message
    │   - Extracts: text="GPS牛腩入库42件", senderStaffId="user123"
    │   - Sends immediate "processing" indicator (typing status)
    │
Step 4: DingTalkAdapterService.handleIncomingMessage()
    │
    ├── 4a. User Mapping
    │   Query: dingtalk_user_mapping table
    │   SELECT cretas_user_id, factory_id, user_role
    │   FROM dingtalk_user_mapping
    │   WHERE dingtalk_user_id = 'user123'
    │   Result: userId=22, factoryId="F001", role="factory_super_admin"
    │
    ├── 4b. Build IntentExecuteRequest
    │   IntentExecuteRequest.builder()
    │       .userInput("GPS牛腩入库42件")
    │       .context(Map.of("source", "dingtalk",
    │                       "conversationId", "cidXXX"))
    │       .build()
    │
    ├── 4c. Execute via IntentExecutorService
    │   response = intentExecutorService.execute("F001", request, 22L, "factory_super_admin")
    │
    └── 4d. Format Response for DingTalk
        DingTalkResponseFormatter.format(response)
        → Markdown message or ActionCard based on response type
    │
Step 5: Send reply via sessionWebhook or DingTalk Server API
    │
Step 6: User sees formatted result in DingTalk chat
```

### 4.3 DingTalkAdapter Service Design

```java
@Slf4j
@Service
public class DingTalkAdapterService {

    @Autowired
    private IntentExecutorService intentExecutorService;

    @Autowired
    private DingTalkUserMappingService userMappingService;

    @Autowired
    private DingTalkResponseFormatter responseFormatter;

    @Autowired
    private DingTalkTokenManager tokenManager;

    /**
     * Handle incoming robot message from DingTalk Stream
     */
    public void handleRobotMessage(RobotMessage message) {
        String text = message.getText().getContent().trim();
        String dingTalkUserId = message.getSenderStaffId();
        String conversationId = message.getConversationId();

        // 1. User mapping: DingTalk user → Cretas user
        DingTalkUserMapping mapping = userMappingService
            .findByDingTalkUserId(dingTalkUserId);

        if (mapping == null) {
            replyText(message, "您的钉钉账号尚未绑定白垩纪系统账号，" +
                "请联系管理员完成绑定。");
            return;
        }

        // 2. Build intent execution request
        IntentExecuteRequest request = IntentExecuteRequest.builder()
            .userInput(text)
            .sessionId("dt_" + conversationId)  // prefix to avoid collision
            .context(Map.of(
                "source", "dingtalk",
                "conversationType", message.getConversationType(),
                "senderNick", message.getSenderNick()
            ))
            .build();

        // 3. Execute through existing intent system
        IntentExecuteResponse response = intentExecutorService.execute(
            mapping.getFactoryId(),
            request,
            mapping.getCretasUserId(),
            mapping.getUserRole()
        );

        // 4. Format and reply
        DingTalkReply reply = responseFormatter.format(response);
        sendReply(message.getSessionWebhook(), reply);
    }
}
```

### 4.4 Response Formatting Strategy

Map `IntentExecuteResponse` status/type to DingTalk message types:

| Response Status | Response Type | DingTalk Format |
|----------------|---------------|-----------------|
| COMPLETED + simple data | Text result | **Text** message |
| COMPLETED + table/list data | Data table | **Markdown** table |
| COMPLETED + write operation | Mutation result | **Markdown** with details |
| PREVIEW | Confirm needed | **ActionCard** with confirm/cancel buttons |
| NEED_MORE_INFO | Clarification | **Text** with clarification questions |
| FAILED | Error | **Text** with error message |
| Multi-intent result | Multiple results | **Markdown** with sections |

**Formatting Example -- Inventory Query Result**:
```java
public DingTalkReply format(IntentExecuteResponse response) {
    if ("COMPLETED".equals(response.getStatus())) {
        if (response.getFormattedText() != null) {
            // Use the pre-formatted text from intent system
            return DingTalkReply.markdown(
                response.getIntentName(),
                response.getFormattedText()
            );
        }
        // Fallback: format resultData as markdown table
        return formatDataAsMarkdown(response);
    }

    if ("PREVIEW".equals(response.getStatus())) {
        return DingTalkReply.actionCard(
            "确认操作: " + response.getIntentName(),
            formatPreviewMarkdown(response),
            List.of(
                new Button("确认执行", buildConfirmUrl(response)),
                new Button("取消", buildCancelUrl(response))
            )
        );
    }

    if ("NEED_MORE_INFO".equals(response.getStatus())) {
        StringBuilder sb = new StringBuilder();
        sb.append("需要更多信息：\n\n");
        for (String question : response.getClarificationQuestions()) {
            sb.append("- ").append(question).append("\n");
        }
        sb.append("\n请直接回复补充信息。");
        return DingTalkReply.text(sb.toString());
    }

    return DingTalkReply.text("操作失败: " + response.getMessage());
}
```

### 4.5 User Mapping Strategy

**Database Table**: `dingtalk_user_mapping`

```sql
CREATE TABLE dingtalk_user_mapping (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dingtalk_corp_id VARCHAR(64) NOT NULL,
    dingtalk_user_id VARCHAR(64) NOT NULL,
    dingtalk_nick VARCHAR(100),
    dingtalk_mobile VARCHAR(20),
    cretas_user_id BIGINT NOT NULL,
    factory_id VARCHAR(32) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(dingtalk_corp_id, dingtalk_user_id),
    CONSTRAINT fk_cretas_user FOREIGN KEY (cretas_user_id)
        REFERENCES users(id)
);

CREATE INDEX idx_dt_mapping_dingtalk ON dingtalk_user_mapping(dingtalk_user_id);
CREATE INDEX idx_dt_mapping_cretas ON dingtalk_user_mapping(cretas_user_id);
```

**Binding Approaches** (choose one or combine):

| Approach | How It Works | Pros | Cons |
|----------|-------------|------|------|
| **Admin bulk import** | Admin uploads DingTalk phone → Cretas user mapping | Simple, one-time | Manual maintenance |
| **Phone number match** | Match DingTalk mobile with Cretas user mobile | Automatic | Requires phone in both systems |
| **Self-service bind** | User sends "绑定 factory_admin1 123456" to robot | User-driven | Security risk if not rate-limited |
| **DingTalk login** | OAuth2 login through DingTalk SSO | Best UX | More complex to implement |

**Recommended**: Start with **admin bulk import** + **phone number auto-match**. Add self-service binding in Phase 2.

### 4.6 Multi-Turn Dialog Support

The existing `IntentExecutorService` supports multi-turn dialog via `sessionId`. For DingTalk:

- Use `"dt_" + conversationId` as the session ID
- When response `status == "NEED_MORE_INFO"`, the user's next message in the same conversation continues the dialog
- Session timeout: inherit from existing system (configurable, default 5 minutes)

---

## 5. Cost & Limitations

### 5.1 DingTalk Edition Comparison

| Feature | 标准版 (Free) | 专业版 | 专属版 |
|---------|-------------|--------|--------|
| Price | Free | **9,800 RMB/year** | **Custom (100K+)** |
| API calls/month | **10,000** | **500,000** | **5,000,000** |
| QPS per app | **20** | **50** | **100+** |
| Approval templates | 20 | Unlimited | Unlimited |
| Robot capabilities | Basic | Full | Full |
| Interactive cards | Limited | Full | Full |
| Data export | Limited | Full | Full |

### 5.2 API Call Volume Estimation

For 六扇门食品 (assuming ~50 DingTalk users interacting with the bot):

| Action | Freq/Day | API Calls/Action | Monthly Total |
|--------|----------|-----------------|---------------|
| Robot messages (send/receive) | 200 | 2 | 12,000 |
| User identity lookup | 50 | 1 | 1,500 |
| Approval queries | 20 | 3 | 1,800 |
| Token refresh | 12 | 1 | 360 |
| **Total** | | | **~15,660** |

**Conclusion**: The free tier (10,000/month) is **not sufficient**. The company will need at minimum **DingTalk 专业版** (9,800 RMB/year, 500K calls/month).

### 5.3 Key Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| 20 QPS per app (free) | Bottleneck during peak hours | Upgrade to 专业版 (50 QPS) |
| 10K API calls/month (free) | Exhausted quickly | Upgrade to 专业版 (500K) |
| Session webhook expires ~2hrs | Cannot reply to old messages | Use proactive messaging API instead |
| Markdown limited formatting | No images inline, no complex tables | Use interactive cards for rich content |
| Robot message 20/min per group | Cannot flood results | Batch results into single message |
| Approval API pagination: max 20/page | Slow for large datasets | Cache locally, sync periodically |
| File messages: temp download URLs | URLs expire | Download and store immediately |

### 5.4 Data Access Restrictions

- Approval data: Can only access templates the app has permission for
- User data: Only within the authorized scope (all org or specific departments)
- Chat history: Robot can only see messages where it is @mentioned
- Files: Temporary download URLs, valid for limited time
- No access to: DingTalk docs, calendars, or other module data unless specifically authorized

---

## 6. Implementation Architecture

### 6.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cretas Backend (Spring Boot 3.2)              │
│                    Port 10010, Java 21                           │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ DingTalk Module  │  │ Existing Modules │  │ Web/Mobile   │  │
│  │                  │  │                  │  │ Controllers  │  │
│  │ ┌──────────────┐ │  │ IntentExecutor   │  │              │  │
│  │ │StreamClient  │ │  │ ServiceImpl      │  │ AIController │  │
│  │ │(WebSocket)   │─┼──▶│                  │◀─┤              │  │
│  │ └──────────────┘ │  │ 310 Tools        │  │ MobileCtrl   │  │
│  │                  │  │ 13 Skills        │  │              │  │
│  │ ┌──────────────┐ │  │ ToolRouter       │  └──────────────┘  │
│  │ │Adapter       │ │  │ SkillExecutor    │                     │
│  │ │Service       │ │  │                  │  ┌──────────────┐  │
│  │ └──────────────┘ │  └──────────────────┘  │ PostgreSQL   │  │
│  │                  │                         │              │  │
│  │ ┌──────────────┐ │  ┌──────────────────┐  │ dingtalk_    │  │
│  │ │Response      │ │  │ DingTalk API     │  │ user_mapping │  │
│  │ │Formatter     │ │  │ Client           │  │              │  │
│  │ └──────────────┘ │  │                  │  │ dingtalk_    │  │
│  │                  │  │ - Token Manager  │  │ sync_log     │  │
│  │ ┌──────────────┐ │  │ - Approval API   │  │              │  │
│  │ │UserMapping   │ │  │ - Contact API    │  └──────────────┘  │
│  │ │Service       │ │  │ - Message API    │                     │
│  │ └──────────────┘ │  └──────────────────┘                     │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Package Structure

```
com.cretas.aims.dingtalk/
├── config/
│   ├── DingTalkConfig.java              // Configuration properties
│   ├── DingTalkStreamConfig.java         // Stream client bean setup
│   └── DingTalkProperties.java           // @ConfigurationProperties
│
├── client/
│   ├── DingTalkTokenManager.java         // Access token cache/refresh
│   ├── DingTalkApiClient.java            // REST API wrapper
│   └── DingTalkApprovalClient.java       // Approval-specific API calls
│
├── handler/
│   ├── DingTalkRobotCallbackHandler.java // Stream callback entry point
│   └── DingTalkCardCallbackHandler.java  // Interactive card callbacks
│
├── service/
│   ├── DingTalkAdapterService.java       // Core adapter: DT msg → Intent → DT reply
│   ├── DingTalkUserMappingService.java   // User identity mapping
│   ├── DingTalkResponseFormatter.java    // Format IntentResponse → DT message
│   ├── DingTalkApprovalSyncService.java  // Sync approval data from DingTalk
│   └── DingTalkMessageSender.java        // Send messages to DingTalk
│
├── entity/
│   ├── DingTalkUserMapping.java          // JPA entity
│   └── DingTalkSyncLog.java             // Sync audit log
│
├── repository/
│   ├── DingTalkUserMappingRepository.java
│   └── DingTalkSyncLogRepository.java
│
└── dto/
    ├── RobotMessage.java                 // Incoming message DTO
    ├── DingTalkReply.java                // Outgoing reply DTO
    └── ApprovalInstance.java             // Approval data DTO
```

### 6.3 Configuration Properties

```yaml
# application.yml
dingtalk:
  enabled: true
  app-key: ${DINGTALK_APP_KEY}
  app-secret: ${DINGTALK_APP_SECRET}
  corp-id: ${DINGTALK_CORP_ID}

  # Stream mode
  stream:
    enabled: true
    reconnect-interval: 5000  # ms

  # API settings
  api:
    base-url: https://api.dingtalk.com
    legacy-base-url: https://oapi.dingtalk.com
    token-cache-seconds: 6600  # 110 minutes

  # Approval sync
  approval:
    sync-enabled: false
    sync-cron: "0 0 */2 * * *"  # Every 2 hours
    process-codes:
      expense: "PROC-XXXXXX"
      purchase: "PROC-YYYYYY"

  # User mapping
  user-mapping:
    auto-match-by-phone: true
    allow-self-bind: false
```

### 6.4 Key Implementation: Robot Callback Handler

```java
@Slf4j
@Component
public class DingTalkRobotCallbackHandler implements DingTalkStreamListener {

    @Autowired
    private DingTalkAdapterService adapterService;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Called by DingTalk Stream SDK when robot receives a message
     */
    @Override
    public AckMessage onMessage(EventAckRequest request) {
        try {
            String data = request.getData();
            RobotMessage message = objectMapper.readValue(data, RobotMessage.class);

            log.info("[DingTalk] Received message from {} in {}: {}",
                message.getSenderNick(),
                message.getConversationType().equals("1") ? "single chat" : "group chat",
                message.getText().getContent());

            // Process asynchronously to avoid blocking the Stream thread
            CompletableFuture.runAsync(() -> {
                adapterService.handleRobotMessage(message);
            });

            return AckMessage.STATUS_OK;

        } catch (Exception e) {
            log.error("[DingTalk] Failed to process robot message", e);
            return AckMessage.STATUS_SYSTEM_EXCEPTION;
        }
    }
}
```

### 6.5 DingTalk Approval Data Sync

For pulling approval/expense/purchase data into Cretas:

```java
@Slf4j
@Service
public class DingTalkApprovalSyncService {

    @Autowired
    private DingTalkApprovalClient approvalClient;

    @Autowired
    private DingTalkSyncLogRepository syncLogRepository;

    /**
     * Sync expense reports from DingTalk approval system
     * Called by scheduled task or on-demand via robot command
     */
    public SyncResult syncExpenseApprovals(String processCode,
                                            LocalDateTime since) {
        long startTime = since.atZone(ZoneId.systemDefault())
            .toInstant().toEpochMilli();

        List<ApprovalInstance> instances = new ArrayList<>();
        Long cursor = 0L;

        do {
            ApprovalListResponse page = approvalClient
                .listInstances(processCode, startTime,
                    System.currentTimeMillis(), cursor, 20);

            for (String instanceId : page.getInstanceIds()) {
                ApprovalInstance detail = approvalClient
                    .getInstanceDetail(instanceId);
                instances.add(detail);
            }

            cursor = page.getNextCursor();
        } while (cursor != null && cursor > 0);

        // Map to Cretas domain objects and persist
        int saved = saveToLocalDatabase(instances);

        syncLogRepository.save(DingTalkSyncLog.builder()
            .syncType("APPROVAL_EXPENSE")
            .processCode(processCode)
            .recordCount(instances.size())
            .savedCount(saved)
            .syncedAt(LocalDateTime.now())
            .build());

        return new SyncResult(instances.size(), saved);
    }
}
```

### 6.6 New Tools for DingTalk Data

Register new tools in the existing Tool-Skill architecture:

```java
// ai/tool/impl/dingtalk/DingTalkExpenseQueryTool.java
@Component
public class DingTalkExpenseQueryTool extends AbstractBusinessTool {

    @Autowired
    private DingTalkApprovalSyncService syncService;

    @Override
    public String getToolName() { return "dingtalk_expense_query"; }

    @Override
    public String getDescription() {
        return "查询钉钉报销单据，支持按时间范围、报销人、状态筛选";
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId,
            Map<String, Object> params, Map<String, Object> context) {
        // Query synced approval data or pull on-demand
        // ...
    }
}

// Also create:
// - DingTalkApprovalQueryTool ("dingtalk_approval_query")
// - DingTalkPurchaseQueryTool ("dingtalk_purchase_query")
// - DingTalkApprovalCreateTool ("dingtalk_approval_create")
```

**Intent Configuration** (database):
```sql
INSERT INTO ai_intent_config (id, intent_code, intent_name, intent_category,
    tool_name, keywords, is_active, sensitivity_level) VALUES
(gen_random_uuid(), 'DINGTALK_EXPENSE_QUERY', '钉钉报销查询', 'DATA_OPERATION',
    'dingtalk_expense_query',
    '["报销","报销单","费用报销","钉钉报销","reimbursement"]',
    true, 'LOW'),
(gen_random_uuid(), 'DINGTALK_APPROVAL_QUERY', '钉钉审批查询', 'DATA_OPERATION',
    'dingtalk_approval_query',
    '["审批","审批单","钉钉审批","approval","审批流"]',
    true, 'LOW'),
(gen_random_uuid(), 'DINGTALK_PURCHASE_QUERY', '钉钉采购查询', 'DATA_OPERATION',
    'dingtalk_purchase_query',
    '["钉钉采购","采购审批","采购单据"]',
    true, 'LOW');
```

---

## 7. Development Roadmap & Effort Estimates

### Phase 1: Core Robot Integration (MVP)

**Goal**: Users can send natural language commands via DingTalk and receive results.

| Task | Description | Effort |
|------|-------------|--------|
| 1.1 Create DingTalk enterprise app | Register on open platform, configure robot | 0.5 day |
| 1.2 Add Maven dependencies | DingTalk Stream SDK + Server SDK | 0.5 day |
| 1.3 DingTalkConfig + Properties | Configuration classes, environment variables | 0.5 day |
| 1.4 DingTalkTokenManager | Access token caching with Caffeine | 0.5 day |
| 1.5 DingTalkStreamConfig | Stream client setup, WebSocket connection | 1 day |
| 1.6 DingTalkRobotCallbackHandler | Message receiving via Stream | 1 day |
| 1.7 DingTalkUserMappingService + Entity | DB table, admin bulk import API | 1.5 days |
| 1.8 DingTalkAdapterService | Core message → intent → reply flow | 2 days |
| 1.9 DingTalkResponseFormatter | Format responses as text/markdown/cards | 2 days |
| 1.10 DingTalkMessageSender | Reply via session webhook + API | 1 day |
| 1.11 Integration testing | End-to-end test with real DingTalk app | 2 days |
| **Phase 1 Total** | | **~12.5 days** |

### Phase 2: Approval Data Integration

**Goal**: Pull expense/approval/purchase data from DingTalk into Cretas.

| Task | Description | Effort |
|------|-------------|--------|
| 2.1 DingTalkApprovalClient | REST client for approval APIs | 1.5 days |
| 2.2 DingTalkApprovalSyncService | Periodic sync + on-demand pull | 2 days |
| 2.3 Approval data mapping | Map DingTalk form fields → Cretas entities | 1.5 days |
| 2.4 New Tools (3 tools) | expense_query, approval_query, purchase_query | 2 days |
| 2.5 Intent configuration | Register new intents in database | 0.5 day |
| 2.6 Testing + data validation | Verify data accuracy across systems | 1.5 days |
| **Phase 2 Total** | | **~9 days** |

### Phase 3: Advanced Features

**Goal**: Interactive cards, self-service binding, approval creation.

| Task | Description | Effort |
|------|-------------|--------|
| 3.1 Interactive card templates | Design + register card templates | 2 days |
| 3.2 Card callback handler | Handle button clicks from cards | 1.5 days |
| 3.3 Preview/Confirm via cards | Map IntentExecuteResponse.PREVIEW to cards | 1.5 days |
| 3.4 Self-service user binding | Bind command + verification flow | 1 day |
| 3.5 Approval creation tools | Create approvals from Cretas via DingTalk | 2 days |
| 3.6 Proactive notifications | Push alerts (low stock, quality issues) to DingTalk | 2 days |
| 3.7 Multi-turn dialog in DingTalk | Proper session management for clarification | 1 day |
| **Phase 3 Total** | | **~11 days** |

### Summary

| Phase | Duration | Prerequisites |
|-------|----------|--------------|
| **Phase 1: Core Robot** | ~12.5 days (2.5 weeks) | DingTalk admin access, 专业版 account |
| **Phase 2: Approval Data** | ~9 days (2 weeks) | Phase 1 complete, approval template codes |
| **Phase 3: Advanced** | ~11 days (2 weeks) | Phase 2 complete |
| **Total** | **~32.5 days (~6.5 weeks)** | |

---

## 8. Security Considerations

### 8.1 Credential Management

| Credential | Storage | Access |
|-----------|---------|--------|
| DINGTALK_APP_KEY | `.env.prod` on server | Environment variable |
| DINGTALK_APP_SECRET | `.env.prod` on server | Environment variable |
| Access Token | Caffeine in-memory cache | Auto-refresh |

**Add to `.env.prod`**:
```bash
DINGTALK_APP_KEY=dingXXXXXXXX
DINGTALK_APP_SECRET=XXXXXXXXXXXXXXX
DINGTALK_CORP_ID=dingXXXXXXXX
```

### 8.2 Message Security

- **Stream Mode**: WebSocket connection is TLS-encrypted, initiated outbound
- **Callback verification**: DingTalk signs callback payloads; verify signature before processing
- **Session webhook**: Use only for immediate reply; do not store or reuse
- **Sensitive operations**: Inherit existing approval chain (HIGH sensitivity intents still require approval)

### 8.3 User Authorization

- DingTalk user mapping inherits Cretas role-based access control
- A DingTalk user can only access data for their mapped `factoryId`
- Unmapped users receive a binding prompt, not system access
- Admin can revoke mappings to immediately cut off DingTalk access

### 8.4 Data Isolation

- Each company (corp) gets isolated mappings via `dingtalk_corp_id`
- If multiple companies use the system, each has its own DingTalk app or tenant
- Approval data sync respects factory boundaries

---

## 9. Appendix: Key References

### Official Documentation
- DingTalk Open Platform: https://open.dingtalk.com/
- Enterprise Robot Development: https://open.dingtalk.com/document/orgapp/enterprise-created-chatbot
- Robot Message Receiving: https://open.dingtalk.com/document/orgapp/robot-receive-message
- Robot Message Types: https://open.dingtalk.com/document/development/robot-message-type
- Approval Workflow Overview: https://open.dingtalk.com/document/orgapp/workflow-overview
- Approval Instance Detail: https://open.dingtalk.com/document/orgapp/obtains-the-details-of-a-single-approval-instance
- Create Approval Instance: https://open.dingtalk.com/document/development/create-an-approval-instance
- API Rate Limits: https://open.dingtalk.com/document/orgapp/descriptions-about-adjusting-limit-and-frequency-of-api-calls
- Platform Pricing: https://open.dingtalk.com/document/services/platform-charging-rules
- User Details API: https://open.dingtalk.com/document/orgapp/query-user-details
- API Reference (Apifox): https://dingtalk.apifox.cn/

### SDKs
- DingTalk Stream SDK (Java): https://github.com/open-dingtalk/dingtalk-stream-sdk-java
- DingTalk Server SDK (Java): Maven `com.aliyun:dingtalk`
- DingTalk Developer Wiki: https://open-dingtalk.github.io/developerpedia/docs/develop/sdk/overview/

### Related Cretas Files
- IntentExecutorService: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/IntentExecutorService.java`
- IntentExecutorServiceImpl: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/IntentExecutorServiceImpl.java`
- IntentExecuteRequest DTO: `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/ai/IntentExecuteRequest.java`
- IntentExecuteResponse DTO: `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/ai/IntentExecuteResponse.java`
- ToolRegistry: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/ToolRegistry.java`
- AbstractBusinessTool: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/AbstractBusinessTool.java`
- pom.xml: `backend/java/cretas-api/pom.xml`
