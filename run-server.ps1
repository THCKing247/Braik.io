# Complete Setup and Run Script
# Run this AFTER installing Node.js

Write-Host "=== Braik Server Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check for Node.js
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js first:" -ForegroundColor Yellow
    Write-Host "1. Go to https://nodejs.org/" -ForegroundColor White
    Write-Host "2. Download and install the LTS version" -ForegroundColor White
    Write-Host "3. Restart your terminal" -ForegroundColor White
    Write-Host "4. Run this script again" -ForegroundColor White
    exit 1
}

# Check for npm
try {
    $npmVersion = npm --version
    Write-Host "✓ npm found: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Create .env if it doesn't exist
if (-not (Test-Path .env)) {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    $secret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    $base64Secret = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($secret))
    
    $envContent = @"
# Supabase Configuration (REQUIRED)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_ANON_KEY="your-anon-key"

# Next.js
APP_URL="http://localhost:3000"
AUTH_SECRET="$base64Secret"

# File Upload (local dev)
UPLOAD_DIR="./uploads"
"@
    
    $envContent | Out-File -FilePath .env -Encoding utf8
    Write-Host "✓ .env file created" -ForegroundColor Green
    Write-Host "  Note: Update Supabase credentials in .env" -ForegroundColor Yellow
} else {
    Write-Host "✓ .env file exists" -ForegroundColor Green
}

# Install dependencies
if (-not (Test-Path node_modules)) {
    Write-Host ""
    Write-Host "Installing dependencies (this may take a few minutes)..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✓ Dependencies already installed" -ForegroundColor Green
}

# Check Supabase configuration
Write-Host ""
Write-Host "Checking Supabase configuration..." -ForegroundColor Yellow
if (-not (Test-Path .env)) {
    Write-Host "⚠ .env file not found. Please create it with Supabase credentials." -ForegroundColor Yellow
} else {
    $envContent = Get-Content .env -Raw
    if ($envContent -notmatch "SUPABASE_URL") {
        Write-Host "⚠ SUPABASE_URL not found in .env" -ForegroundColor Yellow
    } else {
        Write-Host "✓ Supabase configuration found" -ForegroundColor Green
    }
    if ($envContent -notmatch "SUPABASE_SERVICE_ROLE_KEY") {
        Write-Host "⚠ SUPABASE_SERVICE_ROLE_KEY not found in .env" -ForegroundColor Yellow
    } else {
        Write-Host "✓ Service role key found" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Note: Database migrations must be run in Supabase dashboard or via Supabase CLI" -ForegroundColor Cyan
Write-Host "  Migration files are in: supabase/migrations/" -ForegroundColor Gray

Write-Host ""
Write-Host "=== Starting Server ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "The server will start at: http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Test accounts:" -ForegroundColor Yellow
Write-Host "  Head Coach: coach@example.com / password123" -ForegroundColor White
Write-Host "  Assistant: assistant@example.com / password123" -ForegroundColor White
Write-Host "  Player: player1@example.com / password123" -ForegroundColor White
Write-Host "  Parent: parent1@example.com / password123" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start dev server
npm run dev
