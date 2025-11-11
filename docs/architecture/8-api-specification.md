# 8) API Specification

### 8.1 REST API Endpoint

**Endpoint**: `POST /api/v1/compute`

**Request Schema** (from Data Models §4.1):
```typescript
{
  drug_input: string;           // Required, 2-200 chars, drug name or NDC
  sig: string;                  // Required, 3-500 chars, prescription directions
  days_supply: number;          // Required, 1-365, integer
  preferred_ndcs?: string[];    // Optional, max 10 NDCs, valid NDC format
  quantity_unit_override?: 'tab'|'cap'|'mL'|'actuation'|'unit';  // Optional
}
```

**Response Schema** (from Data Models §4.2):
```typescript
{
  rxnorm: { rxcui: string; name: string };
  computed: { dose_unit: string; per_day: number; total_qty: number; days_supply: number };
  ndc_selection: {
    chosen?: { ndc: string; pkg_size: number; active: boolean; overfill: number; packs: number };
    alternates: Array<{ ndc: string; pkg_size: number; active: boolean; overfill: number; packs: number }>;
  };
  flags: { inactive_ndcs: string[]; mismatch: boolean; notes?: string[]; error_code?: string | null };
}
```

**Error Response Schema** (from Data Models §4.3):
- `400` - Invalid input (`validation_error`)
- `422` - Unparseable SIG (`parse_error`)
- `424` - Dependency failure (`dependency_failure`) - includes `retry_after_ms`
- `429` - Rate limit exceeded (`rate_limit_exceeded`)
- `500` - Internal error (`internal_error`)

**Authentication**: Optional API key via `Authorization: Bearer <API_KEY>` header (configurable per environment)

**CORS**: 
- Production: Firebase Hosting origin only
- Development: localhost allowed

**Rate Limiting**: Per-IP rate limiting (10 requests per minute) - MVP implementation

---
