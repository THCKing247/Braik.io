# Braik Setup Script for Windows
# Run this script in PowerShell: .\setup.ps1

Write-Host "=== Braik Local Development Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check for Node.js
Write-Host "Checking for Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check for npm
Write-Host "Checking for npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✓ npm found: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm not found. Please install Node.js (includes npm)" -ForegroundColor Red
    exit 1
}

# Check for PostgreSQL (optional check)
Write-Host ""
Write-Host "Note: Make sure PostgreSQL is installed and running" -ForegroundColor Yellow
Write-Host "You can use Docker: docker run --name braik-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=braik -p 5432:5432 -d postgres:15" -ForegroundColor Cyan
Write-Host ""

# Create .env file if it doesn't exist
if (-not (Test-Path .env)) {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    
    # Generate a random secret
    $secret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    $base64Secret = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($secret))
    
    $envContent = @"
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/braik?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$base64Secret"

# Stripe (optional - for payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# OpenAI (optional - for AI assistant)
OPENAI_API_KEY="sk-..."

# File Upload (local dev)
UPLOAD_DIR="./uploads"
"@
    
    $envContent | Out-File -FilePath .env -Encoding utf8
    Write-Host "✓ .env file created" -ForegroundColor Green
    Write-Host "  Please update DATABASE_URL with your PostgreSQL credentials" -ForegroundColor Yellow
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
}

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Generate Prisma client
Write-Host ""
Write-Host "Generating Prisma client..." -ForegroundColor Yellow
npm run db:generate
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Prisma client generated" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to generate Prisma client" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Setup Complete! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Make sure PostgreSQL is running" -ForegroundColor White
Write-Host "2. Update DATABASE_URL in .env if needed" -ForegroundColor White
Write-Host "3. Run: npm run db:push    (to create database tables)" -ForegroundColor White
Write-Host "4. Run: npm run db:seed    (to add sample data)" -ForegroundColor White
Write-Host "5. Run: npm run dev        (to start the server)" -ForegroundColor White
Write-Host ""
Write-Host "Then visit: http://localhost:3000" -ForegroundColor Cyan
