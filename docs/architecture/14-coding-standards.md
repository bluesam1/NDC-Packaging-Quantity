# 14) Coding Standards

### 14.1 Core Standards

- **Languages & Runtimes**: TypeScript (latest stable), Node.js 20
- **Style & Linting**: ESLint + Prettier (to be configured in Epic 1)
- **Test Organization**: Tests co-located with source files (`*.test.ts`)

### 14.2 Critical Rules

- **Type Safety**: Always use TypeScript types, never `any` without justification
- **Error Handling**: All API routes must use standard `ErrorResponse` format
- **Logging**: Never use `console.log` in production - use structured logger
- **Secrets**: Never hardcode secrets - use Firebase Secret Manager
- **PHI Redaction**: Always redact `drug_input` and `sig` from logs
- **API Calls**: Use Axios with proper error handling and timeouts
- **Validation**: Validate all inputs at API boundary using Zod schemas
- **Caching**: Use LRU cache wrapper, never direct cache access in business logic

---
