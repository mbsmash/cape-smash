#!/bin/bash

# Firebase Deployment Script with Environment Variables
# This script builds and deploys your Angular app to Firebase with proper environment variable handling

echo "🚀 Starting Firebase deployment process..."

# Check if environment variables are set for production deployment
if [ -z "$NG_APP_STARTGG_API_TOKEN" ]; then
    echo "⚠️  Warning: NG_APP_STARTGG_API_TOKEN environment variable is not set"
    echo "Using the token from environment.prod.ts file"
    echo "For secure production deployment, set: export NG_APP_STARTGG_API_TOKEN=your_production_token"
else
    echo "✅ Environment variables configured"
    # Replace the token in the production environment file
    echo "🔧 Updating production environment with secure token..."
    sed -i.bak "s/startggApiToken: '.*'/startggApiToken: '$NG_APP_STARTGG_API_TOKEN'/" src/environments/environment.prod.ts
fi

# Build the application with production configuration
echo "🔨 Building Angular application for production..."
npm run build --prod

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    # Restore backup if it exists
    if [ -f "src/environments/environment.prod.ts.bak" ]; then
        mv src/environments/environment.prod.ts.bak src/environments/environment.prod.ts
    fi
    exit 1
fi

echo "✅ Build successful"

# Deploy to Firebase
echo "🌐 Deploying to Firebase..."
npx firebase deploy

# Restore the original environment file if we modified it
if [ -f "src/environments/environment.prod.ts.bak" ]; then
    mv src/environments/environment.prod.ts.bak src/environments/environment.prod.ts
    echo "🔒 Production environment file restored"
fi

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo "🎉 Your app has been deployed to Firebase!"
else
    echo "❌ Deployment failed!"
    exit 1
fi
