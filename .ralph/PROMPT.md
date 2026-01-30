# AI Chat Quality Testing & Optimization Loop

## Objective
Iteratively test and optimize the AI chat system for the Mall miniprogram. Each iteration:
1. Generate 500 diverse test cases (multi-turn conversations, product inquiries, traceability questions, pricing, etc.)
2. Execute all test cases against the live API
3. Evaluate AI response quality on 5 dimensions
4. Identify issues and apply optimizations
5. Verify previous optimizations in next iteration

## Target System
- **API Endpoint**: `https://centerapi.cretaceousfuture.com/weixin/api/ma/ai/chat`
- **Method**: POST
- **Auth**: Requires `app-id` and `third-session` headers

## Test Case Categories (distribute evenly across 500 per round)
1. **Product Inquiry** (100): "推荐牛肉商品", "有机蔬菜有哪些", "最便宜的水果"
2. **Price & Discount** (80): "阶梯价格怎么算", "买100件打几折", "最划算的套餐"
3. **Traceability** (80): "这个产品的溯源信息", "产地在哪里", "质检报告"
4. **Multi-turn Dialogue** (100): Follow-up questions, context retention, clarification
5. **General Consultation** (60): "如何下单", "配送时间", "退换货政策"
6. **Edge Cases** (40): Empty input, very long text, special characters, ambiguous queries
7. **Product-specific Context** (40): Questions with productId/productName parameters

## Evaluation Criteria (score 1-5 for each)
1. **Information Accuracy**: Is the response factually correct? Does it match real product data?
2. **Functional Completeness**: Does the AI fulfill the consultation purpose? Are products returned when expected?
3. **Response Speed**: Is latency under 3 seconds? Under 5 seconds?
4. **Streaming Feedback**: Does the response support incremental display?
5. **Conversation Coherence**: In multi-turn, does the AI maintain context properly?

## Iteration Protocol
- Round N: Run 500 NEW test cases → Evaluate → Generate optimization report
- Round N+1: First verify Round N optimizations → Then run 500 NEW test cases → Evaluate
- Continue until cumulative test cases reach 10,000 (20 rounds)

## Optimization Scope
When issues are found, optimize:
- Backend AI prompt templates (in AiRecommendServiceImpl.java)
- RAG retrieval configuration
- Product matching logic
- Response formatting
- Error handling and fallback messages
- Frontend display of AI responses

## Output Per Round
Save to `test-results/round-{N}/`:
- `test-cases.json` - All 500 test cases
- `results.json` - Raw API responses
- `evaluation.json` - Scored evaluation
- `optimization-report.md` - Issues found + fixes applied
- `summary.md` - Round summary with metrics

## Completion Criteria
- 10,000 total test cases executed
- Average quality score >= 4.0 across all dimensions
- No critical issues (score 1) remaining

## EXIT_SIGNAL
Set EXIT_SIGNAL: true ONLY when all 10,000 test cases are complete AND final quality score >= 4.0
