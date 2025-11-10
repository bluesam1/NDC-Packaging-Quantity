# NDC Packaging & Quantity Calculator

A serverless fullstack application for calculating NDC packaging quantities based on prescription SIG (directions) and days supply.

## Prerequisites

- **Node.js**: v20 or later (LTS recommended)
- **npm**: v9 or later
- **Firebase CLI**: Latest version
  ```sh
  npm install -g firebase-tools
  ```

## Project Structure

```
ndc-packaging-quantity/
├── functions/              # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts       # Cloud Functions entry point
│   │   ├── types/         # TypeScript type definitions
│   │   └── validation/    # Zod validation schemas
│   └── package.json
├── mock-api/              # Mock API server for local development
│   ├── server.js          # Express mock server
│   └── data/              # Mock data fixtures
├── src/                    # SvelteKit frontend
│   ├── lib/
│   │   └── components/    # SvelteKit components
│   └── routes/            # SvelteKit routes
├── build/                  # Static build output (generated)
└── firebase.json           # Firebase configuration
```

## Local Development Setup

### 1. Install Dependencies

```sh
# Install root dependencies
npm install

# Install functions dependencies
cd functions && npm install && cd ..

# Install mock API dependencies
cd mock-api && npm install && cd ..
```

### 2. Configure Environment Variables

#### Frontend Environment Variables

Create a `.env.local` file in the root directory:

```env
# Firebase Functions Emulator URL
# Format: http://localhost:5001/{project-id}/us-central1
# Replace {project-id} with your Firebase project ID
VITE_API_URL=http://localhost:5001/ndc-qty/us-central1
```

#### Functions Environment Variables

Create a `functions/.env` file (or set in Firebase emulator configuration):

```env
# Use mock APIs instead of real APIs (optional, default: false)
# Set to 'true' to use mock APIs, 'false' or omit to use real APIs
USE_MOCK_APIS=false

# Mock API URLs (only used if USE_MOCK_APIS=true)
MOCK_RXNORM_URL=http://localhost:3001
MOCK_FDA_URL=http://localhost:3001

# Real API URLs (used if USE_MOCK_APIS=false or not set)
# These are the defaults and can be omitted
RXNORM_API_URL=https://rxnav.nlm.nih.gov/REST
FDA_API_URL=https://api.fda.gov/drug/ndc.json
```

**Note**: 
- To use mock APIs, set `USE_MOCK_APIS=true` and ensure the mock API server is running
- To use real APIs (default), omit `USE_MOCK_APIS` or set it to `false`
- In production, always use real APIs (do not set `USE_MOCK_APIS=true`)

### 3. Start Development Environment

You have several options for starting the development environment:

#### Option A: Start Everything Together (Recommended)

```sh
npm run dev:all
```

