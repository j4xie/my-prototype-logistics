# SmartBI Monitoring

## Grafana Dashboard

`smartbi-grafana-dashboard.json` 是 SmartBI v9 prod 的 11 个 metrics dashboard,可直接导入 Grafana.

### 导入步骤

1. Grafana → Dashboards → New → Import
2. 上传 `smartbi-grafana-dashboard.json` 或粘贴 JSON
3. 选 Prometheus datasource (或 datasource variable 选)
4. Save

### 11 个 panel 含义

| # | Panel | 数据源 metric | 健康阈值 |
|---|---|---|---|
| 1 | Chat session lookup hit rate | `smartbi_chat_session_lookup_total{outcome="hit"}` / total | 🟢 ≥50% (v2 conv memory 工作良好) |
| 2 | LLM-answer cache hit rate | `smartbi_llm_answer_cache_lookup_total{outcome="hit"}` / total | 🟢 ≥60% (重复 query 命中) |
| 3 | LLM 软超时频率 | `smartbi_llm_soft_timeout_total{silent}` / hour | 🟢 <10/h |
| 4 | Cache reject reasons (1h) | `smartbi_cache_reject_total{reason}` / hour | 监控用 |
| 5 | Chat-session turn count distribution | `smartbi_chat_session_turn_count` histogram | P95 = 多 turn 长会话占比 |
| 6 | Cache hit kept by template (top 10) | `smartbi_cache_hit_kept_total{template_code}` | 看哪些 template 最热 |
| 7 | Pruner runs (chat-session vs llm-cache) | `smartbi_pruner_runs_total{table,outcome}` | error 应为 0 |
| 8 | Pruner deleted rows over time | `smartbi_pruner_deleted_rows_total{table}` | 看 TTL 工作 |
| 9 | HTTP request latency (chat endpoint) | `http_request_duration_seconds` | 🟢 P50 < 8s, P99 < 15s |
| 10 | LLM-answer cache hit_count distribution | `smartbi_llm_answer_cache_hit_count_observed` | 看 cache 复用度 |
| 11 | LLM-cache write outcomes | `smartbi_llm_answer_cache_write_total{outcome}` | error 应为 0 |

### Prometheus 配置

`/metrics` endpoint 已 PUBLIC (no JWT). 在 Prometheus `scrape_configs` 加:

```yaml
scrape_configs:
  - job_name: 'smartbi-prod'
    scrape_interval: 30s
    static_configs:
      - targets: ['47.100.235.168:8083']
        labels:
          env: prod
```

### 告警建议

```yaml
# alertmanager.yml
groups:
  - name: smartbi
    rules:
      - alert: SmartBI_LLM_Silent_Timeout_Spike
        expr: rate(smartbi_llm_soft_timeout_total{silent="true"}[5m]) > 0.05
        for: 2m
        annotations:
          summary: "SmartBI LLM silent timeout > 3/min — provider unhealthy"
      
      - alert: SmartBI_Pruner_Failed
        expr: increase(smartbi_pruner_runs_total{outcome="error"}[1h]) > 0
        for: 0m
        annotations:
          summary: "SmartBI pruner cron failed in last hour"
      
      - alert: SmartBI_Cache_Hit_Crash
        expr: |
          sum(rate(smartbi_llm_answer_cache_lookup_total{outcome="hit"}[15m])) 
          / sum(rate(smartbi_llm_answer_cache_lookup_total[15m])) < 0.3
        for: 30m
        annotations:
          summary: "SmartBI LLM-cache hit rate dropped below 30% for 30min"
```
