# 6) External APIs

### 6.1 RxNorm API

- **Purpose**: Drug name normalization to RxCUI and NDC↔RxCUI crosswalk
- **Documentation**: https://rxnav.nlm.nih.gov/RESTful.html
- **Base URL(s)**: `https://rxnav.nlm.nih.gov/REST/`
- **Authentication**: None required (public API)
- **Rate Limits**: 10 req/sec per function instance (conservative limit)

**Key Endpoints Used**:
- `GET /findRxcuiByString?name={drug_name}` - Name to RxCUI normalization
- `GET /rxcui/{rxcui}/ndcs` - RxCUI to NDC mapping
- `GET /approximateTerm?term={drug_name}` - Approximate matching (fallback)

**Integration Notes**: 
- Do NOT use for NDC activity status (FDA is source of truth)
- Cache responses for 1 hour TTL (in-memory LRU cache)
- Retry on 5xx errors and timeouts (max 1 retry, exponential backoff)
- Timeout: 5 seconds per request

### 6.2 FDA NDC Directory API (openFDA)

- **Purpose**: Authoritative source for NDC activity status, package sizes, and marketing status
- **Documentation**: https://open.fda.gov/apis/drug/ndc/
- **Base URL(s)**: `https://api.fda.gov/drug/ndc.json`
- **Authentication**: None required (public API)
- **Rate Limits**: 3 req/sec per instance (openFDA limit: 240/min)

**Key Endpoints Used**:
- `GET /?search=product_ndc:{ndc}` - Lookup by NDC
- `GET /?search=brand_name:{name}` - Search by brand name

**Integration Notes**: 
- Source of truth for NDC activity status and package metadata
- If FDA and RxNorm disagree, trust FDA for status/packaging
- Cache responses for 24 hours TTL (in-memory LRU cache)
- Retry on 5xx errors and timeouts (max 1 retry, exponential backoff)
- Timeout: 5 seconds per request

### 6.3 OpenAI API

- **Purpose**: AI fallback for SIG parsing when rules-based parser fails
- **Documentation**: https://platform.openai.com/docs/api-reference
- **Base URL(s)**: `https://api.openai.com/v1/`
- **Authentication**: API key via Firebase Secret Manager (`OPENAI_API_KEY`)
- **Rate Limits**: OpenAI tier limits (sufficient for MVP fallback usage)

**Key Endpoints Used**:
- `POST /chat/completions` - GPT-4o-mini for SIG parsing

**Integration Notes**: 
- Feature flag `USE_AI_FALLBACK` (default: true for MVP)
- Only called when rules-based parser fails
- Expected fallback rate: ~10% of requests
- Cost: ~$0.00001 per request average
- Retry on 5xx errors and timeouts (max 1 retry, exponential backoff)
- Timeout: 5 seconds per request

---
