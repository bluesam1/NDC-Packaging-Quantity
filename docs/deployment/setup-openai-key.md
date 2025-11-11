# Setting Up OpenAI API Key for Firebase Functions

This guide explains how to set up the `OPENAI_API_KEY` secret for Firebase Functions.

## Prerequisites

- Firebase CLI installed and authenticated
- OpenAI API key (get one from https://platform.openai.com/api-keys)

## Option 1: Using Firebase Secret Manager (Recommended for Production)

### Step 1: Create the Secret

Run this command in your terminal:

```bash
firebase functions:secrets:set OPENAI_API_KEY
```

You'll be prompted to enter your OpenAI API key. The secret will be stored securely in Firebase Secret Manager.

### Step 2: Verify the Secret

To verify the secret was created:

```bash
firebase functions:secrets:access OPENAI_API_KEY
```

This will display the secret value (be careful with this in shared environments).

### Step 3: Deploy Functions

When you deploy your functions, Firebase will automatically make the secret available:

```bash
firebase deploy --only functions
```

The secret will be available as `process.env.OPENAI_API_KEY` in your function code.

## Option 2: Local Development (Firebase Emulator)

For local development, you can set the environment variable in a few ways:

### Method 1: Using .env file (Recommended)

1. Create a `.env` file in the `functions` directory:

```bash
cd functions
echo "OPENAI_API_KEY=your-api-key-here" > .env
```

2. Update `functions/package.json` to load the .env file:

```json
{
  "scripts": {
    "serve": "npm run build && dotenv -e .env -- firebase emulators:start --only functions"
  },
  "devDependencies": {
    "dotenv-cli": "^7.0.0"
  }
}
```

3. Install dotenv-cli:

```bash
npm install --save-dev dotenv-cli
```

### Method 2: Using Environment Variable Directly

Set the environment variable before running the emulator:

**Windows (PowerShell):**
```powershell
$env:OPENAI_API_KEY="your-api-key-here"
firebase emulators:start --only functions
```

**Windows (CMD):**
```cmd
set OPENAI_API_KEY=your-api-key-here
firebase emulators:start --only functions
```

**Mac/Linux:**
```bash
export OPENAI_API_KEY="your-api-key-here"
firebase emulators:start --only functions
```

### Method 3: Using .env.local (Git-ignored)

Create `functions/.env.local` (this file should be in `.gitignore`):

```bash
cd functions
echo "OPENAI_API_KEY=your-api-key-here" > .env.local
```

Then modify your emulator script to load it.

## Verifying the Setup

1. **Check logs**: When the function runs, you should see either:
   - `"Calling OpenAI API for SIG parsing"` (if AI fallback is used)
   - `"OpenAI API key not found - AI fallback disabled"` (if key is missing)

2. **Test with a natural language SIG**: Try a SIG that the rules parser can't handle, like:
   - "Take one tablet each morning"
   - "1 pill by mouth every day"

If the AI fallback is working, these should parse successfully.

## Security Notes

- **Never commit API keys to git**: Make sure `.env` and `.env.local` are in `.gitignore`
- **Use Secret Manager for production**: Always use Firebase Secret Manager for deployed functions
- **Rotate keys regularly**: If a key is compromised, rotate it immediately

## Troubleshooting

### Secret not available in deployed function

1. Make sure you've deployed after setting the secret:
   ```bash
   firebase deploy --only functions
   ```

2. Check that the secret is listed:
   ```bash
   firebase functions:secrets:list
   ```

### Secret not available in emulator

1. Make sure you're setting the environment variable before starting the emulator
2. Check that the variable is set:
   ```bash
   echo $OPENAI_API_KEY  # Mac/Linux
   echo %OPENAI_API_KEY%  # Windows CMD
   ```

### AI fallback still not working

1. Check the function logs:
   ```bash
   firebase functions:log
   ```

2. Look for warnings about the API key not being found
3. Verify `USE_AI_FALLBACK` is enabled (it's `true` by default)

