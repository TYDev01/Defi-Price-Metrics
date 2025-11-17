#!/bin/bash

# DefiPrice Markets - Quick Setup Script
# This script automates the initial setup process

set -e

echo "🚀 DefiPrice Markets - Setup Script"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Node.js 20+ is required. Current version: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v) detected${NC}"
echo ""

# Check if .env exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file already exists. Skipping environment setup.${NC}"
else
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo -e "${GREEN}✅ Created .env file${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env with your configuration before continuing!${NC}"
    echo ""
    read -p "Press Enter when you've updated .env file..."
    echo ""
fi

# Install bot dependencies
echo "📦 Installing bot dependencies..."
cd bot
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules exists. Skipping install.${NC}"
else
    npm install
    echo -e "${GREEN}✅ Bot dependencies installed${NC}"
fi
cd ..
echo ""

# Install dashboard dependencies
echo "📦 Installing dashboard dependencies..."
cd dashboard
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules exists. Skipping install.${NC}"
else
    npm install
    echo -e "${GREEN}✅ Dashboard dependencies installed${NC}"
fi
cd ..
echo ""

# Build bot
echo "🔨 Building bot..."
cd bot
npm run build
echo -e "${GREEN}✅ Bot built successfully${NC}"
cd ..
echo ""

# Prompt for schema registration
echo "📋 Schema Registration"
echo "====================="
echo ""
echo "Before starting the bot, you need to register the Somnia schema."
echo ""
read -p "Do you want to register the schema now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔧 Registering schema..."
    cd bot
    node dist/scripts/register-schema.js
    cd ..
    echo ""
    echo -e "${YELLOW}⚠️  Update SOMNIA_SCHEMA_ID in .env with the returned schema ID${NC}"
    echo ""
    read -p "Press Enter when you've updated .env file..."
    echo ""
fi

# Setup complete
echo "✨ Setup Complete!"
echo "================="
echo ""
echo "Next steps:"
echo ""
echo "1. Start the bot:"
echo "   ${GREEN}cd bot && npm run dev${NC}"
echo "   or for production:"
echo "   ${GREEN}pm2 start ecosystem.config.js${NC}"
echo ""
echo "2. Start the dashboard (in a new terminal):"
echo "   ${GREEN}cd dashboard && npm run dev${NC}"
echo "   or for production:"
echo "   ${GREEN}cd dashboard && npm run build && npm start${NC}"
echo ""
echo "3. Or use Docker:"
echo "   ${GREEN}docker-compose up -d${NC}"
echo ""
echo "📖 For detailed instructions, see README.md and DEPLOYMENT.md"
echo ""
echo -e "${GREEN}Happy trading! 🚀${NC}"
