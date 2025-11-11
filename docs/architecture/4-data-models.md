# 4) Data Models

### 4.1 ComputeRequest

**Purpose**: Request payload for the compute API endpoint

**Key Attributes**:
- `drug_input`: `string` - Drug name (brand/generic) or NDC format (11 digits)
- `sig`: `string` - Prescription directions (free text)
- `days_supply`: `number` - Days of medication supply (1-365)
- `preferred_ndcs`: `string[]` (optional) - Array of preferred NDCs for ranking bias
- `quantity_unit_override`: `'tab'|'cap'|'mL'|'actuation'|'unit'` (optional) - Override unit type

**TypeScript Interface**:
```typescript
export type ComputeRequest = {
  drug_input: string;
  sig: string;
  days_supply: number;
  preferred_ndcs?: string[];
  quantity_unit_override?: 'tab'|'cap'|'mL'|'actuation'|'unit';
};
```

**Relationships**: None (input model)

### 4.2 ComputeResponse

**Purpose**: Response payload from the compute API endpoint

**Key Attributes**:
- `rxnorm`: `{ rxcui: string; name: string }` - Normalized RxNorm data
- `computed`: `{ dose_unit: string; per_day: number; total_qty: number; days_supply: number }` - Calculated quantities
- `ndc_selection`: Object containing chosen package and alternates
  - `chosen`: `{ ndc: string; pkg_size: number; active: boolean; overfill: number; packs: number }` (optional)
  - `alternates`: Array of alternate package options
- `flags`: `{ inactive_ndcs: string[]; mismatch: boolean; notes?: string[]; error_code?: string | null }` - Warnings and status flags

**TypeScript Interface**:
```typescript
export type ComputeResponse = {
  rxnorm: { rxcui: string; name: string };
  computed: { dose_unit: string; per_day: number; total_qty: number; days_supply: number };
  ndc_selection: {
    chosen?: { ndc: string; pkg_size: number; active: boolean; overfill: number; packs: number };
    alternates: { ndc: string; pkg_size: number; active: boolean; overfill: number; packs: number }[];
  };
  flags: { inactive_ndcs: string[]; mismatch: boolean; notes?: string[]; error_code?: string | null };
};
```

**Relationships**: None (output model)

### 4.3 ErrorResponse

**Purpose**: Standardized error response format

**Key Attributes**:
- `error`: `string` - Human-readable error message
- `error_code`: `'validation_error' | 'parse_error' | 'dependency_failure' | 'internal_error' | 'rate_limit_exceeded'` - Machine-readable error code
- `detail`: `string` (optional) - Additional context or guidance
- `retry_after_ms`: `number` (optional) - Retry delay in milliseconds (for 424 errors)
- `field_errors`: `Array<{ field: string; message: string }>` (optional) - Field-level validation errors

**TypeScript Interface**:
```typescript
export type ErrorResponse = {
  error: string;
  error_code: 'validation_error' | 'parse_error' | 'dependency_failure' | 'internal_error' | 'rate_limit_exceeded';
  detail?: string;
  retry_after_ms?: number;
  field_errors?: Array<{ field: string; message: string }>;
};
```

**Relationships**: None (error model)

---
