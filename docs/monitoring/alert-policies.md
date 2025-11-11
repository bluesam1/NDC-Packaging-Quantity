# Alert Policies

This document defines the alert policies for the NDC Packaging & Quantity Calculator API.

## Overview

All alert policies are configured in Google Cloud Monitoring and integrate with the structured logging from Story 4.4.

## Alert Policies

### 1. High Error Rate

**Condition**: Error rate >5% over 5 minutes

**Severity**: CRITICAL

**Notification Channels**: Email, Slack, PagerDuty

**Description**: Triggers when the ratio of failed requests to total requests exceeds 5% for 5 consecutive minutes.

**Metric Query**:
```
resource.type="cloud_function"
resource.labels.function_name="compute"
jsonPayload.metricName="request.error"
```

**Threshold Calculation**:
```
(COUNT(request.error) / COUNT(request.total)) > 0.05 FOR 5 minutes
```

**Auto-close Condition**: Error rate <3% for 10 minutes

---

### 2. High Latency (p95)

**Condition**: p95 latency >3 seconds over 5 minutes

**Severity**: WARNING

**Notification Channels**: Email, Slack

**Description**: Triggers when the 95th percentile request latency exceeds 3000ms for 5 consecutive minutes.

**Metric Query**:
```
resource.type="cloud_function"
resource.labels.function_name="compute"
jsonPayload.metricName="request.duration"
```

**Threshold Calculation**:
```
PERCENTILE(request.duration, 95) > 3000 FOR 5 minutes
```

**Auto-close Condition**: p95 latency <2500ms for 10 minutes

---

### 3. Low Uptime

**Condition**: Function uptime <99% over 10 minutes

**Severity**: CRITICAL

**Notification Channels**: Email, Slack, PagerDuty

**Description**: Triggers when function availability drops below 99% for 10 consecutive minutes.

**Metric Query**:
```
resource.type="cloud_function"
resource.labels.function_name="compute"
```

**Threshold Calculation**:
```
(COUNT(successful_requests) / COUNT(total_requests)) < 0.99 FOR 10 minutes
```

**Auto-close Condition**: Uptime >99% for 15 minutes

---

### 4. High Parse-Fail Rate

**Condition**: SIG parse-fail rate >20% over 5 minutes

**Severity**: WARNING

**Notification Channels**: Email, Slack

**Description**: Triggers when SIG parsing failures exceed 20% of all parse attempts for 5 consecutive minutes.

**Metric Query**:
```
resource.type="cloud_function"
resource.labels.function_name="compute"
jsonPayload.metricName="sig.parse.error"
```

**Threshold Calculation**:
```
(COUNT(sig.parse.error) / (COUNT(sig.parse.success) + COUNT(sig.parse.error))) > 0.20 FOR 5 minutes
```

**Auto-close Condition**: Parse-fail rate <10% for 10 minutes

---

### 5. High Inactive-Only Rate

**Condition**: Inactive-only rate >30% over 10 minutes

**Severity**: WARNING

**Notification Channels**: Email

**Description**: Triggers when the rate of "no active NDCs" responses exceeds 30% for 10 consecutive minutes. This indicates data quality issues.

**Metric Query**:
```
resource.type="cloud_function"
resource.labels.function_name="compute"
jsonPayload.error_code="inactive_ndc_only"
```

**Threshold Calculation**:
```
(COUNT(inactive_ndc_only) / COUNT(total_requests)) > 0.30 FOR 10 minutes
```

**Auto-close Condition**: Inactive-only rate <20% for 15 minutes

---

### 6. External API High Latency

**Condition**: External API latency >5 seconds over 5 minutes

**Severity**: WARNING

**Notification Channels**: Email, Slack

**Description**: Triggers when RxNorm, FDA, or OpenAI API latency exceeds 5000ms for 5 consecutive minutes.

**Metric Query**:
```
resource.type="cloud_function"
resource.labels.function_name="compute"
jsonPayload.metricName IN ("openai.request.duration", "ndc.validation.duration")
```

**Threshold Calculation**:
```
AVG(external_api.duration) > 5000 FOR 5 minutes
```

**Auto-close Condition**: External API latency <3000ms for 10 minutes

---

### 7. High Stale Cache Usage

**Condition**: Stale cache usage >10% over 10 minutes

**Severity**: WARNING

**Notification Channels**: Email

**Description**: Triggers when stale cache usage exceeds 10% for 10 consecutive minutes. This indicates prolonged external API issues.

**Metric Query**:
```
resource.type="cloud_function"
resource.labels.function_name="compute"
jsonPayload.metricName="cache.stale.usage"
```

**Threshold Calculation**:
```
(COUNT(cache.stale.usage) / COUNT(cache.total)) > 0.10 FOR 10 minutes
```

**Auto-close Condition**: Stale cache usage <5% for 15 minutes

---

## Notification Channels

### Email
- **Recipients**: ops-team@example.com
- **Severity**: All (WARNING, CRITICAL)
- **Format**: Detailed alert with metric values and links to logs

### Slack
- **Channel**: #alerts-ndc-qty-api
- **Severity**: WARNING, CRITICAL
- **Format**: Concise alert with quick actions

### PagerDuty
- **Service**: NDC Qty API - Production
- **Severity**: CRITICAL only
- **Escalation**: On-call engineer

---

## Alert Configuration Steps

### Using Google Cloud Console

1. **Navigate to Cloud Monitoring**:
   - Go to Google Cloud Console
   - Select your Firebase project
   - Navigate to Monitoring > Alerting

2. **Create Alert Policy**:
   - Click "Create Policy"
   - Add condition (see metric queries above)
   - Set threshold and duration
   - Configure notification channels
   - Set alert name and severity

3. **Test Alert**:
   - Use "Test Notification" feature
   - Verify delivery to all channels

### Using Terraform (Recommended for Production)

```hcl
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "High Error Rate (>5%)"
  combiner     = "OR"
  conditions {
    display_name = "Error rate >5% over 5 minutes"
    condition_threshold {
      filter          = "resource.type=\"cloud_function\" AND resource.labels.function_name=\"compute\" AND jsonPayload.metricName=\"request.error\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }
  notification_channels = [
    google_monitoring_notification_channel.email.id,
    google_monitoring_notification_channel.slack.id,
    google_monitoring_notification_channel.pagerduty.id,
  ]
  alert_strategy {
    auto_close = "1800s"  # 30 minutes
  }
}
```

---

## Metric Retention

- **Log Retention**: 30 days (configured in Cloud Logging)
- **Metric Retention**: 6 months (default Cloud Monitoring)
- **Dashboard Data**: Real-time + 30-day historical

---

## Dashboard Configuration

See `dashboard-config.md` for dashboard setup instructions.


