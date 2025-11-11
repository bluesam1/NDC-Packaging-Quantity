# 10) Source Tree

```
ndc-qty/
├── .github/                    # CI/CD workflows (v1.1)
├── docs/                       # Documentation
│   ├── PRD.md
│   ├── front-end-spec.md
│   ├── architecture.md
│   └── reference/
├── functions/                  # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts            # Function entry point
│   │   ├── handlers/
│   │   │   └── compute.ts      # Main compute handler
│   │   ├── services/
│   │   │   ├── rxnorm-client.ts
│   │   │   ├── fda-client.ts
│   │   │   ├── sig-parser.ts
│   │   │   └── package-selector.ts
│   │   ├── utils/
│   │   │   ├── cache.ts        # LRU cache wrapper
│   │   │   ├── logger.ts      # Structured logging
│   │   │   └── errors.ts       # Error handling
│   │   ├── types/
│   │   │   └── index.ts        # TypeScript types
│   │   └── validation/
│   │       └── schemas.ts      # Zod schemas
│   ├── tests/                  # Backend tests
│   ├── package.json
│   └── tsconfig.json
├── src/                        # SvelteKit frontend
│   ├── lib/
│   │   ├── components/         # UI components
│   │   │   ├── Header.svelte
│   │   │   ├── InputForm.svelte
│   │   │   ├── ResultsCard.svelte
│   │   │   ├── Toast.svelte
│   │   │   ├── Button.svelte
│   │   │   ├── Input.svelte
│   │   │   ├── Badge.svelte
│   │   │   └── Card.svelte
│   │   ├── services/
│   │   │   └── api.ts           # API client
│   │   ├── stores/              # State management
│   │   │   └── results.ts
│   │   └── utils/
│   │       └── validation.ts
│   ├── routes/
│   │   └── +page.svelte        # Main page
│   ├── app.html
│   └── app.d.ts
├── public/                     # Static assets
├── tests/                      # Frontend tests
├── .env.example
├── firebase.json               # Firebase config
├── firebase.json               # Firebase config
├── svelte.config.js            # SvelteKit config
├── package.json                # Root package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---
