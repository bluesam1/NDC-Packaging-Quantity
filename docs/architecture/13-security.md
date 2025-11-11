# 13) Security

### 13.1 Input Validation

- **Validation Library**: Zod
- **Validation Location**: API boundary (Cloud Function handler)
- **Required Rules**:
  - All external inputs MUST be validated before processing
  - Validation at API boundary before any business logic
  - Whitelist approach preferred over blacklist

### 13.2 Authentication & Authorization

- **Auth Method**: Optional API key authentication (configurable per environment)
- **Session Management**: Stateless (no sessions)
- **Required Patterns**:
  - API key via `Authorization: Bearer <API_KEY>` header
  - API key stored in Firebase Secret Manager
  - CORS policy restricts origins (Firebase Hosting in prod, localhost in dev)

### 13.3 Secrets Management

- **Development**: `.env` file (not committed) or Firebase emulator config
- **Production**: Firebase Secret Manager
- **Code Requirements**:
  - NEVER hardcode secrets
  - Access via `defineSecret()` from `firebase-functions/params`
  - No secrets in logs or error messages

**Required Secrets**:
- `OPENAI_API_KEY` - OpenAI API key for SIG parsing fallback
- `API_KEY` - Optional API key for authentication

### 13.4 API Security

- **Rate Limiting**: Per-IP rate limiting (10 req/min) - in-memory Map per instance
- **CORS Policy**: 
  - Production: Firebase Hosting origin only
  - Development: localhost allowed
- **Security Headers**: Firebase Hosting default headers (HTTPS enforcement)
- **HTTPS Enforcement**: Firebase Hosting enforces HTTPS (TLS 1.2+)

### 13.5 Data Protection

- **Encryption at Rest**: N/A (no persistent storage for MVP)
- **Encryption in Transit**: HTTPS/TLS everywhere (Firebase default)
- **PII Handling**: 
  - No PHI persistence
  - Redact `drug_input` and `sig` from logs
  - Ephemeral processing only
- **Logging Restrictions**: Never log full request/response bodies with SIG text

### 13.6 Dependency Security

- **Scanning Tool**: `npm audit` (manual for MVP)
- **Update Policy**: Regular dependency updates, security patches immediately
- **Approval Process**: Review and test before updating dependencies

### 13.7 Security Testing

- **SAST Tool**: ESLint security plugins (manual for MVP)
- **DAST Tool**: Manual testing for MVP
- **Penetration Testing**: Manual security review before production

---
