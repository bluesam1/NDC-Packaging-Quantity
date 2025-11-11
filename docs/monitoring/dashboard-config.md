# Dashboard Configuration

This document provides instructions for setting up the monitoring dashboard for the NDC Packaging & Quantity Calculator API.

## Overview

The monitoring dashboard displays key metrics for API performance, external API health, and business metrics. It uses Google Cloud Monitoring and integrates with the telemetry from Story 4.4.

## Dashboard Structure

### Section 1: Request Metrics
- **Request Count**: Total requests per minute
- **Success Rate**: Percentage of successful requests (200 OK)
- **Error Rate**: Percentage of failed requests (4xx, 5xx)
- **Request Duration**: p50, p95, p99 latency over time

### Section 2: External API Metrics
- **RxNorm API Latency**: Average and p95 latency
- **FDA API Latency**: Average and p95 latency
- **OpenAI API Latency**: Average and p95 latency
- **External API Availability**: Uptime percentage

### Section 3: Cache Performance
- **Cache Hit Rate**: Percentage of cache hits vs misses
- **Cache Miss Rate**: Percentage of cache misses
- **Stale Cache Usage**: Percentage of stale cache usage

### Section 4: Business Metrics
- **Parse-Fail Rate**: Percentage of SIG parsing failures
- **AI Fallback Rate**: Percentage of AI fallback usage
- **Inactive-Only Rate**: Percentage of "no active NDCs" responses
- **Overfill Occurrences**: Count of overfill scenarios
- **Selected-Pack Distribution**: Histogram of pack counts (1-pack, 2-pack, 3-pack+)

### Section 5: Function Health
- **Function Uptime**: Availability percentage
- **Function Execution Count**: Executions per minute
- **Function Error Count**: Errors per minute
- **Function Memory Usage**: Average and peak memory
- **Function CPU Usage**: Average and peak CPU

---

## Creating the Dashboard

### Using Google Cloud Console (Manual)

1. **Navigate to Cloud Monitoring**:
   - Go to Google Cloud Console
   - Select your Firebase project
   - Navigate to Monitoring > Dashboards
   - Click "Create Dashboard"

2. **Configure Dashboard**:
   - Name: "NDC Qty API - Production"
   - Refresh Rate: 1 minute
   - Time Range: Last 1 hour (default)

3. **Add Charts**:
   - For each metric, click "Add Chart"
   - Configure metric query (see below)
   - Set chart type and visualization options
   - Add to dashboard

### Using Terraform (Recommended)

```hcl
resource "google_monitoring_dashboard" "ndc_qty_api" {
  dashboard_json = file("${path.module}/dashboards/ndc-qty-api.json")
}
```

See `dashboards/ndc-qty-api.json` for complete dashboard configuration.

---

## Chart Configurations

### Request Count Chart

**Chart Type**: Line Chart

**Metric Query**:
```
resource.type="cloud_function"
resource.labels.function_name="compute"
jsonPayload.metricName="request.total"
| group_by 1m, [value_count: count()]
```

**Y-Axis**: Request Count
**X-Axis**: Time
**Legend**: Show

---

### Success Rate Chart

**Chart Type**: Line Chart

**Metric Query**:
```
fetch cloud_function
| metric 'cloudfunctions.googleapis.com/function/execution_count'
| filter resource.function_name == 'compute'
| align rate(1m)
| every 1m
| group_by [resource.status], [value_execution_count: sum(value.execution_count)]
```

**Y-Axis**: Success Rate (%)
**X-Axis**: Time
**Threshold**: Warning at 95%, Critical at 90%

---

### Error Rate Chart

**Chart Type**: Line Chart with Alert Threshold

**Metric Query**:
```
resource.type="cloud_function"
resource.labels.function_name="compute"
jsonPayload.metricName="request.error"
| align rate(1m)
| group_by 1m
| numerator/denominator * 100
```

**Y-Axis**: Error Rate (%)
**X-Axis**: Time
**Threshold Line**: 5% (alert threshold)
**Alert Zone**: Red above 5%

---

### Latency Chart (p50, p95, p99)

**Chart Type**: Line Chart (multi-series)

**Metric Query**:
```
resource.type="cloud_function"
resource.labels.function_name="compute"
jsonPayload.metricName="request.duration"
| align delta(1m)
| group_by 1m
| percentile 50, 95, 99
```

**Y-Axis**: Duration (ms)
**X-Axis**: Time
**Series**: 
- p50 (blue)
- p95 (yellow)
- p99 (red)
**Threshold Line**: 3000ms (alert threshold for p95)

---

### External API Latency Chart

**Chart Type**: Line Chart (multi-series)

**Metric Query**:
```
resource.type="cloud_function"
resource.labels.function_name="compute"
jsonPayload.metricName IN ("openai.request.duration", "ndc.validation.duration")
| group_by [jsonPayload.service], 1m
| mean()
```

**Y-Axis**: Duration (ms)
**X-Axis**: Time
**Series**:
- RxNorm API (blue)
- FDA API (green)
- OpenAI API (orange)

---

### Cache Hit Rate Chart

**Chart Type**: Stacked Area Chart

