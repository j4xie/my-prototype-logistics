# AI Chat Quality Testing Fix Plan

## Current Task
Run 20 rounds of 500 AI chat test cases (10,000 total) against the production Mall miniprogram AI chat API.

## Execution
```bash
cd test-ai-chat
node ralph-loop.js --start-round=1 --end-round=20
```

## After Each Round
1. Review test-results/round-N/summary.md
2. Review test-results/round-N/optimization-report.md
3. If optimizations are needed, apply them to backend code
4. Proceed to next round

## Completion
When all 10,000 test cases pass with avg score >= 4.0/5.0

## Status
- [x] Install Ralph
- [x] Configure test infrastructure
- [x] Create test runner
- [x] Create loop orchestrator
- [ ] Execute round 1-20
- [ ] Final cumulative report
