# API Key Management for Cape Smash Webapp

This document explains how to securely manage API keys for the Cape Smash webapp, particularly the start.gg API key.

## 🔐 Security Setup

### Local Development

1. **Create your local environment file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Add your API keys to `.env.local`:**
   ```env
   NG_APP_STARTGG_API_TOKEN=your_actual_startgg_api_token_here
   ```

3. **The `.env.local` file is automatically ignored by git** (listed in `.gitignore`)

### Firebase Production Deployment

#### Option 1: Using Environment Variables (Recommended)

1. **Set environment variables before building:**
   ```bash
   export NG_APP_STARTGG_API_TOKEN=your_production_api_token
   ```

2. **Use the deployment script:**
   ```bash
   ./deploy.sh
   ```

#### Option 2: CI/CD Pipeline (GitHub Actions)

If using GitHub Actions, add secrets to your repository:

1. Go to Repository Settings → Secrets and Variables → Actions
2. Add `NG_APP_STARTGG_API_TOKEN` as a repository secret
3. Use in your workflow:
   ```yaml
   - name: Build and Deploy
     env:
       NG_APP_STARTGG_API_TOKEN: ${{ secrets.NG_APP_STARTGG_API_TOKEN }}
     run: |
       npm run build --prod
       npx firebase deploy
   ```

## 📁 File Structure

```
├── .env.example          # Template for environment variables
├── .env.local           # Your local environment (DO NOT COMMIT)
├── load-env.js          # Environment loader script
├── deploy.sh            # Production deployment script
└── src/environments/
    ├── environment.ts       # Development environment
    └── environment.prod.ts  # Production environment
```

## 🚫 Security Best Practices

1. **Never commit API keys to git**
2. **Use environment variables for all sensitive data**
3. **Different API keys for development vs production**
4. **Regularly rotate API keys**
5. **Monitor API usage for unauthorized access**

## 🔧 Using the API Key in Code

```typescript
import { environment } from '../environments/environment';

// In your service
const apiToken = environment.startggApiToken;
```

## 🚀 Deployment Commands

### Local Development
```bash
npm start
```

### Production Deployment
```bash
export NG_APP_STARTGG_API_TOKEN=your_production_token
./deploy.sh
```

## 🔍 Troubleshooting

- **"API token not found"**: Check that your `.env.local` file exists and contains the token
- **"Environment variable not set"**: Ensure you've exported the variable before building
- **"Build fails"**: Verify the API token is valid and has necessary permissions