**Metric Query**:
```
resource.type="cloud_function"
resource.labels.function_name="compute"
jsonPayload.metricName IN ("cache.hit", "cache.miss")
| group_by [jsonPayload.metricName], 1m
| count()
| hit_rate = cache.hit / (cache.hit + cache.miss) * 100
```

**Y-Axis**: Hit Rate (%)
**X-Axis**: Time
**Stacked Series**:
- Cache Hits (green)
- Cache Misses (red)

---

### Parse-Fail Rate Chart

**Chart Type**: Line Chart

**Metric Query**:
```
resource.type="cloud_function"
resource.labels.function_name="compute"
jsonPayload.metricName IN ("sig.parse.success", "sig.parse.error")
| group_by 5m
| fail_rate = sig.parse.error / (sig.parse.success + sig.parse.error) * 100
```

**Y-Axis**: Parse-Fail Rate (%)
**X-Axis**: Time
**Threshold Line**: 20% (alert threshold)

---

### AI Fallback Rate Chart

**Chart Type**: Line Chart

**Metric Query**:
```
resource.type="cloud_function"
resource.labels.function_name="compute"
jsonPayload.metricName="sig.parse.fallback"
| group_by 5m
| count()
```

**Y-Axis**: Fallback Count
**X-Axis**: Time

---

### Inactive-Only Rate Chart

**Chart Type**: Line Chart

**Metric Query**:
```
resource.type="cloud_function"
resource.labels.function_name="compute"
jsonPayload.error_code="inactive_ndc_only"
| group_by 5m
| count() / total_requests * 100
```

**Y-Axis**: Inactive-Only Rate (%)
**X-Axis**: Time
**Threshold Line**: 30% (alert threshold)

---

### Function Uptime Chart

**Chart Type**: Gauge

**Metric Query**:
```
fetch cloud_function
| metric 'cloudfunctions.googleapis.com/function/execution_count'
| filter resource.function_name == 'compute'
| align rate(1m)
| group_by [], [uptime: (successful / total) * 100]
```

**Display**: Percentage (0-100%)
**Thresholds**:
- Green: >99%
- Yellow: 95-99%
- Red: <95%

---

### Function Memory Usage Chart

**Chart Type**: Area Chart

**Metric Query**:
```
fetch cloud_function
| metric 'cloudfunctions.googleapis.com/function/user_memory_bytes'
| filter resource.function_name == 'compute'
| align mean(1m)
| every 1m
```

**Y-Axis**: Memory (MB)
**X-Axis**: Time
**Threshold Line**: 80% of allocated memory

---

## Dashboard JSON Export

For the complete dashboard configuration, see the JSON export file:

```json
{
  "displayName": "NDC Qty API - Production",
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "width": 4,
        "height": 4,
        "widget": {
          "title": "Request Count",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type=\"cloud_function\" resource.labels.function_name=\"compute\" jsonPayload.metricName=\"request.total\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_RATE",
                    "crossSeriesReducer": "REDUCE_SUM"
                  }
                }
              }
            }],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Requests/min",
              "scale": "LINEAR"
            }
          }
        }
      }
      // ... additional tiles ...
    ]
  }
}
```

---

## Accessing the Dashboard

### URL Format
```
https://console.cloud.google.com/monitoring/dashboards/custom/[DASHBOARD_ID]?project=[PROJECT_ID]
```

### Quick Links
- **Production Dashboard**: (to be populated after creation)
- **Staging Dashboard**: (to be populated after creation)

---

## Dashboard Maintenance

### Regular Reviews
- **Daily**: Check for anomalies during business hours
- **Weekly**: Review trends and identify optimization opportunities
- **Monthly**: Update thresholds based on observed baselines

### Updates
- Add new metrics as features are deployed
- Remove deprecated metrics
- Adjust visualization types based on feedback
- Update alert thresholds based on incident analysis

### Permissions
- **View**: All engineers, operations team
- **Edit**: Operations lead, senior engineers
- **Admin**: Platform team

---

## Troubleshooting

### Dashboard Not Showing Data
1. Verify telemetry is enabled (Story 4.4)
2. Check that structured logging is working
3. Verify metric queries are correct
4. Check time range (ensure data exists in selected range)

### Missing Metrics
1. Verify metric is being emitted in logs
2. Check metric name matches query
3. Verify resource type and labels
4. Check for sampling (may affect metric frequency)

### Slow Dashboard Loading
1. Reduce time range (e.g., last 1 hour instead of 24 hours)
2. Simplify complex queries
3. Reduce chart refresh rate
4. Consider creating separate dashboards for different use cases

---

## Best Practices

1. **Keep it Simple**: Focus on actionable metrics
2. **Consistent Colors**: Use same colors across related charts
3. **Clear Labels**: Ensure axes and legends are clearly labeled
4. **Alert Thresholds**: Show alert thresholds on relevant charts
5. **Regular Updates**: Keep dashboard up-to-date with system changes
6. **Document Changes**: Log dashboard changes in version control
7. **Share Widely**: Ensure team has access to dashboard
8. **Monitor Performance**: Ensure dashboard loads quickly

---

## Related Documentation

- [Alert Policies](./alert-policies.md)
- [Runbooks](./runbooks.md)
- [Telemetry & Structured Logging](../stories/4.4.telemetry-structured-logging.md)


