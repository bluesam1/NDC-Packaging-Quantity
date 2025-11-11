# 9) Database Schema

**MVP Decision**: No persistent database for MVP. All data is:
- Ephemeral (request/response only)
- Cached in-memory (LRU cache per function instance)
- Not persisted to disk

**Future Consideration**: If database is needed in v1.1+, consider Firestore for:
- Preferred NDC lists
- Formulary data
- Usage analytics (non-PHI)

---
