# 11) Infrastructure and Deployment

### 11.1 Infrastructure as Code

- **Tool**: Firebase CLI (declarative configuration)
- **Location**: `firebase.json`, `firebase.json` (Firebase config files)
- **Approach**: Firebase-native configuration (no Terraform/Pulumi for MVP)

### 11.2 Deployment Strategy

- **Strategy**: Manual deployment via `firebase deploy` (MVP)
- **CI/CD Platform**: Manual (automation deferred to v1.1)
- **Pipeline Configuration**: N/A for MVP

### 11.3 Environments

- **Development**: `{project-id}-dev` Firebase project
  - Local development with Firebase emulators
  - Mock APIs for RxNorm/FDA during development
- **Production**: `{project-id}` Firebase project
  - Firebase Hosting (static frontend)
  - Cloud Functions v2 (us-central1)
  - Production secrets in Secret Manager

### 11.4 Environment Promotion Flow

```
Local Development (Emulators)
    ↓
Development Firebase Project (Manual Deploy)
    ↓
Production Firebase Project (Manual Deploy)
```

### 11.5 Rollback Strategy

- **Primary Method**: Firebase Hosting version rollback + Cloud Function version rollback
- **Trigger Conditions**: Critical errors, performance degradation, security issues
- **Recovery Time Objective**: < 5 minutes (manual rollback)

---