This starts:
- SvelteKit dev server (http://localhost:5173)
- Firebase Functions emulator (http://localhost:5001)
- Mock API server (http://localhost:3001)

#### Option B: Start Services Individually

```sh
# Terminal 1: Start SvelteKit dev server
npm run dev

# Terminal 2: Start Firebase emulators
npm run emulators:start

# Terminal 3: Start mock API server
npm run dev:mock-api
```

#### Option C: Start Only Functions Emulator

```sh
npm run dev:functions
```

### 4. Access Services

- **Frontend**: http://localhost:5173
- **Firebase Emulator UI**: http://localhost:4000
- **Functions Emulator**: http://localhost:5001
- **Mock API Server**: http://localhost:3001

## Available Scripts

### Root Scripts

- `npm run dev` - Start SvelteKit development server
- `npm run dev:functions` - Start Firebase Functions emulator only
- `npm run dev:mock-api` - Start mock API server
- `npm run dev:all` - Start all services (frontend + emulators + mock API)
- `npm run emulators:start` - Start Firebase emulators (Hosting + Functions)
- `npm run build` - Build production static site
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint and Prettier checks
- `npm run format` - Format code with Prettier
- `npm run test` - Run all tests
- `npm run test:unit` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests

### Functions Scripts

```sh
cd functions
npm run build          # Build TypeScript
npm run build:watch    # Build TypeScript in watch mode
npm run serve          # Build and start emulator
npm run deploy         # Deploy to Firebase
```

## Mock API Server

The mock API server simulates the RxNorm and FDA NDC Directory APIs for local development and testing. **Mock APIs are optional** - you can use real APIs directly or switch to mocks via environment variables.

### When to Use Mock APIs

- **Development**: Avoid hitting rate limits on real APIs (RxNorm: 10 req/sec, FDA: 3 req/sec)
- **Testing**: Predictable responses for integration tests
- **Offline Development**: Work without internet connectivity
- **Error Scenarios**: Test error handling with controlled responses

### When to Use Real APIs

- **Production**: Always use real APIs in production
- **Real Data Testing**: Test with actual API responses
- **Simpler Setup**: No need to run mock server

### RxNorm Endpoints

- `GET /findRxcuiByString?name={drug_name}` - Returns mock RxCUI
- `GET /rxcui/{rxcui}/ndcs` - Returns mock NDC list
- `GET /approximateTerm?term={drug_name}` - Returns mock approximate match

### FDA Endpoints

- `GET /drug/ndc.json?search=product_ndc:{ndc}` - Returns mock NDC data
- `GET /drug/ndc.json?search=brand_name:{name}` - Returns mock brand search

### Configuration

#### Mock API Server Configuration

The mock API server can be configured via environment variables:

- `PORT` - Server port (default: 3001)
- `DELAY_MS` - Simulated network latency in milliseconds (default: 100)

Example:
```sh
PORT=3001 DELAY_MS=200 node mock-api/server.js
```

#### Functions Environment Variables

In `functions/.env` or Firebase emulator configuration, set:

```env
# Use mock APIs instead of real APIs
USE_MOCK_APIS=true

# Mock API URLs (only used if USE_MOCK_APIS=true)
MOCK_RXNORM_URL=http://localhost:3001
MOCK_FDA_URL=http://localhost:3001

# Real API URLs (used if USE_MOCK_APIS=false or not set)
RXNORM_API_URL=https://rxnav.nlm.nih.gov/REST
FDA_API_URL=https://api.fda.gov/drug/ndc.json
```

**Default Behavior**: If `USE_MOCK_APIS` is not set or `false`, functions will use real APIs.

**Note**: In production, always use real APIs. The `USE_MOCK_APIS` environment variable should not be set in production.

## Firebase Emulators

Firebase emulators are configured in `firebase.json`:

- **Hosting Emulator**: Port 5000
- **Functions Emulator**: Port 5001
- **Emulator UI**: Port 4000

### Using Emulators

1. Start emulators: `npm run emulators:start`
2. Access Emulator UI: http://localhost:4000
3. Functions are available at: `http://localhost:5001/{project-id}/us-central1/{function-name}`

## Testing

### Unit Tests

```sh
npm run test:unit
```

### End-to-End Tests

```sh
npm run test:e2e
```

### Integration Tests

Integration tests use Firebase emulators. Start emulators first:

```sh
npm run emulators:start
# Then run integration tests
```

## Building for Production

```sh
npm run build
```

The production build is output to the `build/` directory, which is configured as the Firebase Hosting public directory.

## Deployment

### Deploy to Firebase

```sh
# Deploy everything (Hosting + Functions)
firebase deploy

# Deploy only Hosting
firebase deploy --only hosting

# Deploy only Functions
firebase deploy --only functions
```

### Environment Setup

Before deploying, ensure you have:

1. Firebase project initialized: `firebase init`
2. Secrets configured in Firebase Secret Manager:
   - `OPENAI_API_KEY`
   - `API_KEY`

## Troubleshooting

### Port Already in Use

If you get a "port already in use" error:

1. Check what's using the port: `lsof -i :PORT` (macOS/Linux) or `netstat -ano | findstr :PORT` (Windows)
2. Kill the process or change the port in configuration

### Functions Not Building

If functions fail to build:

1. Check TypeScript errors: `cd functions && npm run build`
2. Ensure all dependencies are installed: `cd functions && npm install`

### Mock API Not Starting

If the mock API server fails to start:

1. Check if port 3001 is available
2. Ensure Express is installed: `cd mock-api && npm install`
3. Check for syntax errors in `mock-api/server.js`

### CORS Errors

If you encounter CORS errors:

1. Ensure the frontend is using the correct API URL in `.env.local`
2. Check that CORS is configured correctly in `functions/src/index.ts`
3. Verify the origin matches the allowed origins in CORS configuration

## Additional Resources

- [SvelteKit Documentation](https://kit.svelte.dev/)
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Firebase Emulators Documentation](https://firebase.google.com/docs/emulator-suite)
- [Architecture Document](./docs/architecture.md)
- [Frontend Specification](./docs/front-end-spec.md)
