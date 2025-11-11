# 3) Tech Stack

### 3.1 Cloud Infrastructure

- **Provider**: Google Cloud Platform (via Firebase)
- **Key Services**: 
  - Firebase Hosting (static site hosting)
  - Firebase Cloud Functions v2 (serverless compute)
  - Firebase Secret Manager (secrets management)
  - Cloud Logging (structured logging)
  - Cloud Monitoring (metrics and alerts)
- **Deployment Regions**: `us-central1` (Cloud Functions), Global (Firebase Hosting CDN)

### 3.2 Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|-----------|---------|---------|------------|
| **Frontend Language** | TypeScript | Latest stable | Type-safe frontend development | Strong typing, excellent tooling, team expertise |
| **Frontend Framework** | SvelteKit | Latest stable | Frontend framework and routing | Modern, performant, excellent DX, built-in routing |
| **Frontend Build Tool** | Vite | Latest (default with SvelteKit) | Fast dev server, optimized builds | Fast HMR, optimized production builds using Rollup |
| **Frontend Adapter** | @sveltejs/adapter-static | Latest | Static site generation | Required for Firebase Hosting static deployment |
| **Backend Language** | TypeScript | Latest stable | Type-safe backend development | Consistency with frontend, strong typing |
| **Backend Runtime** | Node.js | 20 | JavaScript runtime | LTS version, stable performance, Firebase Functions v2 requirement |
| **Backend Framework** | Firebase Cloud Functions v2 | Latest | Serverless compute | Auto-scaling, cost-effective, integrated with Firebase ecosystem |
| **API Style** | REST | v1 | API communication | Simple, well-understood, easy to integrate |
| **Validation Library** | Zod | Latest | Runtime type validation | Type-safe validation, excellent TypeScript integration |
| **HTTP Client (Frontend)** | Axios | Latest | API requests from frontend | Reliable, interceptors, good error handling |
| **HTTP Client (Backend)** | Axios | Latest | External API calls | Consistent with frontend, reliable |
| **AI Integration** | OpenAI SDK | Latest | SIG parsing fallback | Official SDK, well-maintained, GPT-4o-mini support |
| **Caching** | lru-cache | Latest | In-memory LRU cache | Lightweight, efficient, per-instance caching |
| **Secrets Management** | Firebase Secret Manager | Latest | API keys and secrets | Secure, integrated with Cloud Functions |
| **Logging** | Cloud Logging | Native | Structured logging | Integrated with Firebase, JSON format |
| **Monitoring** | Cloud Monitoring | Native | Metrics and alerts | Integrated with Firebase, default alerts |
| **CI/CD** | Manual (firebase deploy) | - | Deployment | MVP simplicity, automation deferred to v1.1 |
| **Testing Framework** | TBD | - | Unit and integration tests | To be determined during Epic 1 |

---
