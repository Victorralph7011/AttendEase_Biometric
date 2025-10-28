#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up Smart Attendance System...');

// Create necessary directories
const directories = [
  'backend/db',
  'backend/models',
  'backend/uploads',
  'backend/logs',
  'test/unit',
  'test/integration',
  'docs'
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Create .env file if it doesn't exist
const envPath = '.env';
if (!fs.existsSync(envPath)) {
  const envContent = `
# Smart Attendance System Configuration
NODE_ENV=development
PORT=3000
DB_PATH=backend/db/database.json

# Face Recognition Settings
RECOGNITION_THRESHOLD=0.6
MODEL_PATH=backend/models

# Security Settings
JWT_SECRET=your-super-secret-jwt-key-change-in-production
BCRYPT_ROUNDS=12

# Server Settings
CORS_ORIGIN=http://localhost:3000
REQUEST_LIMIT=10mb

# Logging
LOG_LEVEL=info
LOG_FILE=backend/logs/app.log

# Features
ENABLE_MEAL_TRACKING=true
ENABLE_ANALYTICS=true
ENABLE_BACKUP=true
`;
  
  fs.writeFileSync(envPath, envContent.trim());
  console.log('📝 Created .env file');
}

// Create .gitignore if it doesn't exist
const gitignorePath = '.gitignore';
if (!fs.existsSync(gitignorePath)) {
  const gitignoreContent = `
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Database
backend/db/database.json
backend/db/backup/

# Logs
backend/logs/
*.log

# Uploads
backend/uploads/
backend/models/

# Coverage reports
coverage/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Temporary files
tmp/
temp/
`;
  
  fs.writeFileSync(gitignorePath, gitignoreContent.trim());
  console.log('📝 Created .gitignore file');
}

console.log('✅ Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. npm install');
console.log('2. npm run setup:models');
console.log('3. npm start');
