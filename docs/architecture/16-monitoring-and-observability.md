# 16) Monitoring and Observability

### 16.1 Monitoring Stack

- **Frontend Monitoring**: Optional `gtag` for page views and compute events (no PHI)
- **Backend Monitoring**: Cloud Monitoring (native Firebase)
- **Error Tracking**: Cloud Logging with structured JSON logs
- **Performance Monitoring**: Cloud Monitoring metrics (latency, error rate)

### 16.2 Key Metrics

**Backend Metrics** (required for MVP):
- Request rate
- Error rate (p50/p95)
- Latency (p50/p95) - target: p95 ≤ 2s
- Parse-fail rate
- Inactive-only rate
- Overfill occurrences
- Selected-pack count

**Frontend Metrics** (optional for MVP):
- Page load time
- API response time
- JavaScript errors

### 16.3 Alert Thresholds

- **Uptime**: Alert if error rate > 5% over 5 minutes
- **Latency**: Alert if p95 > 3 seconds over 5 minutes
- **Implementation**: Cloud Monitoring default alerts (no custom dashboard for MVP)

### 16.4 Logging

- **Sampling**: 10% in production, 100% in staging
- **Retention**: ≤ 30 days
- **Format**: Structured JSON logs
- **PHI**: Redacted (drug_input, sig never logged)

---
