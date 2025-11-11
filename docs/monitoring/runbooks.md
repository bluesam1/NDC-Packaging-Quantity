# Runbooks

This document provides runbooks for common alert scenarios in the NDC Packaging & Quantity Calculator API.

## Table of Contents

1. [High Error Rate Alert](#high-error-rate-alert)
2. [High Latency Alert](#high-latency-alert)
3. [Low Uptime Alert](#low-uptime-alert)
4. [High Parse-Fail Rate Alert](#high-parse-fail-rate-alert)
5. [External API Failure Alert](#external-api-failure-alert)
6. [High Stale Cache Usage Alert](#high-stale-cache-usage-alert)

---

## High Error Rate Alert

### Alert Condition
Error rate >5% over 5 minutes

### Severity
CRITICAL

### Symptoms
- Users receiving error responses (400, 500, 503)
- Service degradation
- Increased support tickets

### Impact
- User experience degradation
- Potential data loss if validation errors
- Reduced system availability

### Investigation Steps

1. **Check Cloud Logging for recent errors**:
   ```
   resource.type="cloud_function"
   resource.labels.function_name="compute"
   severity="ERROR"
   timestamp>=[LAST 10 MINUTES]
   ```

2. **Identify error types**:
   - **Validation errors** (400): Check `error_code="validation_error"`
   - **Parse errors** (400): Check `error_code="parse_error"`
   - **Dependency errors** (500): Check `error_code="dependency_error"`
   - **Internal errors** (500): Check `error_code="internal_error"`

3. **Check external API status**:
   - RxNorm API: https://rxnav.nlm.nih.gov/
   - FDA API: https://open.fda.gov/apis/status/
   - OpenAI API: https://status.openai.com/

4. **Check correlation IDs**:
   - Group errors by `correlationId` to identify patterns
   - Check if errors affect specific users or are widespread

5. **Check cache hit rates**:
   ```
   jsonPayload.metricName="cache.hit"
   jsonPayload.metricName="cache.miss"
   ```
   - Low cache hit rates may indicate cache issues

### Remediation

**For External API Failures**:
1. Verify external API status (see Investigation Step 3)
2. If external API is down, check if degraded mode is active (Story 4.6)
3. If degraded mode not active, manually enable stale cache usage
4. Monitor stale cache usage rate

**For Parsing Errors**:
1. Review recent code changes to SIG parser
2. Check for regression in test coverage
3. Identify problematic SIG patterns in logs
4. If widespread, consider rolling back recent deployment

**For Internal Errors**:
1. Check function logs for uncaught exceptions
2. Review stack traces in error logs
3. Check for memory/CPU issues in Cloud Monitoring
4. If persistent, consider redeploying function

**For Validation Errors**:
1. Check if validation schema changed recently
2. Verify client is sending correct request format
3. If schema issue, roll back or fix forward

### Escalation

- **If unresolved in 15 minutes**: Escalate to on-call engineer
- **If service down**: Page on-call immediately via PagerDuty

### Post-Incident

1. Conduct post-mortem (if >30 minutes downtime)
2. Document root cause and remediation
3. Update runbook with lessons learned
4. Consider adding new alerts or improving existing ones

---

## High Latency Alert

### Alert Condition
p95 latency >3 seconds over 5 minutes

### Severity
WARNING

### Symptoms
- Slow API responses
- User complaints about performance
- Timeouts in client applications

### Impact
- Poor user experience
- Potential timeouts
- Reduced throughput

### Investigation Steps

1. **Check request duration metrics**:
   ```
   jsonPayload.metricName="request.duration"
   jsonPayload.duration>3000
   ```

2. **Identify slow components**:
   - SIG parsing: Check `sig.parse.duration`
   - OpenAI API: Check `openai.request.duration`
   - NDC validation: Check `ndc.validation.duration`
   - External APIs: Check RxNorm/FDA latency

3. **Check for high load**:
   ```
   jsonPayload.metricName="request.total"
   ```
   - Increased request volume may indicate traffic spike

4. **Check cache performance**:
   - Low cache hit rates increase external API calls
   - Check `cache.hit` and `cache.miss` metrics

5. **Check cold start frequency**:
   - Firebase Functions cold starts add latency
   - Check function instance count

### Remediation

**For External API Latency**:
1. Check external API status (see High Error Rate runbook)
2. Increase cache TTL temporarily to reduce API calls
3. Consider implementing circuit breaker if API consistently slow

**For High Load**:
1. Check if traffic spike is expected (e.g., new feature launch)
2. Consider scaling function instances (Firebase auto-scales)
3. Monitor memory and CPU usage

**For Cold Starts**:
1. Consider using minimum instances (Firebase setting)
2. Review function initialization code for optimization
3. Consider implementing warming strategy

**For Slow SIG Parsing**:
1. Check if AI fallback is being triggered excessively
2. Review recent changes to parsing logic
3. Consider optimizing regex patterns in rules-based parser

### Escalation

- **If p95 >5 seconds for 15 minutes**: Escalate to on-call engineer
- **If p95 >10 seconds**: Treat as CRITICAL and page on-call

### Post-Incident

1. Analyze latency distribution (p50, p75, p95, p99)
2. Identify slowest operations
3. Implement performance optimizations
4. Update alert thresholds if needed

---

## Low Uptime Alert

### Alert Condition
Function uptime <99% over 10 minutes

### Severity
CRITICAL

### Symptoms
- Function returning 503 Service Unavailable
- Health check endpoint failing
- No responses from API

### Impact
- Service unavailable to users
- Complete system outage
- Business impact

### Investigation Steps

1. **Check function status**:
   - Go to Firebase Console > Functions
   - Check if function is deployed and active
   - Check for deployment errors

2. **Check function logs**:
   ```
   resource.type="cloud_function"
   resource.labels.function_name="compute"
   severity="ERROR"
   ```

3. **Check for quota/limit issues**:
   - Firebase quota exceeded
   - Cloud API quota exceeded
   - Billing issues

4. **Check for deployment issues**:
   - Recent deployment failed
   - Function crashed during initialization
   - Invalid configuration

5. **Check health check endpoint**:
   ```
   GET /api/v1/health
   ```
   - Should return 200 OK with health status

### Remediation

**For Function Crashes**:
1. Check function logs for uncaught exceptions
2. Roll back to last known good deployment
3. Redeploy function if configuration issue

**For Quota Issues**:
1. Check Firebase quota usage
2. Request quota increase if needed
3. Verify billing account is active

**For Deployment Issues**:
1. Review recent deployment logs
2. Verify all environment variables set correctly
3. Check for dependency issues in package.json
4. Redeploy from known good commit

**For External Dependencies**:
1. Check if all external APIs are accessible
2. Verify network connectivity
3. Check for firewall/security group issues

### Escalation

- **Immediate**: Page on-call engineer via PagerDuty
- **If unresolved in 5 minutes**: Escalate to engineering lead
- **If widespread**: Initiate incident response procedure

### Post-Incident

1. Conduct post-mortem (mandatory for outages)
2. Document root cause and timeline
3. Implement preventive measures
4. Update disaster recovery procedures

---

## High Parse-Fail Rate Alert

### Alert Condition
SIG parse-fail rate >20% over 5 minutes

### Severity
WARNING

### Symptoms
- Increased `parse_error` responses
- Users unable to get quantity calculations
- AI fallback not helping

### Impact
- Reduced functionality
- Users see error messages
- Manual workarounds required

### Investigation Steps

1. **Check parse error logs**:
   ```
   jsonPayload.metricName="sig.parse.error"
   ```

2. **Check AI fallback usage**:
   ```
   jsonPayload.metricName="sig.parse.fallback"
   ```
   - If AI fallback rate is low, OpenAI may be down

3. **Identify problematic SIG patterns**:
   - Look for common patterns in failed SIGs (redacted in logs)
   - Check if new SIG format not recognized

4. **Check OpenAI API status**:
   - https://status.openai.com/
   - Check `openai.error` metrics

5. **Check for recent code changes**:
   - Review recent changes to SIG parser
   - Check if new patterns broke existing parsing

### Remediation

**For OpenAI API Issues**:
1. Check OpenAI API status
2. Verify API key is valid
3. Check rate limits
4. Consider temporary fallback to rules-only mode

**For Parser Regression**:
1. Review recent code changes
2. Revert if obvious regression
3. Add missing SIG patterns to rules-based parser
4. Update AI fallback prompt if needed

**For New SIG Patterns**:
1. Collect examples of failing SIGs (if PHI-safe)
2. Add patterns to rules-based parser
3. Update AI fallback prompt
4. Deploy fix and monitor

### Escalation

- **If parse-fail rate >40%**: Escalate to on-call engineer
- **If OpenAI completely down**: Consider disabling AI fallback temporarily

### Post-Incident

1. Add regression tests for new SIG patterns
2. Improve parser coverage
3. Consider parser performance monitoring
4. Update parser documentation

---

## External API Failure Alert

### Alert Condition
External API latency >5 seconds OR error rate >10% over 5 minutes

### Severity
WARNING

### Symptoms
- Slow responses from RxNorm/FDA/OpenAI
- Increased error responses
- Degraded mode activated

### Impact
- Increased latency
- Potential stale data usage
- Reduced accuracy (if stale cache)

### Investigation Steps

1. **Check external API status**:
   - RxNorm: https://rxnav.nlm.nih.gov/
   - FDA: https://open.fda.gov/apis/status/
   - OpenAI: https://status.openai.com/

2. **Check API latency metrics**:
   ```
   jsonPayload.metricName IN ("openai.request.duration", "ndc.validation.duration")
   ```

3. **Check API error metrics**:
   ```
   jsonPayload.metricName IN ("openai.error", "ndc.validation.error")
   ```

4. **Check degraded mode activation**:
   ```
   jsonPayload.metricName="cache.stale.usage"
   ```

5. **Check network connectivity**:
   - Verify Firebase can reach external APIs
   - Check for DNS issues
   - Check for firewall rules

### Remediation

**For RxNorm/FDA API Issues**:
1. Check official status pages
2. Enable degraded mode (stale cache) if not automatic
3. Monitor stale cache usage rate
4. Wait for external API recovery

**For OpenAI API Issues**:
1. Check OpenAI status and rate limits
2. Consider increasing retry backoff
3. Temporarily increase rules-based parsing priority
4. Monitor parse-fail rate

**For Network Issues**:
1. Check Firebase network status
2. Verify DNS resolution
3. Check firewall rules in Cloud Console
4. Test connectivity from Cloud Shell

### Escalation

- **If external API down >30 minutes**: Escalate to on-call
- **If affecting multiple APIs**: Treat as CRITICAL

### Post-Incident

1. Review external API SLAs
2. Consider implementing circuit breaker
3. Improve degraded mode strategy
4. Update cache TTL settings

---

## High Stale Cache Usage Alert

### Alert Condition
Stale cache usage >10% over 10 minutes

### Severity
WARNING

### Symptoms
- Prolonged external API issues
- Degraded mode active for extended period
- Potentially stale data returned to users

### Impact
- Reduced data accuracy
- Potential outdated NDC information
- User experience degradation

### Investigation Steps

1. **Check stale cache metrics**:
   ```
   jsonPayload.metricName="cache.stale.usage"
   ```

2. **Check external API status**:
   - Verify RxNorm/FDA APIs are still down
   - Check for prolonged outage

3. **Check cache age**:
   - Verify cache entries are within acceptable staleness window
   - Check max stale cache TTL configuration

4. **Check alternative data sources**:
   - Consider manual data update if critical

### Remediation

**For Prolonged API Outage**:
1. Continue monitoring external API status
2. Communicate to users about potential stale data
3. Consider manual cache refresh from backup source
4. Document incident timeline

**For Cache Configuration Issues**:
1. Review stale cache TTL settings
2. Adjust if too permissive
3. Consider implementing cache invalidation strategy

### Escalation

- **If stale cache usage >20%**: Escalate to on-call
- **If data accuracy critical**: Consider disabling stale cache

### Post-Incident

1. Review degraded mode strategy
2. Consider backup data sources
3. Implement better cache management
4. Update stakeholders on data quality

---

## General Troubleshooting Steps

### Access Logs
```bash
# Cloud Logging Query
resource.type="cloud_function"
resource.labels.function_name="compute"
timestamp>="2025-01-11T10:00:00Z"
```

### Check Metrics
```bash
# Cloud Monitoring Query
fetch cloud_function
| metric 'cloudfunctions.googleapis.com/function/execution_count'
| filter resource.function_name == 'compute'
| group_by 1m, [value_execution_count_mean: mean(value.execution_count)]
```

### Common CLI Commands
```bash
# Deploy function
firebase deploy --only functions:compute

# View logs
firebase functions:log --only compute

# Check function status
firebase functions:list
```

### Useful Links
- **Cloud Console**: https://console.cloud.google.com/
- **Firebase Console**: https://console.firebase.google.com/
- **Cloud Logging**: https://console.cloud.google.com/logs/
- **Cloud Monitoring**: https://console.cloud.google.com/monitoring/
- **RxNorm Status**: https://rxnav.nlm.nih.gov/
- **FDA API Status**: https://open.fda.gov/apis/status/
- **OpenAI Status**: https://status.openai.com/


