# Security Policy

This document outlines the security policies and best practices for the NDC Packaging & Quantity Calculator API.

## Overview

The API implements multiple layers of security to protect against abuse, unauthorized access, and data breaches while maintaining HIPAA compliance for PHI handling.

---

## Rate Limiting

### Configuration

- **Limit**: 10 requests per minute per IP address (configurable via `RATE_LIMIT_MAX_REQUESTS` env var)
- **Window**: 60 seconds (rolling window)
- **Enforcement**: Per-IP address
- **Response**: 429 Too Many Requests with `Retry-After` header

### Bypasses

- Health check endpoint (`/health`)
- Authenticated requests (when API key authentication is enabled)

### Headers

Requests include the following rate limit headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Timestamp when the rate limit resets

### Monitoring

- Rate limit violations are logged with anonymized IP addresses
- Metric: `rate_limit.exceeded` (tracked in Story 4.4)
- Alert: Rate limit violations >100/hour (Story 4.5)

---

## API Key Authentication (Optional)

### Status

API key authentication is currently **disabled by default** for MVP. It can be enabled via feature flag in production.

### Configuration

- **Feature Flag**: `REQUIRE_API_KEY` (default: false)
- **Header**: `Authorization: Bearer <api-key>`
- **Storage**: Firebase Secret Manager
- **Validation**: Format, expiration, revocation status

### Benefits

When enabled:
- Rate limit bypass for authenticated requests
- Usage tracking per API key
- Granular access control
- Revocation capability

### Implementation (Future)

```typescript
// Enable API key authentication
REQUIRE_API_KEY=true

// Validate API key format
Authorization: Bearer ndc-qty-<random-32-chars>
```

---

## CORS Policy

### Production

- **Allowed Origins**: Firebase Hosting domains only
  - `https://<project-id>.web.app`
  - `https://<project-id>.firebaseapp.com`
- **Allowed Methods**: `GET`, `POST`, `OPTIONS`
- **Allowed Headers**: `Content-Type`, `Authorization`
- **Credentials**: false (no cookies)
- **Max Age**: 3600 seconds (1 hour)

### Development/Staging

- **Allowed Origins**: `localhost`, `127.0.0.1` (any port)
- **Credentials**: true (for testing)

### Configuration

CORS policy is configured in `functions/src/index.ts` and automatically enforced by Firebase Cloud Functions.

---

## Security Headers

All responses include the following security headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Enable XSS protection |
| `Strict-Transport-Security` | `max-age=31536000` | Enforce HTTPS (production) |
| `Content-Security-Policy` | `default-src 'self'` | Restrict resource loading |

---

## Input Sanitization

### Validation

All inputs are validated using Zod schemas (Story 2.8):
- `drug_input`: String, max 200 characters, alphanumeric + spaces
- `sig`: String, max 500 characters, alphanumeric + common punctuation
- `preferred_ndcs`: Array of NDC codes, validated against NDC format
- `days_supply`: Integer, 1-90 (configurable)

### Sanitization

- **Trim whitespace**: All string inputs
- **Remove control characters**: `\x00-\x1F`, `\x7F`
- **NDC format validation**: `XXXXX-XXXX-XX` or `XXXXX-XXX-XX` or `XXXX-XXXX-XX`
- **Prevent injection**: SQL, NoSQL, command injection (via Zod validation)

### PHI Handling

- **No Persistent Storage**: PHI is never stored (drug_input, sig)
- **Log Redaction**: PHI is automatically redacted from all logs (Story 4.4)
- **In-Memory Only**: All processing occurs in-memory
- **Immediate Disposal**: Data is discarded after response

---

## Authentication Failures

### Monitoring

- All authentication failures are logged with:
  - Timestamp
  - Request path
  - Anonymized IP address
  - Failure reason (missing key, invalid key, expired key)
- Metric: `auth.failure` (tracked in Story 4.4)
- Alert: Authentication failure rate >5% (Story 4.5)

### Response

- **Status**: 401 Unauthorized
- **Error Code**: `authentication_error`
- **Message**: "Invalid or missing API key"
- **Headers**: `WWW-Authenticate: Bearer`

---

## Network Security

### Transport Security

- **HTTPS Only**: All production traffic must use HTTPS
- **TLS Version**: TLS 1.2 minimum (TLS 1.3 preferred)
- **Certificate**: Managed by Firebase/Google Cloud
- **HSTS**: Strict-Transport-Security header enforced

### Firewall Rules

- **Inbound**: Allow HTTPS (443) from Firebase Hosting only
- **Outbound**: Allow HTTPS to external APIs (RxNorm, FDA, OpenAI)
- **Internal**: No direct database access (not used in MVP)

---

## Secrets Management

### Firebase Secret Manager

All sensitive credentials are stored in Firebase Secret Manager:
- OpenAI API key (Story 2.4)
- API keys for authentication (if enabled)
- External API credentials (future)

### Access Control

- **Service Account**: Firebase Functions service account
- **Permissions**: secretmanager.secretAccessor
- **Rotation**: Manual rotation recommended every 90 days
- **Auditing**: All secret access is logged

---

## Incident Response

### Detection

1. **Automated Monitoring**: Alerts from Story 4.5
2. **Log Analysis**: Regular review of error logs
3. **Rate Limit Violations**: Spike in 429 responses
4. **Authentication Failures**: Spike in 401 responses

### Response Procedure

1. **Identify**: Determine nature and scope of incident
2. **Contain**: Block malicious IPs, revoke compromised keys
3. **Investigate**: Review logs, identify root cause
4. **Remediate**: Fix vulnerabilities, update security policies
5. **Document**: Post-incident report, lessons learned

### Escalation

- **Security Incident**: Immediate escalation to security team
- **Data Breach**: Follow HIPAA breach notification procedures
- **Service Abuse**: Review rate limits, consider IP banning

---

## Compliance

### HIPAA Compliance

- **PHI Protection**: No persistent PHI storage
- **Log Redaction**: All PHI redacted from logs
- **Access Control**: Service account only
- **Audit Logging**: All API requests logged
- **Encryption**: HTTPS in transit, no storage at rest

### Best Practices

- **Principle of Least Privilege**: Minimal permissions for service accounts
- **Defense in Depth**: Multiple layers of security
- **Regular Audits**: Monthly security reviews
- **Vulnerability Scanning**: Automated dependency scanning (npm audit)
- **Penetration Testing**: Annual external audit (recommended)

---

## Security Updates

### Dependency Management

- **Automated Scanning**: Dependabot enabled
- **Update Frequency**: Weekly review of security advisories
- **Critical Patches**: Immediate deployment (<24 hours)
- **Non-Critical**: Monthly patching cycle

### Node.js Runtime

- **Version**: Node.js 20 LTS (latest stable)
- **Updates**: Follow Firebase Functions supported versions
- **EOL Monitoring**: Upgrade before end-of-life

---

## Security Contacts

### Reporting Security Issues

- **Email**: security@example.com
- **Response Time**: 24 hours
- **Severity**: Use CVSS scoring system
- **Disclosure**: Responsible disclosure policy

### Security Team

- **Lead**: Platform Security Engineer
- **Backup**: Engineering Lead
- **On-Call**: 24/7 rotation

---

## Related Documentation

- [Rate Limiting Middleware](../functions/src/middleware/rate-limiting-middleware.ts)
- [Telemetry & Structured Logging](../stories/4.4.telemetry-structured-logging.md)
- [Monitoring & Alerting](../stories/4.5.monitoring-alerting.md)
- [Runbooks](../monitoring/runbooks.md)


