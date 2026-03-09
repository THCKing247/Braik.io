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
# Supabase Configuration (REQUIRED)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_ANON_KEY="your-anon-key"

# Next.js
APP_URL="http://localhost:3000"
AUTH_SECRET="$base64Secret"

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
    Write-Host "  Please update Supabase credentials in .env" -ForegroundColor Yellow
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

Write-Host ""
Write-Host "=== Setup Complete! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Configure Supabase:" -ForegroundColor White
Write-Host "   - Add SUPABASE_URL to .env" -ForegroundColor Gray
Write-Host "   - Add SUPABASE_SERVICE_ROLE_KEY to .env" -ForegroundColor Gray
Write-Host "   - Add SUPABASE_ANON_KEY to .env (if using client-side queries)" -ForegroundColor Gray
Write-Host "2. Run database migrations in Supabase dashboard or via Supabase CLI" -ForegroundColor White
Write-Host "3. Run: npm run dev        (to start the server)" -ForegroundColor White
Write-Host ""
Write-Host "Note: Database is managed via Supabase migrations, not Prisma" -ForegroundColor Cyan
Write-Host "Then visit: http://localhost:3000" -ForegroundColor Cyan
