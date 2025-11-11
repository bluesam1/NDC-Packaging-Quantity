# Production Deployment Guide

This document provides instructions for deploying the NDC Packaging & Quantity Calculator API to production.

## Overview

The API is deployed using Firebase Cloud Functions with the following characteristics:
- **Platform**: Google Cloud Platform (via Firebase)
- **Runtime**: Node.js 20
- **Region**: us-central1
- **Memory**: 512MB (configurable)
- **Timeout**: 60 seconds
- **Concurrency**: 80 (default)

---

## Prerequisites

### Required Tools

1. **Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Node.js 20**:
   ```bash
   node --version  # Should be v20.x.x
   ```

3. **Git**:
   ```bash
   git --version
   ```

### Firebase Project Setup

1. Create Firebase project (if not exists)
2. Enable billing (required for Cloud Functions)
3. Enable required APIs:
   - Cloud Functions API
   - Cloud Logging API
   - Cloud Monitoring API
   - Secret Manager API

---

## Environment Configuration

### Environment Variables

Create `.env.production` file:

```bash
# Environment
ENVIRONMENT=production
NODE_ENV=production

# Service Configuration
SERVICE_NAME=ndc-qty-api
LOG_LEVEL=INFO
SAMPLING_RATE=0.1  # 10% sampling in production

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=10

# Feature Flags
USE_AI_FALLBACK=true
REQUIRE_API_KEY=false  # Set to true when ready

# External APIs (if needed)
# RXNORM_API_URL=https://rxnav.nlm.nih.gov/REST
# FDA_API_URL=https://api.fda.gov/drug/ndc.json
```

### Secrets (Firebase Secret Manager)

Store sensitive credentials in Secret Manager:

```bash
# OpenAI API Key
firebase functions:secrets:set OPENAI_API_KEY

# API Keys (if authentication enabled)
firebase functions:secrets:set API_KEYS
```

---

## Deployment Steps

### 1. Pre-Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] Code linted (`npm run lint`)
- [ ] Environment variables configured
- [ ] Secrets stored in Secret Manager
- [ ] CORS origins configured
- [ ] Rate limits configured
- [ ] Monitoring/alerting configured (Story 4.5)

### 2. Build and Test

```bash
cd functions
npm install
npm run build
npm test
```

### 3. Deploy to Production

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:compute

# Deploy with environment variables
firebase deploy --only functions --force
```

### 4. Verify Deployment

```bash
# Test health endpoint
curl https://us-central1-<project-id>.cloudfunctions.net/health

# Test compute endpoint
curl -X POST https://us-central1-<project-id>.cloudfunctions.net/compute \
  -H "Content-Type: application/json" \
  -d '{"drug_input":"Aspirin 81mg","sig":"Take 1 tablet daily","days_supply":30}'
```

### 5. Post-Deployment Validation

- [ ] Health check returns 200 OK
- [ ] Compute endpoint processes requests correctly
- [ ] Logs appearing in Cloud Logging
- [ ] Metrics appearing in Cloud Monitoring
- [ ] Alerts configured and active
- [ ] Rate limiting functional
- [ ] CORS working for Firebase Hosting origin

---

## Rollback Procedure

If deployment issues occur:

```bash
# View deployment history
firebase functions:list

# Rollback to previous version
firebase functions:delete compute
firebase deploy --only functions:compute@<previous-version>

# Or redeploy from previous git commit
git checkout <previous-commit>
firebase deploy --only functions
```

---

## Monitoring

### Cloud Logging

View logs:
```bash
# Via CLI
firebase functions:log --only compute

# Via Console
https://console.cloud.google.com/logs/query
```

### Cloud Monitoring

View metrics and dashboards:
```
https://console.cloud.google.com/monitoring/dashboards
```

### Alerts

Review alert policies:
```
https://console.cloud.google.com/monitoring/alerting/policies
```

---

## Performance Tuning

### Memory Allocation

Adjust memory based on usage patterns:

```javascript
// functions/src/index.ts
export const compute = onRequest({
  region: 'us-central1',
  memory: '512MB',  // Options: 128MB, 256MB, 512MB, 1GB, 2GB, 4GB
  timeoutSeconds: 60,
  maxInstances: 100,
}, handler);
```

### Concurrency

Adjust concurrent requests per instance:

```javascript
export const compute = onRequest({
  concurrency: 80,  // Default: 80, Max: 1000
}, handler);
```

### Min/Max Instances

Configure instance scaling:

```javascript
export const compute = onRequest({
  minInstances: 0,   // Keep 0 for cost optimization
  maxInstances: 100, // Adjust based on load
}, handler);
```

---

## Cost Optimization

### Recommendations

1. **Min Instances**: Keep at 0 (accept cold starts)
2. **Memory**: Start with 512MB, monitor usage
3. **Timeout**: 60s is sufficient for MVP
4. **Logging**: Use 10% sampling in production
5. **Cache**: Maximize cache hit rate to reduce API calls

### Cost Monitoring

- **Cloud Functions**: $0.40 per million invocations
- **Networking**: $0.12 per GB
- **Logging**: $0.50 per GB
- **Monitoring**: Free tier sufficient for MVP

Monitor costs:
```
https://console.cloud.google.com/billing
```

---

## Security Configuration

### HTTPS Only

Firebase Functions automatically enforce HTTPS. No configuration needed.

### CORS

Already configured in `functions/src/index.ts`:
- Production: Firebase Hosting origins only
- Development: localhost allowed

### Rate Limiting

Configured in middleware (Story 4.7):
- Default: 10 req/min per IP
- Configurable via `RATE_LIMIT_MAX_REQUESTS`

### Secrets

Never commit secrets to git. Use Firebase Secret Manager:

```bash
# List secrets
firebase functions:secrets:list

# Access secret in code
import { defineSecret } from 'firebase-functions/params';
const openaiApiKey = defineSecret('OPENAI_API_KEY');
```

---

## Disaster Recovery

### Backup Strategy

- **Code**: Version controlled in Git
- **Configuration**: Environment variables documented
- **Secrets**: Stored in Secret Manager (backed up)
- **Logs**: Retained for 30 days (Story 4.4)

### Recovery Time Objective (RTO)

- **Target**: <15 minutes
- **Procedure**:
  1. Identify issue via monitoring
  2. Rollback to previous version (5 min)
  3. Verify functionality (5 min)
  4. Notify stakeholders (5 min)

### Recovery Point Objective (RPO)

- **Target**: 0 (no data loss)
- **Rationale**: No persistent data stored (stateless API)

---

## Troubleshooting

### Common Issues

**Issue**: Function not deploying
- **Solution**: Check Firebase CLI version, re-authenticate

**Issue**: 500 Internal Server Error
- **Solution**: Check function logs, verify secrets configured

**Issue**: CORS errors
- **Solution**: Verify origin in CORS configuration

**Issue**: Rate limit too restrictive
- **Solution**: Adjust `RATE_LIMIT_MAX_REQUESTS` environment variable

**Issue**: High memory usage
- **Solution**: Increase memory allocation in function configuration

### Support Channels

- **Firebase Support**: https://firebase.google.com/support
- **Community**: https://stackoverflow.com/questions/tagged/firebase
- **Documentation**: https://firebase.google.com/docs/functions

---

## Related Documentation

- [Security Policy](../security/security-policy.md)
- [Monitoring & Alerting](../stories/4.5.monitoring-alerting.md)
- [Runbooks](../monitoring/runbooks.md)
- [API Documentation](./api-documentation.md)


